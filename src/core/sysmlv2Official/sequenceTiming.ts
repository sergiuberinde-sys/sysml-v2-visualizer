/**
 * Timing-constraint extraction for SysML v2 sequence views.
 *
 * A sequence can carry an official SysML v2 *timing evaluation* layer: named
 * event-occurrence milestones, elapsed-duration measurements taken from a common
 * origin, a duration budget, and an asserted timing contract. Example
 * (FarHwEpc2Sequence):
 *
 *   event occurrence faultOccurred;
 *   ref part reset { event occurrence resoutReceived; }
 *
 *   attribute alarmAcceptedElapsed  : DurationValue = TimeOf(smu.alarmAccepted)   - TimeOf(faultOccurred);
 *   attribute resoutReceivedElapsed : DurationValue = TimeOf(reset.resoutReceived) - TimeOf(faultOccurred);
 *   attribute drivingFttiLimit      : DurationValue = 0.010 [s];   // 10 ms FTTI budget
 *
 *   assert constraint timingContract {
 *       alarmAcceptedElapsed >= 0 [s] and
 *       transmissionSilentElapsed < resoutReceivedElapsed and
 *       resoutReceivedElapsed <= drivingFttiLimit
 *   }
 *
 * The values are symbolic (`TimeOf(x) - TimeOf(y)`), so only the *budget* carries
 * a number. We surface the measurements, the budget, the contract, and — derived
 * from the contract — which measurement is deadline-bounded (so its target message
 * can be marked on the diagram).
 *
 * ── Extraction source ─────────────────────────────────────────────────────────
 * These constructs are expression trees the raw AST does not flatten conveniently.
 * As with the message dependencies, we read them from the exact source span the
 * AST reports for each timing element (node.startLine..endLine) — an isolated,
 * AST-position-anchored textual read, not a free-form scan. Timing is attached to
 * its owning definition by qualified name; only rendered sequences look it up.
 */

// ── Public data model ────────────────────────────────────────────────────────

export interface TimingEndpoint { participant?: string; event: string }

/** One elapsed-duration measurement: `name = TimeOf(target) - TimeOf(origin)`. */
export interface TimingMeasure {
  name: string;
  target: TimingEndpoint;
  origin: TimingEndpoint;
}

/** A fixed duration budget, e.g. `drivingFttiLimit = 0.010 [s]`. */
export interface TimingBudget {
  name: string;
  ms: number;
  display: string; // human label, e.g. "10 ms"
}

/** A measurement bounded by a budget (from the contract), with its target milestone. */
export interface TimingDeadline {
  measureName: string;
  ms: number;
  display: string;
  target: TimingEndpoint;
}

export interface SequenceTiming {
  ownerQualifiedName: string;
  constraintName?: string;
  measures: TimingMeasure[];
  budgets: TimingBudget[];
  contract?: string;              // raw asserted expression (whitespace-normalised)
  deadlines: TimingDeadline[];
}

// ── Duck-typed inputs (shared with the dependency extractor) ──────────────────

interface RawNodeLike { type: string; name?: string | null; startLine?: number; endLine?: number; children?: RawNodeLike[] }
export interface TimingSource { text: string; model: RawNodeLike[] | undefined }

const QNAME_SCOPE_TYPES = new Set([
  'Package', 'LibraryPackage', 'PartDefinition', 'ActionDefinition', 'ItemDefinition',
  'PortDefinition', 'ConnectionDefinition', 'InterfaceDefinition', 'AttributeDefinition',
]);

// `attribute NAME : DurationValue = TimeOf(A) - TimeOf(B)`
const MEASURE_RE = /attribute\s+(\w+)\s*:\s*\w+\s*=\s*TimeOf\(\s*([\w.]+)\s*\)\s*-\s*TimeOf\(\s*([\w.]+)\s*\)/;
// `attribute NAME : DurationValue = 0.010 [s]`
const BUDGET_RE = /attribute\s+(\w+)\s*:\s*\w+\s*=\s*(-?[\d.]+)\s*\[\s*(\w+)\s*\]/;
// `assert constraint NAME {` … capture the name
const CONSTRAINT_RE = /assert\s+constraint\s+(\w+)\s*\{/;

function toMs(value: number, unit: string): number {
  switch (unit) {
    case 's':   return value * 1000;
    case 'ms':  return value;
    case 'us': case 'µs': return value / 1000;
    case 'ns':  return value / 1_000_000;
    case 'min': return value * 60_000;
    default:    return value; // unknown unit → treat as-is
  }
}

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${+(ms / 1000).toPrecision(6)} s`;
  if (ms >= 1)    return `${+ms.toPrecision(6)} ms`;
  return `${+(ms * 1000).toPrecision(6)} µs`;
}

const endpointOf = (ref: string): TimingEndpoint => {
  const dot = ref.indexOf('.');
  return dot < 0 ? { event: ref } : { participant: ref.slice(0, dot), event: ref.slice(dot + 1) };
};

/**
 * Extract per-definition timing across all provided source files. Returns one
 * {@link SequenceTiming} per definition that declares any timing element.
 */
export function extractSequenceTiming(sources: TimingSource[]): SequenceTiming[] {
  const out: SequenceTiming[] = [];

  for (const { text, model } of sources) {
    if (!model?.length || !text) continue;
    const lines = text.split(/\r?\n/);
    const span = (n: RawNodeLike, max = 6): string => {
      const s = n.startLine; if (!s) return '';
      const e = Math.min(n.endLine ?? s + max, s + max);
      return lines.slice(s - 1, e).join(' ');
    };

    // Per owning-definition accumulation, keyed by qualified name.
    const byOwner = new Map<string, SequenceTiming>();
    const acc = (owner: string): SequenceTiming => {
      let t = byOwner.get(owner);
      if (!t) { t = { ownerQualifiedName: owner, measures: [], budgets: [], deadlines: [] }; byOwner.set(owner, t); }
      return t;
    };

    const visit = (nodes: RawNodeLike[], ownerPath: string[]): void => {
      for (const n of nodes) {
        const scoped = QNAME_SCOPE_TYPES.has(n.type) && n.name ? [...ownerPath, n.name] : ownerPath;
        const owner = ownerPath.join('::');

        if (n.type === 'AttributeUsage' && n.startLine && owner) {
          const src = span(n, 3);
          const mm = MEASURE_RE.exec(src);
          if (mm) acc(owner).measures.push({ name: mm[1], target: endpointOf(mm[2]), origin: endpointOf(mm[3]) });
          else {
            const bm = BUDGET_RE.exec(src);
            if (bm) {
              const ms = toMs(parseFloat(bm[2]), bm[3]);
              acc(owner).budgets.push({ name: bm[1], ms, display: fmtMs(ms) });
            }
          }
        } else if (n.type === 'AssertConstraintUsage' && n.startLine && owner) {
          const full = span(n, 20);
          const cm = CONSTRAINT_RE.exec(full);
          const brace = full.indexOf('{');
          const close = full.lastIndexOf('}');
          const body = brace >= 0 && close > brace ? full.slice(brace + 1, close) : full;
          const t = acc(owner);
          t.constraintName = cm?.[1] ?? t.constraintName;
          t.contract = body.replace(/\s+/g, ' ').trim();
        }

        if (n.children) visit(n.children, scoped);
      }
    };
    visit(model, []);

    for (const t of byOwner.values()) {
      if (t.measures.length === 0 && t.budgets.length === 0 && !t.contract) continue;
      t.deadlines = deriveDeadlines(t);
      out.push(t);
    }
  }
  return out;
}

/**
 * From the contract, find `measure (<=|<) budget` clauses and attach the budget's
 * duration to that measurement's target milestone.
 */
function deriveDeadlines(t: SequenceTiming): TimingDeadline[] {
  if (!t.contract) return [];
  const budgetByName = new Map(t.budgets.map(b => [b.name, b]));
  const measureByName = new Map(t.measures.map(m => [m.name, m]));
  const seen = new Set<string>();
  const deadlines: TimingDeadline[] = [];

  for (const clause of t.contract.split(/\band\b/)) {
    // measure <= budgetName   |   measure <= 0.010 [s]
    const m = /(\w+)\s*<=?\s*(?:(\w+)|(-?[\d.]+)\s*\[\s*(\w+)\s*\])/.exec(clause);
    if (!m) continue;
    const measure = measureByName.get(m[1]);
    if (!measure || seen.has(m[1])) continue;
    let ms: number | undefined; let display = '';
    if (m[2]) { const b = budgetByName.get(m[2]); if (b) { ms = b.ms; display = b.display; } }
    else if (m[3] && m[4]) { ms = toMs(parseFloat(m[3]), m[4]); display = fmtMs(ms); }
    if (ms === undefined) continue;
    seen.add(m[1]);
    deadlines.push({ measureName: m[1], ms, display, target: measure.target });
  }
  return deadlines;
}

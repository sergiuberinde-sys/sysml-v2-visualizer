import type { TrlcTrace } from './types';

export interface RawAnnotation {
  numericId: string;
  elementName: string;
}

/** One (element → requirement) trace recovered from an `@Satisfies` metadata element. */
export interface SatisfiesTrace {
  elementName: string;   // the definition/usage the `@Satisfies` annotates
  reqId: string;         // a requirement name from its `reqId` tuple (matched to a .trlc requirement by exact name)
}

interface RawNodeLike { type: string; name?: string | null; children?: RawNodeLike[] }

/**
 * Extract `@Satisfies { reqId = ("Req_1", "Req_2", …); }` metadata from the raw model
 * tree(s). A `@Satisfies` is a `MetadataUsage` whose `FeatureTyping` resolves to `Satisfies`;
 * its `reqId` values are `LiteralString` descendants (the requirement names), and the
 * annotated element is the nearest enclosing named definition/usage.
 *
 * Works purely on the parser's containment tree (no source text needed), so it runs the same
 * for the extension and the standalone web adapter. Requirement matching (by exact name) is
 * done downstream, once the .trlc requirements are known.
 */
export function extractSatisfiesTraces(models: (RawNodeLike[] | undefined)[]): SatisfiesTrace[] {
  const out: SatisfiesTrace[] = [];
  const literalsUnder = (n: RawNodeLike, acc: string[]): void => {
    for (const c of n.children ?? []) {
      if (c.type === 'LiteralString' && c.name) acc.push(c.name);
      literalsUnder(c, acc);
    }
  };
  const isHost = (n: RawNodeLike) =>
    !!n.name && n.name !== n.type && n.type !== 'MetadataUsage' &&
    (/Definition$/.test(n.type) || /Usage$/.test(n.type));

  const visit = (nodes: RawNodeLike[], host: string | undefined): void => {
    for (const n of nodes) {
      if (n.type === 'MetadataUsage') {
        const isSatisfies = (n.children ?? []).some(c => c.type === 'FeatureTyping' && c.name === 'Satisfies');
        if (isSatisfies && host) {
          const reqIds: string[] = [];
          literalsUnder(n, reqIds);
          for (const reqId of reqIds) out.push({ elementName: host, reqId });
        }
        continue; // don't descend metadata for host tracking
      }
      const nextHost = isHost(n) ? n.name! : host;
      if (n.children) visit(n.children, nextHost);
    }
  };
  for (const model of models) if (model) visit(model, undefined);
  return out;
}

/**
 * Scan SysML v2 source text(s) for `// trlc-satisfies: NNNNN` annotations
 * and return raw (numericId, elementName) pairs — no TRLC requirement lookup.
 *
 * Each comment binds to the element declaration on the next non-blank,
 * non-comment line. Multiple consecutive trlc-satisfies comments all bind
 * to the same following declaration.
 *
 * Suitable for calling from the VS Code extension (which doesn't know about
 * TRLC requirement IDs) as well as from the webview for standalone fallback.
 */
export function scanRawAnnotations(sources: { text: string }[]): RawAnnotation[] {
  const result: RawAnnotation[] = [];
  const seen = new Set<string>();

  for (const { text } of sources) {
    const lines = text.split('\n');
    const pendingNums: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      const m = trimmed.match(/^\/\/\s*trlc-satisfies:\s*(\d+)/);
      if (m) {
        pendingNums.push(m[1]);
        continue;
      }

      if (pendingNums.length === 0) continue;
      if (trimmed === '' || trimmed.startsWith('//')) continue;

      const elementName = extractElementName(trimmed);
      if (elementName) {
        for (const numericId of pendingNums) {
          const key = `${numericId}:${elementName}`;
          if (!seen.has(key)) {
            seen.add(key);
            result.push({ numericId, elementName });
          }
        }
      }
      pendingNums.length = 0;
    }
  }

  return result;
}

/**
 * Map raw annotations to TrlcTrace entries using a numeric-suffix → full-ID map.
 * Annotations whose numericId has no matching requirement are silently dropped.
 */
export function mapAnnotationsToTraces(
  annotations: RawAnnotation[],
  numericToReqId: Map<string, string>,
): TrlcTrace[] {
  const traces: TrlcTrace[] = [];
  const seen = new Set<string>();
  for (const ann of annotations) {
    const reqId = numericToReqId.get(ann.numericId);
    if (!reqId) continue;
    const key = `${reqId}:${ann.elementName}`;
    if (!seen.has(key)) {
      seen.add(key);
      traces.push({ requirementId: reqId, elementName: ann.elementName });
    }
  }
  return traces;
}

/**
 * Build the numericToReqId map from TRLC requirement IDs.
 * Extracts the trailing numeric suffix: "Acpd25094059" → "25094059".
 */
export function buildNumericToReqId(requirementIds: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const id of requirementIds) {
    const match = id.match(/(\d+)$/);
    if (match) m.set(match[1], id);
  }
  return m;
}

/**
 * Convenience: scan sources and map in one step (standalone / fallback path).
 */
export function extractTrlcTraces(
  sources: { text: string }[],
  numericToReqId: Map<string, string>,
): TrlcTrace[] {
  return mapAnnotationsToTraces(scanRawAnnotations(sources), numericToReqId);
}

// Extract the declared element name from a SysML declaration line.
function extractElementName(line: string): string | null {
  // "... def NAME" — enum def, part def, action def, port def, etc.
  let m = line.match(/\bdef\s+(\w+)/);
  if (m) return m[1];

  // Usage keywords without "def": attribute, port, item, etc.
  m = line.match(/^\s*(?:private\s+)?(?:abstract\s+)?(?:attribute|port|action|item|state|requirement|occurrence|behavior|constraint)\s+(\w+)/);
  if (m) return m[1];

  return null;
}

import type { ParseResult, SysMLNode, PackageDefNode } from '../core/modelTypes';
import type { SelectionState } from './selection';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Candidate {
  sel: NonNullable<SelectionState>;
  startLine: number;
  endLine: number;
}

function endOf(n: SysMLNode): number {
  return (n as { endLine?: number }).endLine ?? n.line;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function findElementAtLine(
  cursorLine: number,
  result: ParseResult,
): SelectionState {
  const candidates: Candidate[] = [];

  // Package definitions (not in result.nodes — they live in result.packages)
  addPackages(result.packages, candidates);

  // All other top-level elements + their body children.
  // traceLink IDs include their position in the filtered traceLink list.
  let traceLinkIdx = 0;
  for (const n of result.nodes) {
    addTopNode(n, traceLinkIdx, candidates);
    if (n.kind === 'traceLink') traceLinkIdx++;
  }

  // Prefer elements whose range contains the cursor (innermost = smallest span)
  const containing = candidates.filter(
    c => c.startLine <= cursorLine && cursorLine <= c.endLine,
  );
  if (containing.length > 0) {
    containing.sort(
      (a, b) => (a.endLine - a.startLine) - (b.endLine - b.startLine),
    );
    return containing[0].sel;
  }

  // Fallback: element with the largest startLine that is still ≤ cursor
  const before = candidates.filter(c => c.startLine <= cursorLine);
  if (before.length === 0) return null;
  before.sort((a, b) => b.startLine - a.startLine);
  return before[0].sel;
}

// ── Package traversal ─────────────────────────────────────────────────────────

function addPackages(packages: PackageDefNode[], out: Candidate[]): void {
  for (const pkg of packages) {
    const ns = pkg.namespace ? `${pkg.namespace}::${pkg.name}` : pkg.name;
    out.push({
      sel: {
        id: `pkg-${ns}`, type: 'packageDef', name: pkg.name, line: pkg.line,
        extra: { namespace: pkg.namespace, qualifiedName: ns },
      },
      startLine: pkg.line,
      endLine: endOf(pkg),
    });
    // Recurse only into nested packageDefs — their non-pkg children are in result.nodes
    addPackages(
      pkg.body.filter((n): n is PackageDefNode => n.kind === 'packageDef'),
      out,
    );
  }
}

// ── Top-level node dispatch ───────────────────────────────────────────────────

function addTopNode(
  n: SysMLNode,
  traceLinkIdx: number,
  out: Candidate[],
): void {
  const startLine = n.line;
  const endLine   = endOf(n);

  switch (n.kind) {
    case 'interfaceDef':
      out.push({
        sel: { id: `iface-${n.name}`, type: 'interface', name: n.name, line: n.line },
        startLine, endLine,
      });
      break;

    case 'partDef': {
      const isComposed = n.body.some(b => b.kind === 'partAlias');
      out.push({
        sel: {
          id: isComposed ? `grp-${n.name}` : `def-${n.name}`,
          type: isComposed ? 'systemPart' : 'part',
          name: n.name, line: n.line,
        },
        startLine, endLine,
      });
      addBody(n, out);
      break;
    }

    case 'occurrenceDef':
      out.push({
        sel: { id: `occ-${n.name}`, type: 'occurrence', name: n.name, line: n.line },
        startLine, endLine,
      });
      addBody(n, out);
      break;

    case 'actionDef':
      out.push({
        sel: { id: `adef-${n.name}`, type: 'action', name: n.name, line: n.line },
        startLine, endLine,
      });
      break;

    case 'behaviorDef':
      out.push({
        sel: { id: `bhv-${n.name}`, type: 'behavior', name: n.name, line: n.line },
        startLine, endLine,
      });
      addBody(n, out);
      break;

    case 'stateDef':
      out.push({
        sel: { id: `smdef-${n.name}`, type: 'stateMachine', name: n.name, line: n.line },
        startLine, endLine,
      });
      addBody(n, out);
      break;

    case 'requirementDef':
      out.push({
        sel: {
          id: `req-${n.name}`, type: 'requirement', name: n.name, line: n.line,
          extra: { reqId: n.reqId, text: n.text, priority: n.priority },
        },
        startLine, endLine,
      });
      break;

    case 'traceLink':
      out.push({
        sel: {
          id: `trlink-${n.source}-${n.target}-${traceLinkIdx}`,
          type: 'traceLink',
          name: `${n.source} ${n.linkType}s ${n.target}`,
          line: n.line,
          extra: { source: n.source, target: n.target, linkType: n.linkType },
        },
        startLine, endLine,
      });
      break;

    default:
      break;
  }
}

// ── Body traversal ────────────────────────────────────────────────────────────

type BlockNode = Extract<SysMLNode, { name: string; body: SysMLNode[] }>;

function addBody(parent: BlockNode, out: Candidate[]): void {
  const parentName = parent.name;
  let msgIdx   = 0;
  let transIdx = 0;

  for (const n of parent.body) {
    const startLine = n.line;
    const endLine   = endOf(n);

    switch (n.kind) {
      case 'port':
        out.push({
          sel: {
            id: `port-${parentName}-${n.name}`,
            type: 'port', name: n.name, line: n.line,
            extra: { direction: n.direction, portType: n.portType, partDef: parentName },
          },
          startLine, endLine,
        });
        break;

      case 'partAlias':
        out.push({
          sel: {
            id: `inst-${parentName}-${n.name}`,
            type: 'instance', name: n.name, line: n.line,
            extra: { type: n.type, parent: parentName },
          },
          startLine, endLine,
        });
        break;

      case 'connection':
        out.push({
          sel: {
            id: `conn-${parentName}-${n.fromPart}.${n.fromPort}-${n.toPart}.${n.toPort}`,
            type: 'connection',
            name: `${n.fromPart}.${n.fromPort} → ${n.toPart}.${n.toPort}`,
            line: n.line,
            extra: { fromPart: n.fromPart, fromPort: n.fromPort, toPart: n.toPart, toPort: n.toPort, parent: parentName },
          },
          startLine, endLine,
        });
        break;

      case 'message': {
        const idx = msgIdx++;
        out.push({
          sel: {
            id: `msg-${parentName}-${n.name}-${idx}`,
            type: 'message', name: n.name, line: n.line,
            extra: { from: n.from, to: n.to, occurrence: parentName },
          },
          startLine, endLine,
        });
        break;
      }

      case 'actionInst':
        out.push({
          sel: {
            id: `bact-${parentName}-${n.name}`,
            type: 'actionInst', name: n.name, line: n.line,
            extra: { actionType: n.actionType, behavior: parentName },
          },
          startLine, endLine,
        });
        break;

      case 'stateEntry':
        out.push({
          sel: {
            id: `sstate-${parentName}-${n.name}`,
            type: 'stateEntry', name: n.name, line: n.line,
            extra: { stateMachine: parentName },
          },
          startLine, endLine,
        });
        break;

      case 'transition':
        if (n.from !== '') {
          const idx = transIdx++;
          out.push({
            sel: {
              id: `strans-${parentName}-${n.from}-${n.to}-${idx}`,
              type: 'stateTransition',
              name: n.event ? `${n.from} → ${n.to} [${n.event}]` : `${n.from} → ${n.to}`,
              line: n.line,
              extra: { from: n.from, to: n.to, event: n.event, stateMachine: parentName },
            },
            startLine, endLine,
          });
        }
        break;

      default:
        break;
    }
  }
}

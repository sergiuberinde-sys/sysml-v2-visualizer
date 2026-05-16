/**
 * Interaction Flow View — official SysML v2 mode only.
 *
 * Shows a readable ordered projection of a behavior's action succession chain.
 * Derived from official BehaviorData (succession flows + action instances).
 *
 * This is NOT a formal sequence diagram. It is a lightweight interaction-flow
 * projection showing temporal ordering as derived from explicit SysML v2
 * succession/transition edges.
 *
 * Visual format:
 *   [context: ProcessingModule::AdcNotificationFlow]
 *
 *   ① read : ReadAdcSensor
 *      ↓
 *   ② evaluate : EvaluateAdcData
 *      ↓
 *   ③ monitor : MonitorSystemHealth
 *      ↓
 *   ④ activate : ActivateOutput
 */

import { useMemo } from 'react';
import type { BehaviorData } from '../../core/sysmlv2Official';
import type { SelectionState } from '../../app/selection';

// ── Colour palette (matches OfficialBehaviorView) ────────────────────────────

const STEP_BG       = '#09213a';
const STEP_BORDER   = '#38bdf8';
const STEP_NAME     = '#bae6fd';
const STEP_TYPE     = '#4a9fc0';
const STEP_NUM      = '#475569';
const ARROW_COLOR   = '#334155';
const GUARD_COLOR   = '#a3e635';

const BRANCH_BG     = '#1a110a';
const BRANCH_BORDER = '#f59e0b';
const BRANCH_NAME   = '#fef3c7';
const BRANCH_TYPE   = '#fcd34d';

const LOOP_BG       = '#0a0a1a';
const LOOP_BORDER   = '#818cf8';
const LOOP_NAME     = '#e0e7ff';
const LOOP_TYPE     = '#c4b5fd';

const CTRL_BG       = '#0d1a14';
const CTRL_BORDER   = '#2dd4bf';
const CTRL_NAME     = '#ccfbf1';

const CTRL_FLOW_TYPES = new Set(['DecisionNode', 'MergeNode', 'ForkNode', 'JoinNode']);
const CTRL_LABELS: Record<string, string> = {
  DecisionNode: '«decide»',
  MergeNode:    '«merge»',
  ForkNode:     '«fork»',
  JoinNode:     '«join»',
};

// ── Topological sort ─────────────────────────────────────────────────────────

function topoSort(
  names: string[],
  edges: Array<{ source: string; target: string }>,
): string[] {
  const nameSet = new Set(names);
  const outEdges = new Map<string, string[]>(names.map(n => [n, []]));
  const inDeg    = new Map<string, number>(names.map(n => [n, 0]));

  for (const { source, target } of edges) {
    if (!nameSet.has(source) || !nameSet.has(target)) continue;
    outEdges.get(source)!.push(target);
    inDeg.set(target, (inDeg.get(target) ?? 0) + 1);
  }

  const sorted: string[] = [];
  const queue = names.filter(n => inDeg.get(n) === 0);
  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    sorted.push(curr);
    for (const next of outEdges.get(curr)!) {
      const d = inDeg.get(next)! - 1;
      inDeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  // Append any unvisited (cycle members) in original order
  for (const n of names) {
    if (!sorted.includes(n)) sorted.push(n);
  }
  return sorted;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  behavior:     BehaviorData | undefined;
  behaviorName: string;
  selection:    SelectionState;
  onSelect:     (s: SelectionState) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InteractionFlowView({ behavior, behaviorName, selection, onSelect }: Props) {
  const { steps, guards, contextLabel, ownerLabel } = useMemo(() => {
    if (!behavior || !behaviorName) {
      return { steps: [], guards: new Map(), contextLabel: '', ownerLabel: '' };
    }

    const colonIdx  = behaviorName.indexOf('::');
    const ownerPart = colonIdx >= 0 ? behaviorName.slice(0, colonIdx) : null;
    const defPart   = colonIdx >= 0 ? behaviorName.slice(colonIdx + 2) : behaviorName;

    const def = behavior.actions.find(a =>
      a.type === 'ActionDefinition' &&
      a.name === defPart &&
      (ownerPart === null || a.owningDefName === ownerPart),
    );
    if (!def) return { steps: [], guards: new Map(), contextLabel: '', ownerLabel: '' };

    const actionUsages = behavior.actions.filter(
      a => (a.type === 'ActionUsage' || a.type === 'PerformActionUsage' || CTRL_FLOW_TYPES.has(a.type)) &&
           a.ownerId === def.id,
    );

    type ResolvedFlow = Extract<NonNullable<typeof behavior>['flows'][number], { source: string }>;
    const resolvedFlows = behavior.flows.filter(
      (f): f is ResolvedFlow => 'source' in f,
    );

    const names = actionUsages.map(a => a.name);
    const sorted = topoSort(names, resolvedFlows.map(f => ({ source: f.source, target: f.target })));

    // Build guard map: targetName → guard label (from transition flows)
    const guardMap = new Map<string, string>();
    for (const f of resolvedFlows) {
      if ('guard' in f && f.guard) guardMap.set(f.target, f.guard);
    }

    const actionsByName = new Map(actionUsages.map(a => [a.name, a]));
    const orderedSteps = sorted.map(name => actionsByName.get(name)!).filter(Boolean);

    const ctxLabel = ownerPart ? `${ownerPart}::${defPart}` : defPart;
    const ownerLbl = ownerPart ?? '';

    return { steps: orderedSteps, guards: guardMap, contextLabel: ctxLabel, ownerLabel: ownerLbl };
  }, [behavior, behaviorName]);

  if (!behavior || !behaviorName) {
    return (
      <div className="behavior-placeholder">
        No behavior selected. Switch to Official SysML v2 mode and select a behavior.
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="behavior-placeholder">
        <div>No actions found in <code>{behaviorName}</code>.</div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>
          Define action instances and succession flows inside an <code>action def</code>.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      padding: '24px 32px',
      background: '#0d1117',
      fontFamily: 'monospace',
    }}>
      {/* ── Context header ──────────────────────────────────────────────── */}
      <div style={{
        marginBottom: 28,
        paddingBottom: 12,
        borderBottom: '1px solid #1e2d3d',
      }}>
        <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          Interaction Flow
        </div>
        <div style={{ fontSize: 14, color: '#94a3b8' }}>
          {ownerLabel && (
            <span style={{ color: '#60a5fa' }}>{ownerLabel}</span>
          )}
          {ownerLabel && <span style={{ color: '#334155' }}>::</span>}
          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
            {contextLabel.includes('::') ? contextLabel.split('::')[1] : contextLabel}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>
          {steps.length} action{steps.length !== 1 ? 's' : ''} in succession order
        </div>
      </div>

      {/* ── Step list ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
        {steps.map((step, idx) => {
          const isCtrl    = CTRL_FLOW_TYPES.has(step.type);
          const isBranch  = step.branch === 'then' || step.branch === 'else';
          const isLoop    = step.branch === 'loop';
          const guard     = guards.get(step.name);
          const selId     = `flow-step-${behaviorName}-${step.name}`;
          const isSelected = selection?.id === selId ||
                             (selection?.type === 'actionInst' && selection.name === step.name);

          let bg      = STEP_BG;
          let border  = STEP_BORDER;
          let nameClr = STEP_NAME;
          let typeClr = STEP_TYPE;

          if (isCtrl) {
            bg = CTRL_BG; border = CTRL_BORDER; nameClr = CTRL_NAME; typeClr = CTRL_NAME;
          } else if (isLoop) {
            bg = LOOP_BG; border = LOOP_BORDER; nameClr = LOOP_NAME; typeClr = LOOP_TYPE;
          } else if (isBranch) {
            bg = BRANCH_BG; border = BRANCH_BORDER; nameClr = BRANCH_NAME; typeClr = BRANCH_TYPE;
          }

          if (isSelected) {
            border = '#89b4fa';
          }

          return (
            <div key={step.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              {/* Guard label above the step */}
              {guard && (
                <div style={{
                  marginLeft: 48, marginBottom: 2,
                  fontSize: 11, color: GUARD_COLOR,
                  fontStyle: 'italic',
                }}>
                  [{guard}]
                </div>
              )}

              {/* Step card */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer',
                }}
                onClick={() => onSelect({
                  id: selId,
                  type: 'actionInst',
                  name: step.name,
                  extra: { behavior: behaviorName, ...(step.actionType ? { actionType: step.actionType } : {}) },
                })}
              >
                {/* Step number badge */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#0f172a',
                  border: `1px solid ${isSelected ? '#89b4fa' : '#1e293b'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: STEP_NUM, flexShrink: 0,
                  fontWeight: 600,
                }}>
                  {idx + 1}
                </div>

                {/* Step content box */}
                <div style={{
                  minWidth: 220, maxWidth: 320,
                  padding: '10px 14px',
                  background: bg,
                  border: `1.5px solid ${border}`,
                  borderRadius: 8,
                  boxShadow: isSelected ? `0 0 8px 2px ${border}44` : 'none',
                  transition: 'box-shadow 0.15s',
                }}>
                  <div style={{ fontSize: 10, color: isCtrl ? CTRL_NAME : ACT_STEREO_DIM, marginBottom: 2 }}>
                    {isCtrl ? (CTRL_LABELS[step.type] ?? '«control»') : '«action»'}
                  </div>
                  <div style={{ fontSize: 14, color: nameClr, fontWeight: 600 }}>
                    {step.name}
                  </div>
                  {!isCtrl && step.actionType && (
                    <div style={{ fontSize: 11, color: typeClr, marginTop: 2 }}>
                      : {step.actionType}
                    </div>
                  )}
                </div>
              </div>

              {/* Connector arrow (not after last step) */}
              {idx < steps.length - 1 && (
                <div style={{
                  marginLeft: 52, // aligns with center of step card
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  width: 24,
                }}>
                  <div style={{ width: 1, height: 16, background: ARROW_COLOR }} />
                  <div style={{ fontSize: 14, color: ARROW_COLOR, lineHeight: 1 }}>▼</div>
                  <div style={{ width: 1, height: 8, background: ARROW_COLOR }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Summary footer ───────────────────────────────────────────────── */}
      <div style={{
        marginTop: 32,
        paddingTop: 12,
        borderTop: '1px solid #1e2d3d',
        fontSize: 11, color: '#334155',
      }}>
        Derived from official SysML v2 succession flows ·{' '}
        <span style={{ color: '#1e3a5f' }}>not formal sequence semantics</span>
      </div>
    </div>
  );
}

// Missing constant referenced above
const ACT_STEREO_DIM = '#7dd3fc66';

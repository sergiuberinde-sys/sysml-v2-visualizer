import { useState } from 'react';
import type { VisualizerModel, VizNode, VizPackageNode, VizDiagnostic } from '../../core/visualizerModel';
import type { SelectionState } from '../../app/selection';
import type { ImpactTrace, ImpactedElement, ImpactedFlow, AttributeEntry } from '../../core/sysmlv2Official';
import { elementLines } from '../../core/validator';
import ActionModal, { type FieldDef } from '../components/ActionModal';
import {
  insertInterface, insertPartDef, insertPort,
  insertConnection, insertOccurrence, insertMessage,
  insertStateDef, insertStateEntry, insertStateTransition,
  insertRequirementDef, insertTraceLink,
  insertPackage, insertElementIntoPackage,
  computeInsertInterface, computeInsertPartDef, computeInsertPort,
  computeInsertConnection, computeInsertOccurrence, computeInsertMessage,
  computeInsertStateDef, computeInsertStateEntry, computeInsertStateTransition,
  computeInsertRequirementDef, computeInsertTraceLink,
  computeInsertPackage, computeInsertElementIntoPackage,
} from '../../core/insertions';
import type { IncrementalEdit } from '../../core/editDescriptor';
import type { TrlcData } from '../../core/trlc/types';
import { requirementsForElement } from '../../core/trlc/types';

interface Props {
  selection: SelectionState;
  result: VisualizerModel;
  source: string;
  onSourceChange: (s: string) => void;
  onIncrementalEdit?: (edit: IncrementalEdit) => void;
  onCollapse?: () => void;
  impactTrace?: ImpactTrace;
  onSelect?: (s: NonNullable<SelectionState>) => void;
  trlcData?: TrlcData;
}

// ── Modal discriminant ────────────────────────────────────────────────────────

type ModalKind =
  | 'interface' | 'partDef' | 'port' | 'connection' | 'occurrence' | 'message'
  | 'stateMachine' | 'stateEntry' | 'stateTransition'
  | 'requirement' | 'satisfyLink' | 'verifyLink' | 'traceLink'
  | 'addPackage' | 'addToPackage'
  | null;

// ── Small helpers ─────────────────────────────────────────────────────────────

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="insp-row">
      <span className="insp-label">{label}</span>
      <span className="insp-value">{value}</span>
    </div>
  );
}

function ActionBtn({
  label, onClick, disabled, title,
}: {
  label: string; onClick: () => void; disabled?: boolean; title?: string;
}) {
  return (
    <button
      className="action-btn"
      onClick={onClick}
      disabled={disabled}
      title={title}
      type="button"
    >
      + {label}
    </button>
  );
}

// ── ImpactSection — official SysML v2 impact trace ───────────────────────────

function emfTypeToSelType(emfType: string): NonNullable<SelectionState>['type'] {
  switch (emfType) {
    case 'PartDefinition':
    case 'PartUsage':              return 'part';
    case 'PortUsage':
    case 'PortDefinition':         return 'port';
    case 'ActionDefinition':       return 'behavior';
    case 'ActionUsage':
    case 'PerformActionUsage':     return 'actionInst';
    case 'Package':
    case 'LibraryPackage':         return 'packageDef';
    case 'InterfaceDefinition':
    case 'ConnectionDefinition':   return 'interface';
    case 'OccurrenceDefinition':   return 'occurrence';
    case 'RequirementDefinition':
    case 'RequirementUsage':       return 'requirement';
    default:                       return 'part';
  }
}

function ImpactRow({
  label,
  items,
  onSelect,
}: {
  label: string;
  items: ImpactedElement[];
  onSelect?: (s: NonNullable<SelectionState>) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="insp-impact-group">
      <div className="insp-impact-group-label">{label}</div>
      {items.map((el, i) => (
        <div key={i} className="insp-impact-row">
          <span className="insp-impact-type">{el.type}</span>
          {onSelect ? (
            <button
              className="insp-impact-link"
              type="button"
              onClick={() => onSelect({
                id: `impact-${el.label}`,
                type: emfTypeToSelType(el.type),
                name: el.label,
                ...(el.extra ? { extra: el.extra } : {}),
              })}
            >
              {el.label}
            </button>
          ) : (
            <span className="insp-impact-name">{el.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function FlowRow({
  label,
  flows,
  direction,
  onSelect,
}: {
  label: string;
  flows: ImpactedFlow[];
  direction: 'from' | 'to' | 'both';
  onSelect?: (s: NonNullable<SelectionState>) => void;
}) {
  if (flows.length === 0) return null;
  return (
    <div className="insp-impact-group">
      <div className="insp-impact-group-label">{label}</div>
      {flows.map((f, i) => {
        const tag = `${f.flowType}${f.guard ? ` [${f.guard}]` : ''}`;
        const endName  = direction === 'from' ? f.source : direction === 'to' ? f.target : null;
        const bothText = `${f.source} → ${f.target}`;
        return (
          <div key={i} className="insp-impact-row">
            <span className="insp-impact-type">{tag}</span>
            {endName && onSelect && f.behaviorContext ? (
              <button
                className="insp-impact-link"
                type="button"
                onClick={() => onSelect({
                  id: `impact-${endName}`,
                  type: 'actionInst',
                  name: endName,
                  extra: { behavior: f.behaviorContext! },
                })}
              >
                {direction === 'from' ? `← ${endName}` : `→ ${endName}`}
              </button>
            ) : (
              <span className="insp-impact-name">
                {endName ? (direction === 'from' ? `← ${endName}` : `→ ${endName}`) : bothText}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RequirementRow({
  items,
  onSelect,
}: {
  items: ImpactedElement[];
  onSelect?: (s: NonNullable<SelectionState>) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="insp-impact-group">
      <div className="insp-impact-group-label">Requirements</div>
      {items.map((el, i) => {
        const reqDef = el.extra?.requirementDef;
        const displayText = reqDef ? `${el.label} : ${reqDef}` : el.label;
        return (
          <div key={i} className="insp-impact-row">
            <span className="insp-impact-type">{el.type}</span>
            {reqDef && onSelect ? (
              <button
                className="insp-impact-link"
                type="button"
                onClick={() => onSelect({ id: `impact-req-${reqDef}`, type: 'requirement', name: reqDef })}
              >
                {displayText}
              </button>
            ) : (
              <span className="insp-impact-name">{displayText}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AttributesSection({ attrs }: { attrs: AttributeEntry[] }) {
  const significant = attrs.filter(a => a.typeName !== undefined);
  if (significant.length === 0) return null;
  return (
    <div className="insp-impact-group">
      <div className="insp-impact-group-label">Attributes</div>
      {significant.map((a, i) => (
        <div key={i} className="insp-impact-row">
          <span className="insp-impact-type">{a.typeName}</span>
          <span className="insp-impact-name">
            {a.name}{a.value !== undefined ? ` = ${a.value}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

const ASIL_COLOR: Record<string, string> = {
  D: '#f87171', C: '#fb923c', B: '#facc15', A: '#a3e635', QM: '#64748b',
};

function TrlcSection({
  elementName,
  trlcData,
  onSelect,
}: {
  elementName: string;
  trlcData: TrlcData;
  onSelect?: (s: NonNullable<SelectionState>) => void;
}) {
  const reqts = requirementsForElement(trlcData, elementName);
  if (reqts.length === 0) return null;
  return (
    <div className="insp-section">
      <div className="insp-section-label">TRLC Requirements</div>
      <div className="insp-impact-group">
        {reqts.map(req => (
          <div key={req.id} className="insp-impact-row">
            <span className="insp-impact-type" style={{ color: ASIL_COLOR[req.asil ?? ''] ?? '#64748b' }}>
              {req.asil ? `ASIL-${req.asil}` : 'TRLC'}
            </span>
            {onSelect ? (
              <button
                className="insp-impact-link"
                type="button"
                onClick={() => onSelect({
                  id: `trlc-req-${req.id}`,
                  type: 'requirement',
                  name: req.id,
                  extra: { reqId: req.id, text: req.text, title: req.title, ...(req.asil ? { asil: req.asil } : {}) },
                })}
              >
                {req.id} — {req.title}
              </button>
            ) : (
              <span className="insp-impact-name">{req.id} — {req.title}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const PORT_EMFTYPES_UI   = new Set(['PortUsage', 'PortDefinition']);
const ACTION_USAGE_TYPES = new Set(['ActionUsage', 'PerformActionUsage']);

function ImpactSection({
  trace,
  onSelect,
}: {
  trace: ImpactTrace;
  onSelect?: (s: NonNullable<SelectionState>) => void;
}) {
  // Filter ownedElements to avoid duplication with dedicated sections.
  const nonSpecificOwned = trace.ownedElements.filter(el => {
    if (PORT_EMFTYPES_UI.has(el.type)) return false;           // shown in Ports
    if (ACTION_USAGE_TYPES.has(el.type)) return false;         // shown in Actions
    if (el.type === 'RequirementUsage') return false;          // shown in Requirements
    if (el.type === 'AttributeUsage') return false;            // shown in Attributes
    if (el.type === 'ActionDefinition' && trace.relatedBehaviors.length > 0) return false; // shown in Behaviors
    return true;
  });

  const hasContent =
    nonSpecificOwned.length > 0 ||
    trace.ownedPorts.length > 0 ||
    trace.ownedActions.length > 0 ||
    trace.ownedRequirements.length > 0 ||
    trace.ownedAttributes.length > 0 ||
    trace.ownerChain.length > 0 ||
    trace.usedAsTypeBy.length > 0 ||
    trace.connectedElements.length > 0 ||
    trace.relatedBehaviors.length > 0 ||
    trace.relatedFlows.length > 0 ||
    trace.incomingFlows.length > 0 ||
    trace.outgoingFlows.length > 0 ||
    !!trace.typedByDef;

  if (!hasContent) return null;

  const hasDirectedFlows = trace.incomingFlows.length > 0 || trace.outgoingFlows.length > 0;

  return (
    <div className="insp-section">
      <div className="insp-section-label">Impact</div>
      <ImpactRow label="Owner"           items={trace.ownerChain.slice(0, 1)} onSelect={onSelect} />
      <ImpactRow label="Ports"           items={trace.ownedPorts}             onSelect={onSelect} />
      <ImpactRow label="Actions"         items={trace.ownedActions}           onSelect={onSelect} />
      <RequirementRow                    items={trace.ownedRequirements}      onSelect={onSelect} />
      <AttributesSection                 attrs={trace.ownedAttributes} />
      <ImpactRow label="Owned elements"  items={nonSpecificOwned}             onSelect={onSelect} />
      {trace.relatedBehaviors.length > 0 && (
        <div className="insp-impact-group">
          <div className="insp-impact-group-label">Behaviors</div>
          {trace.relatedBehaviors.map((b, i) => (
            <div key={i} className="insp-impact-row">
              <span className="insp-impact-type">ActionDefinition</span>
              {onSelect ? (
                <button
                  className="insp-impact-link"
                  type="button"
                  onClick={() => onSelect({ id: `impact-${b.name}`, type: 'behavior', name: b.name })}
                >
                  {b.qualifiedName}
                </button>
              ) : (
                <span className="insp-impact-name">{b.qualifiedName}</span>
              )}
            </div>
          ))}
        </div>
      )}
      <ImpactRow label="Used as type by" items={trace.usedAsTypeBy}                          onSelect={onSelect} />
      <ImpactRow label="Typed by"        items={trace.typedByDef ? [trace.typedByDef] : []} onSelect={onSelect} />
      <ImpactRow label="Connected to"    items={trace.connectedElements}                    onSelect={onSelect} />
      {hasDirectedFlows ? (
        <>
          <FlowRow label="Incoming flows" flows={trace.incomingFlows} direction="from" onSelect={onSelect} />
          <FlowRow label="Outgoing flows" flows={trace.outgoingFlows} direction="to"   onSelect={onSelect} />
        </>
      ) : (
        <FlowRow label="Related flows" flows={trace.relatedFlows} direction="both" onSelect={onSelect} />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InspectorPanel({ selection, result, source, onSourceChange, onIncrementalEdit, onCollapse, impactTrace, onSelect, trlcData }: Props) {
  const [modal, setModal] = useState<ModalKind>(null);

  function apply(edit: IncrementalEdit | null, fallbackText: string): void {
    if (edit !== null && onIncrementalEdit) {
      onIncrementalEdit(edit);
    } else {
      onSourceChange(fallbackText);
    }
  }

  // ── Derived model data for validation ──────────────────────────────────────

  type PD = Extract<VizNode,{ kind: 'partDef' }>;
  type OD = Extract<VizNode,{ kind: 'occurrenceDef' }>;
  type PortN  = Extract<VizNode,{ kind: 'port' }>;
  type AliasN = Extract<VizNode,{ kind: 'partAlias' }>;
  type ConnN  = Extract<VizNode,{ kind: 'connection' }>;
  type MsgN   = Extract<VizNode,{ kind: 'message' }>;

  const partDefs = result.nodes.filter((n): n is PD => n.kind === 'partDef');
  const occDefs  = result.nodes.filter((n): n is OD => n.kind === 'occurrenceDef');

  const allTopNames = new Set(
    result.nodes
      .filter(n => 'name' in n)
      .map(n => (n as { name: string }).name),
  );

  const selectedPartName   = selection?.type === 'part'         ? selection.name : null;
  const selectedSystemName = selection?.type === 'systemPart'   ? selection.name : null;
  const selectedOccName    = selection?.type === 'occurrence'   ? selection.name : null;
  const selectedSMName     =
    selection?.type === 'stateMachine' ? selection.name :
    (selection?.type === 'stateEntry' || selection?.type === 'stateTransition')
      ? (selection.extra?.stateMachine ?? null)
    : null;

  const selectedPackagePath = selection?.type === 'packageDef'
    ? (selection.extra?.qualifiedName ?? selection.name)
    : null;

  // Interfaces for type hints
  const ifaceNames = result.nodes
    .filter(n => n.kind === 'interfaceDef')
    .map(n => (n as Extract<VizNode,{ kind: 'interfaceDef' }>).name);

  // Instances inside the selected system part
  const systemInstances = selectedSystemName
    ? (partDefs.find(n => n.name === selectedSystemName)?.body.filter(
        (b): b is AliasN => b.kind === 'partAlias',
      ) ?? [])
    : [];

  const partDefMap = new Map(partDefs.map(p => [p.name, p]));

  // ── Submit handlers ─────────────────────────────────────────────────────────

  function submitInterface(vals: Record<string, string>): string | null {
    const name = vals.name.trim();
    if (!name) return 'Name cannot be empty.';
    if (!/^\w+$/.test(name)) return 'Name must be a single word (letters, digits, _).';
    if (allTopNames.has(name)) return `"${name}" already exists.`;
    apply(computeInsertInterface(source, result, name), insertInterface(source, result, name));
    return null;
  }

  function submitPartDef(vals: Record<string, string>): string | null {
    const name = vals.name.trim();
    if (!name) return 'Name cannot be empty.';
    if (!/^\w+$/.test(name)) return 'Name must be a single word (letters, digits, _).';
    if (allTopNames.has(name)) return `"${name}" already exists.`;
    apply(computeInsertPartDef(source, result, name), insertPartDef(source, result, name));
    return null;
  }

  function submitPort(vals: Record<string, string>): string | null {
    if (!selectedPartName) return 'No part selected.';
    const portName = vals.portName.trim();
    const portType = vals.portType.trim();
    if (!portName) return 'Port name cannot be empty.';
    if (!/^\w+$/.test(portName)) return 'Port name must be a single word.';
    if (!portType) return 'Port type cannot be empty.';
    if (!/^\w+$/.test(portType)) return 'Port type must be a single word.';
    // Check duplicate port name within the part
    const existing = partDefs
      .find(p => p.name === selectedPartName)
      ?.body.filter((b): b is PortN => b.kind === 'port')
      .map(p => p.name) ?? [];
    if (existing.includes(portName)) return `Port "${portName}" already exists in ${selectedPartName}.`;
    // Check that part def has block form
    const srcLine = source.split('\n')[
      (partDefs.find(p => p.name === selectedPartName)?.line ?? 1) - 1
    ];
    if (!/{/.test(srcLine)) return `"${selectedPartName}" must have a block body { }. Convert it first.`;
    apply(
      computeInsertPort(source, result, selectedPartName, vals.direction as 'in' | 'out', portName, portType),
      insertPort(source, result, selectedPartName, vals.direction as 'in' | 'out', portName, portType),
    );
    return null;
  }

  function submitConnection(vals: Record<string, string>): string | null {
    if (!selectedSystemName) return 'No system part selected.';
    const fp = vals.fromPart.trim(), fport = vals.fromPort.trim();
    const tp = vals.toPart.trim(),   tport = vals.toPort.trim();
    if (!fp || !fport || !tp || !tport) return 'All four fields are required.';
    if (!/^\w+$/.test(fp) || !/^\w+$/.test(fport)) return 'From part/port must be single words.';
    if (!/^\w+$/.test(tp) || !/^\w+$/.test(tport)) return 'To part/port must be single words.';
    // Warn if instances not found (non-blocking: parser will warn with squiggles)
    const instNames = new Set(systemInstances.map(a => a.name));
    if (!instNames.has(fp)) return `"${fp}" is not an instance in ${selectedSystemName}.`;
    if (!instNames.has(tp)) return `"${tp}" is not an instance in ${selectedSystemName}.`;
    apply(
      computeInsertConnection(source, result, selectedSystemName, fp, fport, tp, tport),
      insertConnection(source, result, selectedSystemName, fp, fport, tp, tport),
    );
    return null;
  }

  function submitOccurrence(vals: Record<string, string>): string | null {
    const name = vals.name.trim();
    if (!name) return 'Name cannot be empty.';
    if (!/^\w+$/.test(name)) return 'Name must be a single word (letters, digits, _).';
    if (allTopNames.has(name)) return `"${name}" already exists.`;
    apply(computeInsertOccurrence(source, name), insertOccurrence(source, name));
    return null;
  }

  function submitMessage(vals: Record<string, string>): string | null {
    if (!selectedOccName) return 'No occurrence selected.';
    const msgName = vals.msgName.trim();
    const from    = vals.from.trim();
    const to      = vals.to.trim();
    if (!msgName) return 'Message name cannot be empty.';
    if (!/^\w+$/.test(msgName)) return 'Message name must be a single word.';
    if (!from) return '"From" cannot be empty.';
    if (!to)   return '"To" cannot be empty.';
    // Check duplicate message name within the occurrence
    const existing = occDefs
      .find(o => o.name === selectedOccName)
      ?.body.filter((b): b is MsgN => b.kind === 'message')
      .map(m => m.name) ?? [];
    if (existing.includes(msgName)) return `Message "${msgName}" already exists in ${selectedOccName}.`;
    apply(
      computeInsertMessage(source, result, selectedOccName, msgName, from, to),
      insertMessage(source, result, selectedOccName, msgName, from, to),
    );
    return null;
  }

  function submitStateMachine(vals: Record<string, string>): string | null {
    const name = vals.name.trim();
    if (!name) return 'Name cannot be empty.';
    if (!/^\w+$/.test(name)) return 'Name must be a single word.';
    if (allTopNames.has(name)) return `"${name}" already exists.`;
    apply(computeInsertStateDef(source, name), insertStateDef(source, name));
    return null;
  }

  function submitStateEntry(vals: Record<string, string>): string | null {
    if (!selectedSMName) return 'No state machine selected.';
    const name = vals.name.trim();
    if (!name) return 'Name cannot be empty.';
    if (!/^\w+$/.test(name)) return 'Name must be a single word.';
    const existing = smDefs.find(s => s.name === selectedSMName)
      ?.body.filter((b): b is SEntry => b.kind === 'stateEntry').map(s => s.name) ?? [];
    if (existing.includes(name)) return `State "${name}" already exists in ${selectedSMName}.`;
    apply(
      computeInsertStateEntry(source, result, selectedSMName, name),
      insertStateEntry(source, result, selectedSMName, name),
    );
    return null;
  }

  function submitStateTransition(vals: Record<string, string>): string | null {
    if (!selectedSMName) return 'No state machine selected.';
    const from  = vals.from.trim();
    const to    = vals.to.trim();
    const event = vals.event.trim();
    if (!from) return '"From" cannot be empty.';
    if (!to)   return '"To" cannot be empty.';
    if (!/^\w+$/.test(from)) return '"From" must be a single word.';
    if (!/^\w+$/.test(to))   return '"To" must be a single word.';
    const stateNames = new Set(
      smDefs.find(s => s.name === selectedSMName)
        ?.body.filter((b): b is SEntry => b.kind === 'stateEntry').map(s => s.name) ?? [],
    );
    if (stateNames.size > 0 && !stateNames.has(from)) return `"${from}" is not a state in ${selectedSMName}.`;
    if (stateNames.size > 0 && !stateNames.has(to))   return `"${to}" is not a state in ${selectedSMName}.`;
    apply(
      computeInsertStateTransition(source, result, selectedSMName, from, to, event || undefined),
      insertStateTransition(source, result, selectedSMName, from, to, event || undefined),
    );
    return null;
  }

  function submitRequirement(vals: Record<string, string>): string | null {
    const name = vals.name.trim();
    if (!name) return 'Name cannot be empty.';
    if (!/^\w+$/.test(name)) return 'Name must be a single word.';
    if (allTopNames.has(name)) return `"${name}" already exists.`;
    apply(computeInsertRequirementDef(source, name), insertRequirementDef(source, name));
    return null;
  }

  function submitTraceLinkModal(vals: Record<string, string>): string | null {
    const sourceEl  = vals.source.trim();
    const targetReq = vals.target.trim();
    if (!sourceEl)  return 'Source element cannot be empty.';
    if (!targetReq) return 'Target requirement cannot be empty.';
    if (!/^\w+$/.test(sourceEl))  return 'Source must be a single word.';
    if (!/^\w+$/.test(targetReq)) return 'Target must be a single word.';
    const linkType = modal === 'satisfyLink' ? 'satisfy' : modal === 'verifyLink' ? 'verify' : 'trace';
    apply(
      computeInsertTraceLink(source, linkType as 'satisfy' | 'verify' | 'trace', sourceEl, targetReq),
      insertTraceLink(source, linkType as 'satisfy' | 'verify' | 'trace', sourceEl, targetReq),
    );
    return null;
  }

  function submitAddPackage(vals: Record<string, string>): string | null {
    const name = vals.name.trim();
    if (!name) return 'Name cannot be empty.';
    if (!/^\w+$/.test(name)) return 'Name must be a single word (letters, digits, _).';
    if (allTopNames.has(name)) return `"${name}" already exists.`;
    apply(computeInsertPackage(source, name), insertPackage(source, name));
    return null;
  }

  function submitAddToPackage(vals: Record<string, string>): string | null {
    if (!selectedPackagePath) return 'No package selected.';
    const name = vals.name.trim();
    const kind = vals.kind;
    if (!name) return 'Name cannot be empty.';
    if (!/^\w+$/.test(name)) return 'Name must be a single word (letters, digits, _).';
    let elementText: string;
    if (kind === 'part def') {
      elementText = `part def ${name};`;
    } else if (kind === 'requirement def') {
      elementText = `requirement def ${name} {\n  id = "REQ-XXX";\n  text = "";\n  priority = "Medium";\n}`;
    } else if (kind === 'interface def') {
      elementText = `interface def ${name};`;
    } else {
      elementText = `package ${name} {\n}`;
    }
    apply(
      computeInsertElementIntoPackage(source, result, selectedPackagePath, elementText),
      insertElementIntoPackage(source, result, selectedPackagePath, elementText),
    );
    return null;
  }

  // ── SM-related derived data (used in field hints and inspBody) ─────────────

  type SMDef  = Extract<VizNode,{ kind: 'stateDef' }>;
  type SEntry = Extract<VizNode,{ kind: 'stateEntry' }>;
  const smDefs = result.nodes.filter((n): n is SMDef => n.kind === 'stateDef');

  // ── Modal field definitions ─────────────────────────────────────────────────

  const portFields: FieldDef[] = [
    {
      key: 'direction', label: 'Direction', type: 'select',
      options: [{ value: 'in', label: 'in' }, { value: 'out', label: 'out' }],
    },
    {
      key: 'portName', label: 'Port name', type: 'text', placeholder: 'e.g. brakeSignal',
    },
    {
      key: 'portType', label: 'Interface type', type: 'text',
      placeholder: 'e.g. BrakeCommand',
      hint: ifaceNames.length > 0 ? `Available: ${ifaceNames.join(', ')}` : undefined,
    },
  ];

  const instanceHint = systemInstances.length > 0
    ? `Instances: ${systemInstances.map(a => `${a.name} : ${a.type}`).join(', ')}`
    : undefined;

  const connFields: FieldDef[] = [
    { key: 'fromPart', label: 'From part', type: 'text', placeholder: 'e.g. pedal', hint: instanceHint },
    { key: 'fromPort', label: 'From port', type: 'text', placeholder: 'e.g. pedalPosition',
      hint: (() => {
        // No hint needed here — shown on fromPart row
        return undefined;
      })(),
    },
    { key: 'toPart',   label: 'To part',   type: 'text', placeholder: 'e.g. controller' },
    { key: 'toPort',   label: 'To port',   type: 'text', placeholder: 'e.g. pedalPosition' },
  ];

  const smStateHint = selectedSMName
    ? `States: ${(smDefs.find(s => s.name === selectedSMName)
        ?.body.filter((b): b is SEntry => b.kind === 'stateEntry')
        .map(s => s.name) ?? []).join(', ') || 'none'}`
    : undefined;

  const transFields: FieldDef[] = [
    { key: 'from',  label: 'From state', type: 'text', placeholder: 'e.g. Ready',   hint: smStateHint },
    { key: 'to',    label: 'To state',   type: 'text', placeholder: 'e.g. Braking' },
    { key: 'event', label: 'Event (optional)', type: 'text', placeholder: 'e.g. pedalPressed' },
  ];

  type ReqDef = Extract<VizNode,{ kind: 'requirementDef' }>;
  const reqDefs    = result.nodes.filter((n): n is ReqDef => n.kind === 'requirementDef');
  const reqNames   = reqDefs.map(r => r.name);
  const reqNameHint = reqNames.length > 0 ? `Requirements: ${reqNames.join(', ')}` : undefined;

  const SKIP_KINDS = new Set(['requirementDef', 'traceLink', 'package', 'port', 'partAlias', 'connection', 'message', 'actionInst', 'flow', 'stateEntry', 'transition']);
  const allModelNames = result.nodes
    .filter(n => 'name' in n && !SKIP_KINDS.has(n.kind))
    .map(n => (n as { name: string }).name);
  const srcHint = allModelNames.length > 0 ? `Elements: ${allModelNames.join(', ')}` : undefined;

  const traceLinkFields: FieldDef[] = [
    { key: 'source', label: 'Source element',    type: 'text', placeholder: 'e.g. BrakeController', hint: srcHint },
    { key: 'target', label: 'Target requirement', type: 'text', placeholder: 'e.g. BrakeResponseTime', hint: reqNameHint },
  ];

  // ── Actions panel ───────────────────────────────────────────────────────────

  const actionsPanel = (
    <div className="insp-actions">
      <div className="insp-section-label" style={{ padding: '10px 14px 4px' }}>Add Element</div>
      <div className="action-btn-grid">
        <ActionBtn label="Interface"    onClick={() => setModal('interface')} />
        <ActionBtn label="Part Def"     onClick={() => setModal('partDef')} />
        <ActionBtn label="Occurrence"   onClick={() => setModal('occurrence')} />
        <ActionBtn
          label="Port"
          onClick={() => setModal('port')}
          disabled={!selectedPartName}
          title={selectedPartName ? `Add port to ${selectedPartName}` : 'Select a part def first'}
        />
        <ActionBtn
          label="Connection"
          onClick={() => setModal('connection')}
          disabled={!selectedSystemName}
          title={selectedSystemName ? `Add connection to ${selectedSystemName}` : 'Select a system part first'}
        />
        <ActionBtn
          label="Message"
          onClick={() => setModal('message')}
          disabled={!selectedOccName}
          title={selectedOccName ? `Add message to ${selectedOccName}` : 'Select an occurrence first'}
        />
        <ActionBtn label="State Machine" onClick={() => setModal('stateMachine')} />
        <ActionBtn
          label="State"
          onClick={() => setModal('stateEntry')}
          disabled={!selectedSMName}
          title={selectedSMName ? `Add state to ${selectedSMName}` : 'Select a state machine first'}
        />
        <ActionBtn
          label="Transition"
          onClick={() => setModal('stateTransition')}
          disabled={!selectedSMName}
          title={selectedSMName ? `Add transition to ${selectedSMName}` : 'Select a state machine first'}
        />
        <ActionBtn label="Requirement" onClick={() => setModal('requirement')} />
        <ActionBtn label="Satisfy Link" onClick={() => setModal('satisfyLink')} />
        <ActionBtn label="Verify Link"  onClick={() => setModal('verifyLink')} />
        <ActionBtn label="Trace Link"   onClick={() => setModal('traceLink')} />
        <ActionBtn label="Package"      onClick={() => setModal('addPackage')} />
        <ActionBtn
          label="Add to Package"
          onClick={() => setModal('addToPackage')}
          disabled={!selectedPackagePath}
          title={selectedPackagePath ? `Add element into ${selectedPackagePath}` : 'Select a package first'}
        />
      </div>
    </div>
  );

  // ── Modals ──────────────────────────────────────────────────────────────────

  const modals = (
    <>
      {modal === 'interface' && (
        <ActionModal
          title="Add Interface"
          fields={[{ key: 'name', label: 'Name', type: 'text', placeholder: 'e.g. DataSignal' }]}
          onSubmit={submitInterface}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'partDef' && (
        <ActionModal
          title="Add Part Definition"
          fields={[{ key: 'name', label: 'Name', type: 'text', placeholder: 'e.g. WheelSensor' }]}
          onSubmit={submitPartDef}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'port' && selectedPartName && (
        <ActionModal
          title={`Add Port to ${selectedPartName}`}
          fields={portFields}
          onSubmit={submitPort}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'connection' && selectedSystemName && (
        <ActionModal
          title={`Add Connection to ${selectedSystemName}`}
          fields={connFields}
          onSubmit={submitConnection}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'occurrence' && (
        <ActionModal
          title="Add Occurrence"
          fields={[{ key: 'name', label: 'Name', type: 'text', placeholder: 'e.g. NormalOp' }]}
          onSubmit={submitOccurrence}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'message' && selectedOccName && (
        <ActionModal
          title={`Add Message to ${selectedOccName}`}
          fields={[
            { key: 'msgName', label: 'Message name', type: 'text', placeholder: 'e.g. dataRequest' },
            { key: 'from',    label: 'From',         type: 'text', placeholder: 'e.g. Sensor' },
            { key: 'to',      label: 'To',           type: 'text', placeholder: 'e.g. Controller' },
          ]}
          onSubmit={submitMessage}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'stateMachine' && (
        <ActionModal
          title="Add State Machine"
          fields={[{ key: 'name', label: 'Name', type: 'text', placeholder: 'e.g. SystemSM' }]}
          onSubmit={submitStateMachine}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'stateEntry' && selectedSMName && (
        <ActionModal
          title={`Add State to ${selectedSMName}`}
          fields={[{ key: 'name', label: 'State name', type: 'text', placeholder: 'e.g. Ready' }]}
          onSubmit={submitStateEntry}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'stateTransition' && selectedSMName && (
        <ActionModal
          title={`Add Transition to ${selectedSMName}`}
          fields={transFields}
          onSubmit={submitStateTransition}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'requirement' && (
        <ActionModal
          title="Add Requirement"
          fields={[{ key: 'name', label: 'Name', type: 'text', placeholder: 'e.g. BrakeResponseTime' }]}
          onSubmit={submitRequirement}
          onClose={() => setModal(null)}
        />
      )}
      {(modal === 'satisfyLink' || modal === 'verifyLink' || modal === 'traceLink') && (
        <ActionModal
          title={modal === 'satisfyLink' ? 'Add Satisfy Link' : modal === 'verifyLink' ? 'Add Verify Link' : 'Add Trace Link'}
          fields={traceLinkFields}
          onSubmit={submitTraceLinkModal}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'addPackage' && (
        <ActionModal
          title="Add Package"
          fields={[{ key: 'name', label: 'Package name', type: 'text', placeholder: 'e.g. Sensors' }]}
          onSubmit={submitAddPackage}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'addToPackage' && selectedPackagePath && (
        <ActionModal
          title={`Add Element to ${selectedPackagePath}`}
          fields={[
            {
              key: 'kind', label: 'Element type', type: 'select',
              options: [
                { value: 'part def',       label: 'part def' },
                { value: 'interface def',  label: 'interface def' },
                { value: 'requirement def',label: 'requirement def' },
                { value: 'package',        label: 'sub-package' },
              ],
            },
            { key: 'name', label: 'Name', type: 'text', placeholder: 'e.g. PressureSensor' },
          ]}
          onSubmit={submitAddToPackage}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );

  // ── Inspector body ──────────────────────────────────────────────────────────

  type BehDef   = Extract<VizNode,{ kind: 'behaviorDef' }>;
  type AInstN   = Extract<VizNode,{ kind: 'actionInst' }>;

  const behaviorDefs = result.nodes.filter((n): n is BehDef => n.kind === 'behaviorDef');

  const stereotypeMap: Record<NonNullable<SelectionState>['type'], string> = {
    interface:       '«interface def»',
    part:            '«part def»',
    port:            'port',
    systemPart:      '«part def»',
    instance:        'part instance',
    occurrence:      '«occurrence def»',
    message:         'message',
    connection:      'connection',
    action:          '«action def»',
    behavior:        '«behavior def»',
    actionInst:      'action instance',
    behaviorFlow:    'flow',
    stateMachine:    '«state def»',
    stateEntry:      'state',
    stateTransition: 'transition',
    requirement:     '«requirement def»',
    traceLink:       'trace link',
    packageDef:      '«package»',
    condition:       '«condition»',
  };

  let inspBody: React.ReactNode = null;

  if (selection) {
    if (selection.type === 'part') {
      const def   = partDefs.find(n => n.name === selection.name);
      const ports = def?.body.filter((b): b is PortN => b.kind === 'port') ?? [];
      inspBody = ports.length > 0 && (
        <div className="insp-section">
          <div className="insp-section-label">Ports ({ports.length})</div>
          {ports.map(p => (
            <div key={p.name} className="insp-port-row">
              <span className="insp-port-dir">{p.direction === 'in' ? '◂' : '▸'}</span>
              <span className="insp-port-name">{p.name}</span>
              <span className="insp-port-type">: {p.portType}</span>
            </div>
          ))}
        </div>
      );

    } else if (selection.type === 'port') {
      inspBody = (
        <div className="insp-section">
          {selection.extra?.direction && <KV label="Direction"  value={selection.extra.direction} />}
          {selection.extra?.portType  && <KV label="Type"       value={selection.extra.portType} />}
          {selection.extra?.partDef   && <KV label="Defined in" value={selection.extra.partDef} />}
        </div>
      );

    } else if (selection.type === 'systemPart') {
      const def     = partDefs.find(n => n.name === selection.name);
      const aliases = def?.body.filter((b): b is AliasN => b.kind === 'partAlias') ?? [];
      const conns   = def?.body.filter((b): b is ConnN  => b.kind === 'connection') ?? [];
      inspBody = (
        <>
          {aliases.length > 0 && (
            <div className="insp-section">
              <div className="insp-section-label">Parts ({aliases.length})</div>
              {aliases.map(a => (
                <div key={a.name} className="insp-detail-row">
                  <span className="insp-detail-name">{a.name}</span>
                  <span className="insp-detail-type"> : {a.type}</span>
                </div>
              ))}
            </div>
          )}
          {conns.length > 0 && (
            <div className="insp-section">
              <div className="insp-section-label">Connections ({conns.length})</div>
              {conns.map((c, i) => (
                <div key={i} className="insp-detail-row">
                  <span className="insp-detail-conn">
                    {c.fromPart}.{c.fromPort} → {c.toPart}.{c.toPort}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      );

    } else if (selection.type === 'instance') {
      const instType = selection.extra?.type;
      const instDef  = instType ? partDefMap.get(instType) : undefined;
      const ports    = instDef?.body.filter((b): b is PortN => b.kind === 'port') ?? [];
      inspBody = (
        <>
          <div className="insp-section">
            {selection.extra?.type   && <KV label="Type"    value={selection.extra.type} />}
            {selection.extra?.parent && <KV label="Part of" value={selection.extra.parent} />}
          </div>
          {ports.length > 0 && (
            <div className="insp-section">
              <div className="insp-section-label">Ports ({ports.length})</div>
              {ports.map(p => (
                <div key={p.name} className="insp-port-row">
                  <span className="insp-port-dir">{p.direction === 'in' ? '◂' : '▸'}</span>
                  <span className="insp-port-name">{p.name}</span>
                  <span className="insp-port-type">: {p.portType}</span>
                </div>
              ))}
            </div>
          )}
        </>
      );

    } else if (selection.type === 'occurrence') {
      const occ  = occDefs.find(n => n.name === selection.name);
      const msgs = occ?.body.filter((b): b is MsgN => b.kind === 'message') ?? [];
      inspBody = msgs.length > 0 && (
        <div className="insp-section">
          <div className="insp-section-label">Messages ({msgs.length})</div>
          {msgs.map((m, i) => (
            <div key={i} className="insp-detail-row">
              <span className="insp-detail-idx">{i + 1}.</span>
              <span className="insp-detail-name"> {m.name}</span>
              <span className="insp-detail-type"> {m.from} → {m.to}</span>
            </div>
          ))}
        </div>
      );

    } else if (selection.type === 'message') {
      inspBody = (
        <div className="insp-section">
          {selection.extra?.from       && <KV label="From" value={selection.extra.from} />}
          {selection.extra?.to         && <KV label="To"   value={selection.extra.to} />}
          {selection.extra?.occurrence && <KV label="In"   value={selection.extra.occurrence} />}
        </div>
      );

    } else if (selection.type === 'connection') {
      const from = selection.extra
        ? `${selection.extra.fromPart}.${selection.extra.fromPort}` : '';
      const to = selection.extra
        ? `${selection.extra.toPart}.${selection.extra.toPort}` : '';
      inspBody = (
        <div className="insp-section">
          {from && <KV label="From" value={from} />}
          {to   && <KV label="To"   value={to} />}
          {selection.extra?.parent && <KV label="In" value={selection.extra.parent} />}
        </div>
      );

    } else if (selection.type === 'behavior') {
      const beh      = behaviorDefs.find(b => b.name === selection.name);
      const actions  = beh?.body.filter((b): b is AInstN => b.kind === 'actionInst') ?? [];
      const flows    = beh?.body.filter(b => b.kind === 'flow') ?? [];
      inspBody = (
        <>
          <div className="insp-section">
            <KV label="Actions" value={String(actions.length)} />
            <KV label="Flows"   value={String(flows.length)} />
          </div>
          {actions.length > 0 && (
            <div className="insp-section">
              <div className="insp-section-label">Action Instances</div>
              {actions.map(a => (
                <div key={a.name} className="insp-detail-row">
                  <span className="insp-detail-name">{a.name}</span>
                  <span className="insp-detail-type"> : {a.actionType}</span>
                </div>
              ))}
            </div>
          )}
        </>
      );

    } else if (selection.type === 'action') {
      inspBody = null;

    } else if (selection.type === 'actionInst') {
      const outgoingTargets = selection.extra?.outgoingTargets
        ? selection.extra.outgoingTargets.split(',').filter(Boolean)
        : [];
      inspBody = (
        <>
          <div className="insp-section">
            {selection.extra?.actionType && <KV label="Type"     value={selection.extra.actionType} />}
            {selection.extra?.behavior   && <KV label="Behavior" value={selection.extra.behavior} />}
          </div>
          {outgoingTargets.length > 0 && (
            <div className="insp-section">
              <div className="insp-section-label">Flows to ({outgoingTargets.length})</div>
              {outgoingTargets.map(t => (
                <div key={t} className="insp-detail-row">
                  <span style={{ fontSize: 10, color: '#fbbf24', marginRight: 4 }}>→</span>
                  <span className="insp-detail-name">{t}</span>
                </div>
              ))}
            </div>
          )}
        </>
      );

    } else if (selection.type === 'behaviorFlow') {
      inspBody = (
        <div className="insp-section">
          {selection.extra?.from     && <KV label="From"     value={selection.extra.from} />}
          {selection.extra?.to       && <KV label="To"       value={selection.extra.to} />}
          {selection.extra?.behavior && <KV label="Behavior" value={selection.extra.behavior} />}
        </div>
      );

    } else if (selection.type === 'stateMachine') {
      const sm     = smDefs.find(s => s.name === selection.name);
      const states = sm?.body.filter((b): b is SEntry => b.kind === 'stateEntry') ?? [];
      const trans  = sm?.body.filter(b => b.kind === 'transition') ?? [];
      inspBody = (
        <>
          <div className="insp-section">
            <KV label="States"      value={String(states.length)} />
            <KV label="Transitions" value={String(trans.length)} />
          </div>
          {states.length > 0 && (
            <div className="insp-section">
              <div className="insp-section-label">States</div>
              {states.map(s => (
                <div key={s.name} className="insp-detail-row">
                  <span className="insp-detail-name">{s.name}</span>
                </div>
              ))}
            </div>
          )}
        </>
      );

    } else if (selection.type === 'stateEntry') {
      inspBody = (
        <div className="insp-section">
          {selection.extra?.stateMachine && <KV label="State machine" value={selection.extra.stateMachine} />}
        </div>
      );

    } else if (selection.type === 'stateTransition') {
      inspBody = (
        <div className="insp-section">
          {selection.extra?.from         && <KV label="From"          value={selection.extra.from} />}
          {selection.extra?.to           && <KV label="To"            value={selection.extra.to} />}
          {selection.extra?.event        && <KV label="Event"         value={selection.extra.event} />}
          {selection.extra?.stateMachine && <KV label="State machine" value={selection.extra.stateMachine} />}
        </div>
      );

    } else if (selection.type === 'requirement') {
      const req     = reqDefs.find(r => r.name === selection.name);
      type TL       = Extract<VizNode,{ kind: 'traceLink' }>;
      const inLinks = result.nodes.filter((n): n is TL => n.kind === 'traceLink' && n.target === selection.name);
      inspBody = (
        <>
          <div className="insp-section">
            {(req?.reqId    || selection.extra?.reqId)    && <KV label="ID"       value={req?.reqId    ?? selection.extra?.reqId    ?? ''} />}
            {(req?.priority || selection.extra?.priority) && <KV label="Priority" value={req?.priority ?? selection.extra?.priority ?? ''} />}
          </div>
          {(req?.text || selection.extra?.text) && (
            <div className="insp-section">
              <div className="insp-section-label">Text</div>
              <div className="insp-req-text">{req?.text ?? selection.extra?.text}</div>
            </div>
          )}
          {inLinks.length > 0 && (
            <div className="insp-section">
              <div className="insp-section-label">Traced By ({inLinks.length})</div>
              {inLinks.map((l, i) => (
                <div key={i} className="insp-detail-row">
                  <span className={`insp-link-type insp-link-${l.linkType}`}>{l.linkType}</span>
                  <span className="insp-detail-name"> {l.source}</span>
                </div>
              ))}
            </div>
          )}
        </>
      );

    } else if (selection.type === 'traceLink') {
      inspBody = (
        <div className="insp-section">
          {selection.extra?.linkType && <KV label="Type"   value={selection.extra.linkType} />}
          {selection.extra?.source   && <KV label="Source" value={selection.extra.source} />}
          {selection.extra?.target   && <KV label="Target" value={selection.extra.target} />}
        </div>
      );

    } else if (selection.type === 'packageDef') {
      function findPkgNode(pkgs: VizPackageNode[], name: string, ns: string): VizPackageNode | undefined {
        for (const p of pkgs) {
          if (p.name === name && p.namespace === ns) return p;
          const nested = p.body.filter((n): n is VizPackageNode => n.kind === 'packageDef');
          const found  = findPkgNode(nested, name, ns);
          if (found) return found;
        }
        return undefined;
      }
      const pkgNode = findPkgNode(result.packages, selection.name, selection.extra?.namespace ?? '');
      const childPkgs  = pkgNode?.body.filter(n => n.kind === 'packageDef').length ?? 0;
      const childElems = pkgNode?.body.filter(n => n.kind !== 'packageDef').length ?? 0;
      const qualName   = selection.extra?.qualifiedName ?? selection.name;
      inspBody = (
        <div className="insp-section">
          <KV label="Qualified name" value={qualName} />
          {childPkgs  > 0 && <KV label="Sub-packages" value={String(childPkgs)} />}
          {childElems > 0 && <KV label="Elements"     value={String(childElems)} />}
        </div>
      );
    }
  }

  // ── Related diagnostics ─────────────────────────────────────────────────────

  const relatedDiags: VizDiagnostic[] = (() => {
    if (!selection) return [];
    const lines = elementLines(
      selection.name,
      selection.extra?.namespace,
      result.nodes,
      result.packages,
    );
    return result.diagnostics.filter(d => lines.has(d.line));
  })();

  // ── Health summary (shown when nothing selected) ────────────────────────────

  const errCount  = result.diagnostics.filter(d => d.severity === 'error').length;
  const warnCount = result.diagnostics.filter(d => d.severity === 'warning').length;
  const infoCount = result.diagnostics.filter(d => d.severity === 'info').length;

  return (
    <div className="panel inspector-panel">
      <div className="panel-header">
        Inspector
        {onCollapse && (
          <button className="panel-toggle-btn" onClick={onCollapse} title="Collapse">▶</button>
        )}
      </div>

      {actionsPanel}

      {selection ? (
        <>
          <div className="insp-section insp-selection-hdr">
            <div className="insp-stereotype">{stereotypeMap[selection.type]}</div>
            <div className="insp-name">{selection.name}</div>
          </div>
          {inspBody}
          {impactTrace && <ImpactSection trace={impactTrace} onSelect={onSelect} />}
          {trlcData && selection && <TrlcSection elementName={selection.name} trlcData={trlcData} onSelect={onSelect} />}
          {relatedDiags.length > 0 && (
            <div className="insp-section">
              <div className="insp-section-label">Diagnostics ({relatedDiags.length})</div>
              {relatedDiags.map((d, i) => (
                <div key={i} className={`insp-diag-row insp-diag-${d.severity}`}>
                  {d.code && <span className="insp-diag-code">{d.code}</span>}
                  <span className="insp-diag-msg">{d.message}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="insp-health">
          <div className="insp-health-title">Model Health</div>
          <div className="insp-health-grid">
            <div className="insp-health-stat">
              <span className="insp-health-num insp-health-num-elem">{result.nodes.length}</span>
              <span className="insp-health-label">elements</span>
            </div>
            <div className="insp-health-stat">
              <span className={`insp-health-num insp-health-num-err${errCount > 0 ? ' active' : ''}`}>{errCount}</span>
              <span className="insp-health-label">errors</span>
            </div>
            <div className="insp-health-stat">
              <span className={`insp-health-num insp-health-num-warn${warnCount > 0 ? ' active' : ''}`}>{warnCount}</span>
              <span className="insp-health-label">warnings</span>
            </div>
            <div className="insp-health-stat">
              <span className={`insp-health-num insp-health-num-info${infoCount > 0 ? ' active' : ''}`}>{infoCount}</span>
              <span className="insp-health-label">info</span>
            </div>
          </div>
          <div className="insp-health-hint">Click any element to inspect it.</div>
        </div>
      )}

      {modals}
    </div>
  );
}

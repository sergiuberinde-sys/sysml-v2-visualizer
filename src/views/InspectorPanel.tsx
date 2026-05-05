import { useState } from 'react';
import type { SelectionState, ParseResult, SysMLNode } from '../types';
import ActionModal, { type FieldDef } from './ActionModal';
import {
  insertInterface, insertPartDef, insertPort,
  insertConnection, insertOccurrence, insertMessage,
} from '../insertions';

interface Props {
  selection: SelectionState;
  result: ParseResult;
  source: string;
  onSourceChange: (s: string) => void;
}

// ── Modal discriminant ────────────────────────────────────────────────────────

type ModalKind =
  | 'interface' | 'partDef' | 'port' | 'connection' | 'occurrence' | 'message' | null;

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

// ── Main component ────────────────────────────────────────────────────────────

export default function InspectorPanel({ selection, result, source, onSourceChange }: Props) {
  const [modal, setModal] = useState<ModalKind>(null);

  // ── Derived model data for validation ──────────────────────────────────────

  type PD = Extract<SysMLNode, { kind: 'partDef' }>;
  type OD = Extract<SysMLNode, { kind: 'occurrenceDef' }>;
  type PortN  = Extract<SysMLNode, { kind: 'port' }>;
  type AliasN = Extract<SysMLNode, { kind: 'partAlias' }>;
  type ConnN  = Extract<SysMLNode, { kind: 'connection' }>;
  type MsgN   = Extract<SysMLNode, { kind: 'message' }>;

  const partDefs = result.nodes.filter((n): n is PD => n.kind === 'partDef');
  const occDefs  = result.nodes.filter((n): n is OD => n.kind === 'occurrenceDef');

  const allTopNames = new Set(
    result.nodes
      .filter(n => 'name' in n)
      .map(n => (n as { name: string }).name),
  );

  const selectedPartName   = selection?.type === 'part'       ? selection.name : null;
  const selectedSystemName = selection?.type === 'systemPart' ? selection.name : null;
  const selectedOccName    = selection?.type === 'occurrence'  ? selection.name : null;

  // Interfaces for type hints
  const ifaceNames = result.nodes
    .filter(n => n.kind === 'interfaceDef')
    .map(n => (n as Extract<SysMLNode, { kind: 'interfaceDef' }>).name);

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
    onSourceChange(insertInterface(source, result, name));
    return null;
  }

  function submitPartDef(vals: Record<string, string>): string | null {
    const name = vals.name.trim();
    if (!name) return 'Name cannot be empty.';
    if (!/^\w+$/.test(name)) return 'Name must be a single word (letters, digits, _).';
    if (allTopNames.has(name)) return `"${name}" already exists.`;
    onSourceChange(insertPartDef(source, result, name));
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
    onSourceChange(insertPort(source, result, selectedPartName, vals.direction as 'in' | 'out', portName, portType));
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
    onSourceChange(insertConnection(source, result, selectedSystemName, fp, fport, tp, tport));
    return null;
  }

  function submitOccurrence(vals: Record<string, string>): string | null {
    const name = vals.name.trim();
    if (!name) return 'Name cannot be empty.';
    if (!/^\w+$/.test(name)) return 'Name must be a single word (letters, digits, _).';
    if (allTopNames.has(name)) return `"${name}" already exists.`;
    onSourceChange(insertOccurrence(source, name));
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
    onSourceChange(insertMessage(source, result, selectedOccName, msgName, from, to));
    return null;
  }

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

  // ── Actions panel ───────────────────────────────────────────────────────────

  const actionsPanel = (
    <div className="insp-actions">
      <div className="insp-section-label" style={{ padding: '10px 14px 4px' }}>Add Element</div>
      <div className="action-btn-grid">
        <ActionBtn label="Interface"  onClick={() => setModal('interface')} />
        <ActionBtn label="Part Def"   onClick={() => setModal('partDef')} />
        <ActionBtn label="Occurrence" onClick={() => setModal('occurrence')} />
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
    </>
  );

  // ── Inspector body ──────────────────────────────────────────────────────────

  const stereotypeMap: Record<NonNullable<SelectionState>['type'], string> = {
    interface:  '«interface def»',
    part:       '«part def»',
    port:       'port',
    systemPart: '«part def»',
    instance:   'part instance',
    occurrence: '«occurrence def»',
    message:    'message',
    connection: 'connection',
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
    }
  }

  return (
    <div className="panel inspector-panel">
      <div className="panel-header">Inspector</div>

      {actionsPanel}

      {selection ? (
        <>
          <div className="insp-section insp-selection-hdr">
            <div className="insp-stereotype">{stereotypeMap[selection.type]}</div>
            <div className="insp-name">{selection.name}</div>
          </div>
          {inspBody}
        </>
      ) : (
        <div className="insp-empty">Click any element to inspect it.</div>
      )}

      {modals}
    </div>
  );
}

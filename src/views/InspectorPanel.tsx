import type { SelectionState, ParseResult, SysMLNode } from '../types';

interface Props {
  selection: SelectionState;
  result: ParseResult;
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="insp-row">
      <span className="insp-label">{label}</span>
      <span className="insp-value">{value}</span>
    </div>
  );
}

export default function InspectorPanel({ selection, result }: Props) {
  if (!selection) {
    return (
      <div className="panel inspector-panel">
        <div className="panel-header">Inspector</div>
        <div className="insp-empty">Click any element to inspect it.</div>
      </div>
    );
  }

  type PD = Extract<SysMLNode, { kind: 'partDef' }>;
  type OD = Extract<SysMLNode, { kind: 'occurrenceDef' }>;
  const partDefs = result.nodes.filter((n): n is PD => n.kind === 'partDef');
  const occDefs  = result.nodes.filter((n): n is OD => n.kind === 'occurrenceDef');

  type PortN = Extract<SysMLNode, { kind: 'port' }>;
  type AliasN = Extract<SysMLNode, { kind: 'partAlias' }>;
  type ConnN  = Extract<SysMLNode, { kind: 'connection' }>;
  type MsgN   = Extract<SysMLNode, { kind: 'message' }>;

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

  let body: React.ReactNode = null;

  if (selection.type === 'part') {
    const def   = partDefs.find(n => n.name === selection.name);
    const ports = def?.body.filter((b): b is PortN => b.kind === 'port') ?? [];
    body = ports.length > 0 && (
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
    body = (
      <div className="insp-section">
        {selection.extra?.direction && <KV label="Direction" value={selection.extra.direction} />}
        {selection.extra?.portType  && <KV label="Type"      value={selection.extra.portType} />}
        {selection.extra?.partDef   && <KV label="Defined in" value={selection.extra.partDef} />}
      </div>
    );

  } else if (selection.type === 'systemPart') {
    const def     = partDefs.find(n => n.name === selection.name);
    const aliases = def?.body.filter((b): b is AliasN => b.kind === 'partAlias') ?? [];
    const conns   = def?.body.filter((b): b is ConnN  => b.kind === 'connection') ?? [];
    body = (
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
    body = (
      <div className="insp-section">
        {selection.extra?.type   && <KV label="Type"    value={selection.extra.type} />}
        {selection.extra?.parent && <KV label="Part of" value={selection.extra.parent} />}
      </div>
    );

  } else if (selection.type === 'occurrence') {
    const occ  = occDefs.find(n => n.name === selection.name);
    const msgs = occ?.body.filter((b): b is MsgN => b.kind === 'message') ?? [];
    body = msgs.length > 0 && (
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
    body = (
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
    body = (
      <div className="insp-section">
        {from && <KV label="From" value={from} />}
        {to   && <KV label="To"   value={to} />}
        {selection.extra?.parent && <KV label="In" value={selection.extra.parent} />}
      </div>
    );
  }

  return (
    <div className="panel inspector-panel">
      <div className="panel-header">Inspector</div>
      <div className="insp-section">
        <div className="insp-stereotype">{stereotypeMap[selection.type]}</div>
        <div className="insp-name">{selection.name}</div>
      </div>
      {body}
    </div>
  );
}

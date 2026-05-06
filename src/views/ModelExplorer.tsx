import { useState } from 'react';
import type { ParseResult, SysMLNode, SelectionState } from '../types';

type ViewTab = 'structure' | 'sequence' | 'json' | 'behavior';

interface Props {
  result: ParseResult;
  selectedOccurrence: string;
  selectedBehavior: string;
  selection: SelectionState;
  onSelectScenario: (name: string) => void;
  onSelectBehavior: (name: string) => void;
  onSelect: (s: SelectionState) => void;
  onNavigate: (tab: ViewTab) => void;
}

type IfaceDef    = Extract<SysMLNode, { kind: 'interfaceDef' }>;
type PartDef     = Extract<SysMLNode, { kind: 'partDef' }>;
type OccDef      = Extract<SysMLNode, { kind: 'occurrenceDef' }>;
type PortNode    = Extract<SysMLNode, { kind: 'port' }>;
type AliasNode   = Extract<SysMLNode, { kind: 'partAlias' }>;
type ConnNode    = Extract<SysMLNode, { kind: 'connection' }>;
type ActionDef   = Extract<SysMLNode, { kind: 'actionDef' }>;
type BehaviorDef = Extract<SysMLNode, { kind: 'behaviorDef' }>;
type ActionInst  = Extract<SysMLNode, { kind: 'actionInst' }>;

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ label, count, open, onToggle }: {
  label: string; count: number; open: boolean; onToggle: () => void;
}) {
  return (
    <div className="expl-section-hdr" onClick={onToggle} title={`${open ? 'Collapse' : 'Expand'} ${label}`}>
      <span className="expl-chevron">{open ? '▾' : '▸'}</span>
      <span className="expl-section-label">{label}</span>
      <span className="expl-count">{count}</span>
    </div>
  );
}

function SubItem({ icon, text, dim, onClick, selected }: {
  icon: string; text: string; dim?: string;
  onClick?: () => void; selected?: boolean;
}) {
  return (
    <div
      className={`expl-subitem${onClick ? ' expl-subitem-btn' : ''}${selected ? ' expl-selected' : ''}`}
      onClick={onClick}
    >
      <span className="expl-icon-sub">{icon}</span>
      <span className="expl-subname">{text}</span>
      {dim && <span className="expl-subtype">{dim}</span>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ModelExplorer({
  result, selectedOccurrence, selectedBehavior, selection,
  onSelectScenario, onSelectBehavior, onSelect, onNavigate,
}: Props) {
  const [open, setOpen] = useState<Set<string>>(
    new Set(['interfaces', 'partTypes', 'system', 'scenarios', 'actions', 'behaviors']),
  );

  function toggle(id: string) {
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pkg = result.nodes.find(n => n.kind === 'package') as
    Extract<SysMLNode, { kind: 'package' }> | undefined;

  const ifaceDefs    = result.nodes.filter((n): n is IfaceDef => n.kind === 'interfaceDef');
  const allPartDefs  = result.nodes.filter((n): n is PartDef  => n.kind === 'partDef');
  const typePartDefs = allPartDefs.filter(n => !n.body.some(b => b.kind === 'partAlias'));
  const composedDefs = allPartDefs.filter(n =>  n.body.some(b => b.kind === 'partAlias'));

  const allOccs          = result.nodes.filter((n): n is OccDef => n.kind === 'occurrenceDef');
  const legacyStructOccs = allOccs.filter(o => o.body.some(b => b.kind === 'partAlias'));
  const scenarios        = allOccs.filter(o => o.body.some(b => b.kind === 'message'));

  const actionDefs  = result.nodes.filter((n): n is ActionDef   => n.kind === 'actionDef');
  const behaviorDefs = result.nodes.filter((n): n is BehaviorDef => n.kind === 'behaviorDef');

  const isEmpty = ifaceDefs.length === 0 && allPartDefs.length === 0 && allOccs.length === 0
    && actionDefs.length === 0 && behaviorDefs.length === 0;

  const sel = (id: string) => selection?.id === id;

  return (
    <div className="panel explorer-panel">
      <div className="panel-header">Model Explorer</div>

      {pkg && (
        <div className="expl-package">
          <span className="expl-pkg-icon">⬡</span>
          <span className="expl-pkg-name">{pkg.name}</span>
        </div>
      )}

      {isEmpty ? (
        <div className="expl-empty">Nothing to show yet.</div>
      ) : (
        <div className="expl-tree">

          {/* ── Interfaces ── */}
          {ifaceDefs.length > 0 && (
            <div className="expl-section">
              <SectionHeader
                label="Interfaces" count={ifaceDefs.length}
                open={open.has('interfaces')} onToggle={() => toggle('interfaces')}
              />
              {open.has('interfaces') && ifaceDefs.map(n => (
                <div key={n.name}
                  className={`expl-item expl-item-iface${sel('iface-' + n.name) ? ' expl-selected' : ''}`}
                  title={`interface def ${n.name}  (line ${n.line})`}
                  onClick={() => {
                    onSelect({ id: `iface-${n.name}`, type: 'interface', name: n.name });
                    onNavigate('structure');
                  }}>
                  <span className="expl-icon">◈</span>
                  <span className="expl-name">{n.name}</span>
                  <span className="expl-tag expl-tag-iface">iface</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Part Type Definitions ── */}
          {typePartDefs.length > 0 && (
            <div className="expl-section">
              <SectionHeader
                label="Part Types" count={typePartDefs.length}
                open={open.has('partTypes')} onToggle={() => toggle('partTypes')}
              />
              {open.has('partTypes') && typePartDefs.map(n => {
                const ports  = n.body.filter((b): b is PortNode => b.kind === 'port');
                const subId  = `pd-${n.name}`;
                const isOpen = open.has(subId);
                return (
                  <div key={n.name}>
                    <div
                      className={`expl-item expl-item-partdef${sel('def-' + n.name) ? ' expl-selected' : ''}`}
                      title={`part def ${n.name}  (line ${n.line})`}
                      onClick={() => {
                        if (ports.length) toggle(subId);
                        onSelect({ id: `def-${n.name}`, type: 'part', name: n.name });
                        onNavigate('structure');
                      }}>
                      {ports.length > 0
                        ? <span className="expl-chevron-inline">{isOpen ? '▾' : '▸'}</span>
                        : <span style={{ width: 12, display: 'inline-block' }} />}
                      <span className="expl-icon">■</span>
                      <span className="expl-name">{n.name}</span>
                      {ports.length > 0 && (
                        <span className="expl-tag expl-tag-port">{ports.length}p</span>
                      )}
                    </div>
                    {isOpen && ports.map(p => (
                      <SubItem
                        key={p.name}
                        icon={p.direction === 'in' ? '◂' : '▸'}
                        text={p.name}
                        dim={`: ${p.portType}`}
                        selected={sel(`port-${n.name}-${p.name}`)}
                        onClick={() => onSelect({
                          id: `port-${n.name}-${p.name}`,
                          type: 'port',
                          name: p.name,
                          extra: { direction: p.direction, portType: p.portType, partDef: n.name },
                        })}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── System Parts (composed part defs) ── */}
          {(composedDefs.length > 0 || legacyStructOccs.length > 0) && (
            <div className="expl-section">
              <SectionHeader
                label="System Parts" count={composedDefs.length + legacyStructOccs.length}
                open={open.has('system')} onToggle={() => toggle('system')}
              />
              {open.has('system') && (
                <>
                  {composedDefs.map(n => {
                    const aliases     = n.body.filter((b): b is AliasNode => b.kind === 'partAlias');
                    const connections = n.body.filter((b): b is ConnNode  => b.kind === 'connection');
                    const subId  = `sys-${n.name}`;
                    const isOpen = open.has(subId);
                    return (
                      <div key={n.name}>
                        <div
                          className={`expl-item expl-item-occ${sel('grp-' + n.name) ? ' expl-selected' : ''}`}
                          title={`part def ${n.name}  (line ${n.line})`}
                          onClick={() => {
                            toggle(subId);
                            onSelect({ id: `grp-${n.name}`, type: 'systemPart', name: n.name });
                            onNavigate('structure');
                          }}>
                          <span className="expl-chevron-inline">{isOpen ? '▾' : '▸'}</span>
                          <span className="expl-icon expl-icon-occ">◇</span>
                          <span className="expl-name">{n.name}</span>
                          <span className="expl-tag expl-tag-occ">{aliases.length}p</span>
                          {connections.length > 0 && (
                            <span className="expl-tag expl-tag-conn" style={{ marginLeft: 2 }}>{connections.length}c</span>
                          )}
                        </div>
                        {isOpen && (
                          <>
                            {aliases.map(a => (
                              <SubItem
                                key={a.name}
                                icon="·"
                                text={a.name}
                                dim={`: ${a.type}`}
                                selected={sel(`inst-${n.name}-${a.name}`)}
                                onClick={() => onSelect({
                                  id: `inst-${n.name}-${a.name}`,
                                  type: 'instance',
                                  name: a.name,
                                  extra: { type: a.type, parent: n.name },
                                })}
                              />
                            ))}
                            {connections.map((c, i) => {
                              const connId = `conn-${n.name}-${c.fromPart}.${c.fromPort}-${c.toPart}.${c.toPort}`;
                              return (
                                <SubItem
                                  key={i}
                                  icon="⇒"
                                  text={`${c.fromPart}.${c.fromPort}`}
                                  dim={` → ${c.toPart}.${c.toPort}`}
                                  selected={sel(connId)}
                                  onClick={() => onSelect({
                                    id: connId,
                                    type: 'connection',
                                    name: `${c.fromPart}.${c.fromPort} → ${c.toPart}.${c.toPort}`,
                                    extra: {
                                      fromPart: c.fromPart, fromPort: c.fromPort,
                                      toPart: c.toPart,     toPort:  c.toPort,
                                      parent: n.name,
                                    },
                                  })}
                                />
                              );
                            })}
                          </>
                        )}
                      </div>
                    );
                  })}

                  {legacyStructOccs.map(occ => {
                    const parts  = occ.body.filter((b): b is AliasNode => b.kind === 'partAlias');
                    const subId  = `locc-${occ.name}`;
                    const isOpen = open.has(subId);
                    return (
                      <div key={occ.name}>
                        <div
                          className={`expl-item expl-item-occ${sel('occ-' + occ.name) ? ' expl-selected' : ''}`}
                          title={`occurrence def ${occ.name}  (line ${occ.line})`}
                          onClick={() => {
                            toggle(subId);
                            onSelect({ id: `occ-${occ.name}`, type: 'occurrence', name: occ.name });
                            onNavigate('structure');
                          }}>
                          <span className="expl-chevron-inline">{isOpen ? '▾' : '▸'}</span>
                          <span className="expl-icon expl-icon-occ">◇</span>
                          <span className="expl-name">{occ.name}</span>
                          <span className="expl-tag expl-tag-occ">{parts.length}p</span>
                        </div>
                        {isOpen && parts.map(p => (
                          <SubItem key={p.name} icon="·" text={p.name} dim={`: ${p.type}`} />
                        ))}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ── Scenarios ── */}
          {scenarios.length > 0 && (
            <div className="expl-section">
              <SectionHeader
                label="Scenarios" count={scenarios.length}
                open={open.has('scenarios')} onToggle={() => toggle('scenarios')}
              />
              {open.has('scenarios') && scenarios.map(occ => {
                const msgCount = occ.body.filter(b => b.kind === 'message').length;
                const isActive = occ.name === selectedOccurrence;
                const isSelected = sel(`occ-${occ.name}`);
                return (
                  <div key={occ.name}
                    className={`expl-item expl-item-scenario${isActive || isSelected ? ' expl-selected' : ''}`}
                    title={`${occ.name} — ${msgCount} messages  (line ${occ.line})`}
                    onClick={() => {
                      onSelectScenario(occ.name);
                      onSelect({ id: `occ-${occ.name}`, type: 'occurrence', name: occ.name });
                    }}>
                    <span className="expl-icon expl-icon-scenario">{isActive ? '◉' : '○'}</span>
                    <span className="expl-name">{occ.name}</span>
                    <span className="expl-tag expl-tag-scenario">{msgCount}m</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Action Definitions ── */}
          {actionDefs.length > 0 && (
            <div className="expl-section">
              <SectionHeader
                label="Actions" count={actionDefs.length}
                open={open.has('actions')} onToggle={() => toggle('actions')}
              />
              {open.has('actions') && actionDefs.map(n => (
                <div key={n.name}
                  className={`expl-item expl-item-action${sel('adef-' + n.name) ? ' expl-selected' : ''}`}
                  title={`action def ${n.name}  (line ${n.line})`}
                  onClick={() => onSelect({ id: `adef-${n.name}`, type: 'action', name: n.name })}>
                  <span className="expl-icon expl-icon-action">▷</span>
                  <span className="expl-name">{n.name}</span>
                  <span className="expl-tag expl-tag-action">action</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Behaviors ── */}
          {behaviorDefs.length > 0 && (
            <div className="expl-section">
              <SectionHeader
                label="Behaviors" count={behaviorDefs.length}
                open={open.has('behaviors')} onToggle={() => toggle('behaviors')}
              />
              {open.has('behaviors') && behaviorDefs.map(beh => {
                const instCount = beh.body.filter(b => b.kind === 'actionInst').length;
                const flowCount = beh.body.filter(b => b.kind === 'flow').length;
                const subId     = `beh-${beh.name}`;
                const isOpen    = open.has(subId);
                const isActive  = beh.name === selectedBehavior;
                return (
                  <div key={beh.name}>
                    <div
                      className={`expl-item expl-item-behavior${isActive || sel('bhv-' + beh.name) ? ' expl-selected' : ''}`}
                      title={`behavior def ${beh.name}  (line ${beh.line})`}
                      onClick={() => {
                        if (instCount) toggle(subId);
                        onSelectBehavior(beh.name);
                        onSelect({ id: `bhv-${beh.name}`, type: 'behavior', name: beh.name });
                      }}>
                      {instCount > 0
                        ? <span className="expl-chevron-inline">{isOpen ? '▾' : '▸'}</span>
                        : <span style={{ width: 12, display: 'inline-block' }} />}
                      <span className="expl-icon expl-icon-behavior">⟳</span>
                      <span className="expl-name">{beh.name}</span>
                      <span className="expl-tag expl-tag-action">{instCount}a</span>
                      {flowCount > 0 && (
                        <span className="expl-tag expl-tag-flow" style={{ marginLeft: 2 }}>{flowCount}f</span>
                      )}
                    </div>
                    {isOpen && beh.body
                      .filter((b): b is ActionInst => b.kind === 'actionInst')
                      .map(a => (
                        <SubItem
                          key={a.name}
                          icon="▷"
                          text={a.name}
                          dim={`: ${a.actionType}`}
                          selected={sel(`bact-${beh.name}-${a.name}`)}
                          onClick={() => onSelect({
                            id: `bact-${beh.name}-${a.name}`,
                            type: 'actionInst',
                            name: a.name,
                            extra: { actionType: a.actionType, behavior: beh.name },
                          })}
                        />
                      ))
                    }
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

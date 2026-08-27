import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import type { editor as MonacoEditorNS } from 'monaco-editor';

import { BRK_SAMPLE } from './ui/sample';
import { SYSML_TOKENS, SYSML_THEME } from './ui/sysmlLanguage';
import ModelExplorer from './ui/views/ModelExplorer';
import StructureView from './ui/views/StructureView';
import SequenceView from './ui/views/SequenceView';
import SysMLSequenceView from './ui/views/SysMLSequenceView';

import OfficialBehaviorView from './ui/views/OfficialBehaviorView';
import StateView from './ui/views/StateView';
import RequirementsView from './ui/views/RequirementsView';
import TraceabilityView from './ui/views/TraceabilityView';
import JsonView from './ui/views/JsonView';
import InspectorPanel from './ui/panels/InspectorPanel';
import ProjectBar from './ui/components/ProjectBar';
import ProjectModal from './ui/components/ProjectModal';
import ActionModal from './ui/components/ActionModal';
import HistoryModal from './ui/components/HistoryModal';
import ErrorBoundary from './ui/ErrorBoundary';
import type { VisualizerModel, VizNode } from './core/visualizerModel';
import type { SelectionState } from './app/selection';
import type { Project } from './app/state';
import {
  saveProjects, persistActiveId,
  setAutosave, generateId, makeTemplate,
  getInitialProjectState,
} from './app/state';

import {
  makeSnapshot, MAX_HISTORY, HISTORY_DEBOUNCE_MS,
  type HistorySnapshot,
} from './app/history';
import { getVsCodeApi, getAppMode } from './ui/vscodeApi';

import type { IncrementalEdit } from './core/editDescriptor';

import { convertGraph } from './core/adapters/officialSysMLAdapter';
import type { SysMLV2ParseResult, BehaviorData, ImpactTrace } from './core/sysmlv2Official';
import { HttpSysMLV2ParserService, computeImpactTrace } from './core/sysmlv2Official';
import type { ContainmentGraph } from './core/sysmlv2Official/ContainmentGraph';
import ContainmentGraphView from './ui/views/ContainmentGraphView';
import StructuralWiringView from './ui/views/StructuralWiringView';
import type { TrlcData } from './core/trlc/types';
import { parseTrlcJson } from './core/trlc/types';
import { parseTrlcFile } from './core/trlc/parseTrlcFile';
import { extractTrlcTraces, mapAnnotationsToTraces, buildNumericToReqId } from './core/trlc/extractTraces';
import type { RawAnnotation } from './core/trlc/extractTraces';
import './App.css';

// ── Official-mode cursor sync ──────────────────────────────────────────────────

// Types that represent named, semantic model elements worth selecting
const CURSOR_SYNC_TYPES = new Set([
  'Package', 'Namespace',
  'PartDefinition', 'PartUsage',
  'PortDefinition', 'PortUsage',
  'ActionDefinition', 'ActionUsage', 'PerformActionUsage',
  'AttributeDefinition', 'AttributeUsage',
  'ItemDefinition', 'ItemUsage',
  'InterfaceDefinition', 'InterfaceUsage',
  'ConnectionDefinition', 'ConnectionUsage',
  'FlowUsage', 'FlowConnectionUsage', 'SuccessionItemFlow',
  'OccurrenceDefinition', 'OccurrenceUsage', 'EventOccurrenceUsage',
  'BehaviorDefinition', 'StateDefinition',
  'RequirementDefinition', 'RequirementUsage',
  'AllocationDefinition', 'UseCaseDefinition',
]);

const FLOW_TYPES = new Set(['FlowUsage', 'FlowConnectionUsage', 'SuccessionItemFlow']);

const ACTION_TYPES = new Set(['ActionDefinition', 'ActionUsage', 'PerformActionUsage']);
const STRUCT_TYPES = new Set(['PartDefinition', 'PartUsage', 'PortDefinition', 'PortUsage']);

function nodeTypeToSelType(type: string): NonNullable<SelectionState>['type'] {
  if (type === 'PartDefinition' || type === 'PartUsage') return 'part';
  if (type === 'PortDefinition' || type === 'PortUsage') return 'port';
  if (type === 'ActionDefinition' || type === 'BehaviorDefinition') return 'behavior';
  if (type === 'ActionUsage' || type === 'PerformActionUsage') return 'actionInst';
  if (type === 'Package' || type === 'Namespace') return 'packageDef';
  if (type === 'StateDefinition') return 'stateMachine';
  if (type === 'RequirementDefinition' || type === 'RequirementUsage') return 'requirement';
  if (FLOW_TYPES.has(type) || type === 'EventOccurrenceUsage') return 'connection';
  return 'part';
}

interface CursorSyncResult {
  selection: NonNullable<SelectionState>;
  suggestBehavior?: string;
  suggestTab?: ViewTab;
}

// ── Reverse sync: selection → VS Code editor cursor ───────────────────────────

const GRAPH_PATH_RE = /^[\d.]+$/;

// Maps a SelectionState.type to the EMF eClass names we expect in the ContainmentGraph.
// Used by resolveGraphNodeId to do a name+type lookup when no explicit graphId is stored.
function selTypeToEMFTypes(selType: NonNullable<SelectionState>['type']): string[] {
  switch (selType) {
    case 'part':        return ['PartDefinition', 'PartUsage'];
    case 'systemPart':  return ['PartDefinition'];
    case 'instance':    return ['PartUsage'];
    case 'port':        return ['PortDefinition', 'PortUsage'];
    case 'interface':   return ['InterfaceDefinition', 'ConnectionDefinition'];
    case 'packageDef':  return ['Package', 'LibraryPackage'];
    case 'occurrence':  return ['OccurrenceDefinition'];
    case 'behavior':    return ['ActionDefinition', 'BehaviorDefinition', 'CalculationDefinition'];
    case 'actionInst':  return ['ActionUsage', 'PerformActionUsage'];
    case 'stateMachine':return ['StateDefinition'];
    case 'requirement': return ['RequirementDefinition', 'RequirementUsage'];
    case 'connection':  return ['FlowUsage', 'FlowConnectionUsage', 'SuccessionItemFlow', 'ConnectionUsage'];
    default:            return [];
  }
}

function resolveGraphNodeId(
  sel: NonNullable<SelectionState>,
  parseResult: SysMLV2ParseResult | null,
): string | null {
  // 1. Selection ID is already a raw graph path (ContainmentGraphView)
  if (GRAPH_PATH_RE.test(sel.id)) return sel.id;
  // 2. Cursor-sync / StructuralWiringView embeds graphId in extra
  if (sel.extra?.graphId && GRAPH_PATH_RE.test(String(sel.extra.graphId))) return String(sel.extra.graphId);

  if (!parseResult?.graph) return null;

  // 3. Name + EMF-type lookup in the ContainmentGraph.
  //    Covers PartDefinition, PortDefinition, InterfaceDefinition, etc. that were
  //    rendered with generated IDs (e.g. "def-AcpdCdd") without a stored graphId.
  //    Prefer nodes that have source ranges so the extension can reveal them.
  const emfTypes = selTypeToEMFTypes(sel.type);
  if (emfTypes.length > 0 && sel.name) {
    const candidates = parseResult.graph.nodes.filter(
      n => emfTypes.includes(n.type) && n.label === sel.name,
    );
    const withRange = candidates.find(n => n.startLine != null && n.startLine > 0);
    const found = withRange ?? candidates[0];
    if (found) {
      console.log('[resolveGraphNodeId] name-lookup hit:', sel.type, sel.name, '→', found.id);
      return found.id;
    }
    console.log('[resolveGraphNodeId] name-lookup miss:', sel.type, sel.name, 'emfTypes:', emfTypes);
  }

  // 4. Behavior actions lookup — richer matching for qualified ActionDefinition names
  //    (e.g. "Controller::Startup") and scoped PerformActionUsage.
  if (!parseResult.behavior) return null;
  const beh = parseResult.behavior;
  if (sel.type === 'behavior') {
    const def = beh.actions.find(a => a.type === 'ActionDefinition' && a.name === sel.name);
    if (def) return def.id;
  }
  if (sel.type === 'actionInst') {
    const behaviorName = sel.extra?.behavior as string | undefined;
    const colonIdx = (behaviorName ?? '').indexOf('::');
    const ownerPart = colonIdx >= 0 ? behaviorName!.slice(0, colonIdx) : null;
    const defPart   = colonIdx >= 0 ? behaviorName!.slice(colonIdx + 2) : (behaviorName ?? null);
    for (const a of beh.actions) {
      if (a.type !== 'ActionUsage' && a.type !== 'PerformActionUsage') continue;
      if (a.name !== sel.name) continue;
      if (!defPart) return a.id;
      const ownerDef = beh.actions.find(d => d.id === a.ownerId && d.type === 'ActionDefinition');
      if (!ownerDef || ownerDef.name !== defPart) continue;
      if (ownerPart !== null && ownerDef.owningDefName !== ownerPart) continue;
      return a.id;
    }
  }
  return null;
}

function findElementAtLineOfficial(
  line: number,
  graph: ContainmentGraph,
  behavior?: BehaviorData,
): CursorSyncResult | null {
  // Filter to named, semantically meaningful nodes with source ranges containing 'line'
  const candidates = graph.nodes.filter(n =>
    CURSOR_SYNC_TYPES.has(n.type) &&
    n.label !== n.type &&
    n.startLine != null &&
    n.endLine != null &&
    n.startLine <= line &&
    line <= n.endLine!
  );

  if (candidates.length === 0) return null;

  // Pick the most specific (smallest range) node
  candidates.sort((a, b) => {
    const rangeA = (a.endLine ?? 0) - (a.startLine ?? 0);
    const rangeB = (b.endLine ?? 0) - (b.startLine ?? 0);
    return rangeA - rangeB;
  });

  const best = candidates[0];
  const selType = nodeTypeToSelType(best.type);

  // Suggest which behavior (action def) to show when cursor is in an action usage.
  // Computed before building sel so we can embed behavior name in extra.
  let suggestBehavior: string | undefined;
  let suggestTab: ViewTab | undefined;

  if (ACTION_TYPES.has(best.type) && behavior) {
    if (best.type === 'ActionDefinition') {
      suggestBehavior = best.label;
      suggestTab = 'behavior';
    } else {
      // ActionUsage / PerformActionUsage: find owning ActionDefinition.
      const ownerAction = behavior.actions.find(a => a.id === best.id || a.name === best.label);
      if (ownerAction?.ownerId) {
        const ownerDef = behavior.actions.find(a => a.id === ownerAction.ownerId && a.type === 'ActionDefinition');
        if (ownerDef) {
          suggestBehavior = ownerDef.name;
          suggestTab = 'behavior';
        }
      }
    }
  } else if (best.type === 'EventOccurrenceUsage') {
    suggestTab = 'sequence';
  } else if (FLOW_TYPES.has(best.type)) {
    // A FlowUsage with ParameterMembership children is a sequence message; otherwise structural.
    const isSeqMsg = graph.edges.some(
      e => e.type === 'contains' && e.source === best.id &&
           (graph.nodes.find(n => n.id === e.target)?.type === 'ParameterMembership'),
    );
    suggestTab = isSeqMsg ? 'sequence' : 'flow';
  } else if (STRUCT_TYPES.has(best.type)) {
    suggestTab = 'structure';
  }

  console.log('[CursorSync] editor→visualizer line', line, '→', best.type, best.label,
    'graphId:', best.id, 'suggestTab:', suggestTab);

  const sel: SelectionState = {
    id:   `official-sync-${best.id}`,
    type: selType,
    name: best.label,
    line,
    extra: {
      graphId:  best.id,
      emfType:  best.type,
      // Embed the owning behavior name so Focus Subtree can zoom without
      // waiting for a separate selectedBehavior state update.
      ...(suggestBehavior && selType === 'actionInst' ? { behavior: suggestBehavior } : {}),
    },
  };

  return { selection: sel, suggestBehavior, suggestTab };
}

// ── Empty model used in official mode ────────────────────────────────────────

// Empty model used in official mode until VisualizerModel mapping is implemented
const OFFICIAL_EMPTY_VIZ_MODEL: VisualizerModel = {
  nodes: [],
  packages: [],
  diagnostics: [],
};

type ViewTab = 'structure' | 'flow' | 'sequence' | 'behavior' | 'state' | 'requirements' | 'traceability' | 'json' | 'graph';

// Tab labels for official SysML v2 mode (aligned with SysML v2 viewpoint names).
const OFFICIAL_TAB_LABELS: Partial<Record<ViewTab, string>> = {
  structure:    'General',
  flow:         'Interconnect',
  sequence:     'Sequence',
};

const TAB_LABELS: Record<ViewTab, string> = {
  structure:    'Structure',
  flow:         'Flow',
  sequence:     'Sequence',
  behavior:     'Actions',
  state:        'State',
  requirements: 'Reqts',
  traceability: 'Trace',
  json:         'JSON',
  graph:        'Graph',
};

const OFFICIAL_TABS: ViewTab[] = ['structure', 'flow', 'sequence', 'behavior', 'requirements', 'traceability'];

// ── App mode — detected once at module load, stable for the page lifetime ────

const APP_MODE = getAppMode();

// ── Initial state derived from localStorage ──────────────────────────────────

const init = getInitialProjectState(BRK_SAMPLE);

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Core editor state ──────────────────────────────────────────────────────
  const [source, setSource]               = useState(init.text);
  const [tab, setTab]                     = useState<ViewTab>('structure');
  const [selectedOccurrence, setSelected] = useState('');
  const [selectedBehavior, setSelectedBehavior] = useState('');
  const [selectedStateMachine, setSelectedStateMachine] = useState('');
  const [selection, setSelection]         = useState<SelectionState>(null);

  // ── VS Code webview integration ────────────────────────────────────────────
  // noFileOpen: true when extension reports no .sysml file is active
  const [noFileOpen, setNoFileOpen]       = useState(false);
  // Prevents echoing extension-initiated source changes back as updateModel
  const fromExtension                     = useRef(false);
  // Only send updateModel after we have received at least one loadModel
  const receivedFirstLoad                 = useRef(false);
  // Prevents echo-loop: set true when selection comes from revealElementAtSource
  const suppressRevealSource              = useRef(false);
  // Set true for 500ms after revealTrlcReq so that the Cmd+Click cursor movement
  // (which arrives via revealElementAtSource ~100ms later) doesn't overwrite the
  // intentionally-set TRLC requirement selection.
  const suppressRevealFromEditor          = useRef(false);
  // Latest vizModel and selection for use inside stable message-handler closure.
  // Initialized with null; kept current by direct assignment after useMemo below.
  const vizModelRef                       = useRef<VisualizerModel | null>(null);
  const selectionRef                      = useRef<SelectionState>(null);
  // Refs for cursor-sync state that needs to be readable inside the stable closure
  const syncCursorRef                     = useRef(true);

  // ── Panel visibility ───────────────────────────────────────────────────────
  // VS Code mode: all side panels start collapsed so the viz canvas fills the view
  const [col1Open,      setCol1Open]      = useState(APP_MODE === 'standalone');
  const [explorerOpen,  setExplorerOpen]  = useState(APP_MODE === 'standalone');
  const [inspectorOpen, setInspectorOpen] = useState(APP_MODE === 'standalone');

  // ── Project state ──────────────────────────────────────────────────────────
  const [projects, setProjects]           = useState<Project[]>(init.projects);
  const [activeProject, setActiveProject] = useState<Project | null>(init.active);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [newModalMode, setNewModalMode]   = useState<'new' | 'saveAs' | null>(null);

  // ── History state ──────────────────────────────────────────────────────────
  const [diagFilter, setDiagFilter]       = useState<'all' | 'error' | 'warning' | 'info'>('all');

  const [history, setHistory]             = useState<HistorySnapshot[]>(() => [
    makeSnapshot(init.text, OFFICIAL_EMPTY_VIZ_MODEL),
  ]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const historyDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipHistoryPush = useRef(false);

  const isUnsaved = !activeProject || source !== activeProject.sysmlText;

  // ── User role ──────────────────────────────────────────────────────────────
  type UserRole = 'architect' | 'developer';
  const [userRole, setUserRole] = useState<UserRole>(() =>
    (localStorage.getItem('sysmlv2-user-role') as UserRole | null) ?? 'architect'
  );
  const [serviceEndpoint, setServiceEndpoint] = useState(
    () => localStorage.getItem('sysmlv2-service-endpoint')
      ?? (import.meta.env['VITE_SYSML_V2_PARSER_URL'] as string | undefined)
      ?? 'http://localhost:9001'
  );
  const [officialParseResult, setOfficialParseResult] = useState<SysMLV2ParseResult | null>(null);
  const [officialParseLoading, setOfficialParseLoading] = useState(false);
  // On-demand visualization (VS Code mode): red marker when the model changed since the
  // last render; `autoViz` toggles whether edits auto-refresh or wait for the button.
  const [vizStale, setVizStale] = useState(false);
  const [autoViz,  setAutoViz]  = useState(false); // default: manual (on-demand Visualize)

  // ── Model checker state ────────────────────────────────────────────────────
  type ValidatorDiag = { message: string; severity: string; code?: string; line?: number };
  const [validatorDiags,     setValidatorDiags]     = useState<ValidatorDiag[]>([]);
  const [validatorRunning,   setValidatorRunning]   = useState(false);
  const [validatorPanelOpen, setValidatorPanelOpen] = useState(true);
  const [validatorRanOnce,   setValidatorRanOnce]   = useState(false);
  // >0 when the model checker last ran over a PARTIAL model (the parse itself had this
  // many errors); its "no issues" result is then not a clean bill of health.
  const [validatorParsePartial, setValidatorParsePartial] = useState(0);
  // Stable ref so the VS Code message handler can access the latest parse result
  const officialParseResultRef = useRef<SysMLV2ParseResult | null>(null);
  // True when running inside the VS Code extension — the extension manages all
  // parsing and sends updateGraph, so the webview should not call the parser itself.
  const isVSCodeModeRef = useRef(getAppMode() === 'vscode');
  const [isVSCodeMode, setIsVSCodeMode] = useState(getAppMode() === 'vscode');

  // Cursor sync & focus subtree toggles (official mode only)
  const [syncCursor,   setSyncCursor]   = useState(true);
  const [focusSubtree, setFocusSubtree] = useState(false);

  // Project context files for multi-file parsing (cross-file import resolution)
  const [projectFiles, setProjectFiles] = useState<{ name: string; text: string }[]>([]);

  // TRLC external requirements (imported separately from the SysML model)
  const [trlcData, setTrlcData] = useState<TrlcData | null>(null);
  const [trlcImportError, setTrlcImportError] = useState<string | null>(null);
  // Raw trlc-satisfies annotations sent by the extension (covers all workspace files)
  const [trlcAnnotations, setTrlcAnnotations] = useState<RawAnnotation[] | null>(null);

  // ── Monaco refs ────────────────────────────────────────────────────────────
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  selectionRef.current = selection;
  officialParseResultRef.current = officialParseResult;
  syncCursorRef.current = syncCursor;

  // ── Adapt to VisualizerModel (consumed by all views) ──────────────────────
  const vizModel = useMemo(() => {
    if (officialParseResult?.graph) return convertGraph(officialParseResult);
    return OFFICIAL_EMPTY_VIZ_MODEL;
  }, [officialParseResult]);
  // Keep latest-ref copy for use inside stable closures (message handlers)
  vizModelRef.current = vizModel;

  const behavioralOccurrences = useMemo(
    () => vizModel.nodes
      .filter((n): n is Extract<VizNode, { kind: 'occurrenceDef' }> =>
        n.kind === 'occurrenceDef' && n.fromPrimary !== false &&
        n.body.some(b => b.kind === 'message'))
      .map(n => n.name),
    [vizModel],
  );

  const behaviorDefNames = useMemo(() => {
    if (!officialParseResult?.behavior) return [];
    const beh = officialParseResult.behavior;
    // buildBehavior prefixes context-file IDs with `ctx…`; keep only primary-file
    // entries so behavior/sequence tab selectors offer behaviors declared in the open file.
    const actions = beh.actions.filter(a => !String(a.id).startsWith('ctx'));
    const CTRL = new Set(['DecisionNode', 'ForkNode', 'JoinNode', 'MergeNode']);
    // Include both ActionDefinition entries and ActionUsage entries that have an inline
    // body (detected by having sub-actions with ownerId pointing to them).
    const actionDefEntries = actions
      .filter(a =>
        a.type === 'ActionDefinition' ||
        ((a.type === 'ActionUsage' || a.type === 'PerformActionUsage') && a.owningDefName),
      )
      .filter(def => actions.some(a =>
        (a.type === 'ActionUsage' || a.type === 'PerformActionUsage' || CTRL.has(a.type)) &&
        a.ownerId === def.id,
      ))
      .map(a => a.owningDefName ? `${a.owningDefName}::${a.name}` : a.name);
    // PartDefs that contain action usages (typed) or inline action bodies.
    // When `action init { ... }` is written inside a part def, the pilot parser emits it as
    // ActionDefinition (not ActionUsage). Detect this case: an ActionDefinition inside a
    // structural def that is NOT referenced by a typed usage in the same structural def.
    const referencedDefNames = new Set(
      actions
        .filter(a => (a.type === 'ActionUsage' || a.type === 'PerformActionUsage') &&
                     a.owningDefName && !a.ownerId && a.actionType)
        .map(a => `${a.owningDefName}::${a.actionType}`),
    );
    const seen = new Set<string>();
    const partDefEntries: string[] = [];
    for (const a of actions) {
      // Typed usage: action init : Init;
      if ((a.type === 'ActionUsage' || a.type === 'PerformActionUsage') && a.owningDefName && !a.ownerId) {
        const key = `part def::${a.owningDefName}`;
        if (!seen.has(key)) { seen.add(key); partDefEntries.push(key); }
      }
      // Inline body: action init { ... } parsed as ActionDefinition
      if (a.type === 'ActionDefinition' && a.owningDefName &&
          !referencedDefNames.has(`${a.owningDefName}::${a.name}`)) {
        const key = `part def::${a.owningDefName}`;
        if (!seen.has(key)) { seen.add(key); partDefEntries.push(key); }
      }
    }
    return [...actionDefEntries, ...partDefEntries];
  }, [officialParseResult]);

  const stateMachineNames = useMemo(
    () => vizModel.nodes
      .filter((n): n is Extract<VizNode, { kind: 'stateDef' }> =>
        n.kind === 'stateDef' && n.fromPrimary !== false)
      .map(n => n.name),
    [vizModel],
  );

  // Impact trace: computed from selection + official parse result (official mode only).
  // behavior may be absent when the graph comes from the extension without a running
  // parser service; fall back to empty BehaviorData so graph-level impact still shows.
  const EMPTY_BEHAVIOR: BehaviorData = { actions: [], flows: [], conditionals: [] };
  const impactTrace = useMemo((): ImpactTrace | null => {
    if (!officialParseResult?.graph) return null;
    if (!selection) return null;
    const trace = computeImpactTrace(
      officialParseResult.graph,
      officialParseResult.behavior ?? EMPTY_BEHAVIOR,
      selection.name,
      selection.type,
      selection.extra,
    );
    console.log('[ImpactTrace] selection:', selection.type, selection.name,
      '→ owned:', trace.ownedElements.length,
      'behaviors:', trace.relatedBehaviors.length,
      'flows:', trace.relatedFlows.length,
      'connected:', trace.connectedElements.length,
    );
    return trace;
  }, [officialParseResult, selection]); // eslint-disable-line react-hooks/exhaustive-deps

  const trlcDataWithTracesRef = useRef<TrlcData | null>(null);

  const activeDiagnostics = useMemo(
    () => officialParseResult?.diagnostics.map(d => ({
      message:  d.message,
      line:     d.line ?? 1,
      column:   d.column,
      severity: d.severity,
      ...(d.code !== undefined ? { code: d.code } : {}),
    })) ?? [],
    [officialParseResult],
  );

  // Derive trace links from trlc-satisfies annotations.
  // Extension path: use annotations sent by the extension (covers all workspace files).
  // Standalone fallback: scan source + context files directly.
  const satisfiesTraces = officialParseResult?.satisfies;
  const trlcDataWithTraces = useMemo((): TrlcData | null => {
    if (!trlcData) return null;
    const numericToReqId = buildNumericToReqId(trlcData.requirements.map(r => r.id));
    const annTraces = trlcAnnotations !== null
      ? mapAnnotationsToTraces(trlcAnnotations, numericToReqId)
      : extractTrlcTraces([{ text: source }, ...projectFiles], numericToReqId);
    // @Satisfies metadata → traces, matched to requirements by EXACT name.
    const reqIds = new Set(trlcData.requirements.map(r => r.id));
    const satTraces = (satisfiesTraces ?? [])
      .filter(s => reqIds.has(s.reqId))
      .map(s => ({ requirementId: s.reqId, elementName: s.elementName }));
    // Merge both sources, de-duplicating identical (requirement, element) pairs.
    const seen = new Set<string>();
    const traces = [...annTraces, ...satTraces].filter(t => {
      const k = `${t.requirementId}::${t.elementName}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { ...trlcData, traces };
  }, [trlcData, trlcAnnotations, source, projectFiles, satisfiesTraces]);
  trlcDataWithTracesRef.current = trlcDataWithTraces;

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    setSelected(cur => {
      if (behavioralOccurrences.length === 0)    return '';
      if (behavioralOccurrences.includes(cur))   return cur;
      return behavioralOccurrences[0];
    });
  }, [behavioralOccurrences]);

  useEffect(() => {
    setSelectedBehavior(cur => {
      if (behaviorDefNames.length === 0)    return '';
      if (behaviorDefNames.includes(cur))   return cur;
      return behaviorDefNames[0];
    });
  }, [behaviorDefNames]);

  useEffect(() => {
    setSelectedStateMachine(cur => {
      if (stateMachineNames.length === 0)  return '';
      if (stateMachineNames.includes(cur)) return cur;
      return stateMachineNames[0];
    });
  }, [stateMachineNames]);

  // Auto-save every keystroke (crash recovery for untitled sessions)
  useEffect(() => { setAutosave(source); }, [source]);

  // Debounced history snapshot — skipped during programmatic restores
  useEffect(() => {
    if (historyDebounce.current) clearTimeout(historyDebounce.current);
    if (skipHistoryPush.current) {
      skipHistoryPush.current = false;
      return;
    }
    historyDebounce.current = setTimeout(() => {
      setHistory(prev => {
        if (prev.length > 0 && prev[prev.length - 1].text === source) return prev;
        const next = [...prev, makeSnapshot(source, vizModel)];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });
    }, HISTORY_DEBOUNCE_MS);
  }, [source, vizModel]);

  // Call HTTP parser service when source, endpoint, or context files change.
  // Skipped in VS Code mode: the extension parses and sends updateGraph directly,
  // so calling the parser here would be a redundant second round-trip.
  useEffect(() => {
    if (isVSCodeModeRef.current) return;
    let cancelled = false;
    setOfficialParseLoading(true);
    const svc = new HttpSysMLV2ParserService(serviceEndpoint);
    svc.parse(source, projectFiles).then(res => {
      if (cancelled) return;
      setOfficialParseResult(res);
      setOfficialParseLoading(false);
    });
    return () => { cancelled = true; };
  }, [source, serviceEndpoint, projectFiles]);

  // Persist role and endpoint across page loads
  useEffect(() => {
    localStorage.setItem('sysmlv2-user-role', userRole);
  }, [userRole]);

  useEffect(() => {
    localStorage.setItem('sysmlv2-service-endpoint', serviceEndpoint);
  }, [serviceEndpoint]);

  // Close inspector when switching to developer role
  useEffect(() => {
    if (userRole === 'developer') setInspectorOpen(false);
  }, [userRole]);

  // Sync diagnostics → Monaco editor markers
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(
      model, 'sysml',
      activeDiagnostics.map(d => ({
        severity: d.severity === 'error'   ? monaco.MarkerSeverity.Error
                : d.severity === 'warning' ? monaco.MarkerSeverity.Warning
                : monaco.MarkerSeverity.Info,
        startLineNumber: d.line,
        startColumn: d.column ?? 1,
        endLineNumber: d.line,
        endColumn: d.line <= model.getLineCount()
          ? model.getLineMaxColumn(d.line) : 999,
        message: d.message,
      })),
    );
  }, [activeDiagnostics]);

  // ── VS Code webview message bus ───────────────────────────────────────────

  // Signal readiness so the extension knows when to send the initial model
  useEffect(() => { getVsCodeApi()?.postMessage({ type: 'ready' }); }, []);

  // Receive messages from the extension
  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      const msg = ev.data as {
        type: string;
        text?: string;
        sourceLocation?: { line: number; column: number };
        parserServiceUrl?: string;
        graph?: SysMLV2ParseResult['graph'];
        behavior?: BehaviorData;
        dependencies?: SysMLV2ParseResult['dependencies'];
        timing?: SysMLV2ParseResult['timing'];
        satisfies?: SysMLV2ParseResult['satisfies'];
        success?: boolean;
        diagnostics?: SysMLV2ParseResult['diagnostics'];
        trlcAnnotations?: RawAnnotation[];
        requirements?: TrlcData['requirements'];
        numericId?: string;
        noGraph?: boolean;
        parsePartial?: boolean;
        parseErrorCount?: number;
        stale?: boolean;
        parsing?: boolean;
      };
      if (msg.type === 'staleState') {
        setVizStale(!!msg.stale);
        return;
      }
      if (msg.type === 'validatorResult') {
        setValidatorRunning(false);
        setValidatorRanOnce(true);
        setValidatorDiags((msg.diagnostics as ValidatorDiag[] | undefined) ?? []);
        setValidatorParsePartial(msg.parsePartial ? (msg.parseErrorCount ?? 0) : 0);
      } else if (msg.type === 'loadModel' && typeof msg.text === 'string') {
        receivedFirstLoad.current = true;
        fromExtension.current = true;
        isVSCodeModeRef.current = true;
        setIsVSCodeMode(true);
        // A NEW active file always resets the visualizer to the General view. Only show
        // the parsing overlay when a parse is actually coming (auto mode); in manual mode
        // the file is active + General but not visualized until the user clicks Visualize.
        setTab('structure');
        if (msg.parsing !== false) setOfficialParseLoading(true);
        setOfficialParseResult(null); // clear the previous file's result
        setNoFileOpen(false);
        setSource(msg.text);
        setSelection(null);
        setValidatorDiags([]);
        setValidatorRanOnce(false);
        setValidatorParsePartial(0);
      } else if (msg.type === 'updateModel' && typeof msg.text === 'string') {
        fromExtension.current = true;
        isVSCodeModeRef.current = true;
        setIsVSCodeMode(true);
        // Only show the "parsing" overlay when a parse is actually coming (auto mode).
        // In manual mode this is just a text sync — don't flip into a stuck "parsing" state.
        if (msg.parsing !== false) setOfficialParseLoading(true);
        setSource(msg.text);
      } else if (msg.type === 'noModel') {
        setNoFileOpen(true);
      } else if (msg.type === 'parserServiceConfig' && typeof msg.parserServiceUrl === 'string') {
        // VS Code extension sent the configured parser service URL from settings.
        // This overrides the localStorage default so the extension config is authoritative.
        isVSCodeModeRef.current = true;
        setIsVSCodeMode(true);
        setServiceEndpoint(msg.parserServiceUrl);
      } else if (msg.type === 'trlcAnnotations' && Array.isArray(msg.trlcAnnotations)) {
        setTrlcAnnotations(msg.trlcAnnotations);
      } else if (msg.type === 'trlcRequirements' && Array.isArray(msg.requirements)) {
        // Auto-loaded workspace .trlc requirements (traces are derived from @Satisfies below).
        setTrlcData(msg.requirements.length ? { requirements: msg.requirements, traces: [] } : null);
      } else if (msg.type === 'revealTrlcReq' && typeof msg.numericId === 'string') {
        setTab('traceability');
        const data = trlcDataWithTracesRef.current;
        if (data) {
          const req = data.requirements.find(r => r.id.endsWith(msg.numericId!));
          if (req) {
            // Suppress revealElementAtSource for 500ms: Cmd/Ctrl+Click also
            // moves the editor cursor, which triggers a revealElementAtSource
            // ~100ms later that would otherwise overwrite this selection.
            suppressRevealFromEditor.current = true;
            setTimeout(() => { suppressRevealFromEditor.current = false; }, 500);
            setSelection({
              id: `trlc-req-${req.id}`,
              type: 'requirement',
              name: req.id,
              extra: { reqId: req.id, text: req.text, title: req.title, ...(req.asil ? { asil: req.asil } : {}) },
            });
          }
        }
      } else if (msg.type === 'updateGraph' && msg.graph) {
        console.log('[App] received updateGraph, behavior:', msg.behavior);
        setOfficialParseLoading(false);
        setVizStale(false); // a fresh render means the diagram matches the parsed content
        setOfficialParseResult(prev => {
          const base = prev ?? { success: true, diagnostics: [] };
          return {
            ...base,
            error: undefined, // clear any stale SERVICE_UNAVAILABLE from the initial HTTP probe
            graph: msg.graph,
            behavior: msg.behavior ?? base.behavior,
            dependencies: msg.dependencies ?? base.dependencies,
            timing: msg.timing ?? base.timing,
            satisfies: msg.satisfies ?? base.satisfies,
            // Extension parsed with full workspace context → its success/diagnostics
            // are more accurate than the webview's own standalone parse result.
            ...(msg.success !== undefined
              ? { success: msg.success, diagnostics: msg.diagnostics ?? [] }
              : {}),
          };
        });
      } else if (msg.type === 'revealElementAtSource' && msg.sourceLocation) {
        if (suppressRevealFromEditor.current) return;
        const { line } = msg.sourceLocation;
        if (!syncCursorRef.current) return;
        const graph = officialParseResultRef.current?.graph;
        if (!graph) return;
        const syncResult = findElementAtLineOfficial(
          line, graph, officialParseResultRef.current?.behavior
        );
        if (!syncResult) return;
        const { selection: found, suggestBehavior, suggestTab } = syncResult;
        if (found.id !== selectionRef.current?.id) {
          suppressRevealSource.current = true;
          setSelection(found);
          // No auto view-switch on cursor movement — clicking around the active file must
          // NOT "jump" the visualizer between tabs/behaviours. Only opening a NEW file
          // resets the view (to General). We still highlight the element in the current view.
          void suggestBehavior; void suggestTab;
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Send edits back to the extension (skip echo of extension-initiated changes)
  useEffect(() => {
    if (!receivedFirstLoad.current) return;
    if (fromExtension.current) { fromExtension.current = false; return; }
    getVsCodeApi()?.postMessage({ type: 'modelEdit', text: source });
  }, [source]);


  // Log selection changes for pipeline diagnostics
  useEffect(() => {
    if (selection) {
      console.log('[Selection] type:', selection.type, 'name:', selection.name,
        'id:', selection.id, 'extra:', selection.extra);
    }
  }, [selection]);

  // Reveal an element in the editor / source text. Called explicitly by the right-click
  // "Go to model" action, and by the selection-sync effect below for NON-diagram selections
  // (model explorer, inspector, diagnostics, lists). Diagram-shape left-clicks intentionally
  // do NOT reveal — they set `suppressRevealSource` first (see selectFromDiagram) so the user
  // stays in the diagram; use right-click → "Go to model" to jump to the text.
  function revealSelectionInSource(sel: SelectionState) {
    if (!sel) return;
    if (APP_MODE === 'standalone') {
      // Resolve line: prefer graphId → graph node startLine, fall back to selection.line.
      let line: number | undefined;
      const rawGraphId = sel.extra?.graphId as string | undefined;
      if (rawGraphId && officialParseResultRef.current?.graph) {
        const node = officialParseResultRef.current.graph.nodes.find(n => n.id === rawGraphId);
        if (node?.startLine && node.startLine > 0) line = node.startLine;
      }
      if (line === undefined && sel.line !== undefined && sel.line > 0) line = sel.line;
      if (line !== undefined) {
        suppressRevealSource.current = true; // don't let the cursor listener echo it back
        jumpToLine(line);
      }
      return;
    }
    // VS Code mode: send a semantic reveal message to the extension.
    const graphId = resolveGraphNodeId(sel, officialParseResultRef.current);
    if (graphId) {
      const graphNode = officialParseResultRef.current?.graph?.nodes.find(n => n.id === graphId);
      const startLine = graphNode?.startLine ?? sel.line;
      getVsCodeApi()?.postMessage({ type: 'revealSemanticElement', semanticId: graphId, startLine });
      return;
    }
    if (sel.line !== undefined) {
      getVsCodeApi()?.postMessage({ type: 'revealSource', sourceLocation: { line: sel.line, column: 1 } });
      return;
    }
    if (sel.extra?.lookupByName === 'true' && sel.name) {
      getVsCodeApi()?.postMessage({ type: 'revealElementInSource', name: sel.name });
    }
  }

  // Sync selection → editor for NON-diagram selections (model explorer, inspector, lists,
  // diagnostics). Diagram-shape selections suppress this (selectFromDiagram) so a left-click
  // in a diagram never jumps to the text — the user uses right-click → "Go to model" instead.
  useEffect(() => {
    if (selection === null) return;
    if (suppressRevealSource.current) { suppressRevealSource.current = false; return; }
    revealSelectionInSource(selection);
  }, [selection]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Diagram-shape interaction ──────────────────────────────────────────────────
  // Left-click a shape SELECTS it (highlights, feeds the inspector) but does NOT jump to
  // the source — we suppress the reveal sync. Right-click a shape opens a "Go to model"
  // menu that performs the jump on demand.
  const selectFromDiagram = useCallback((sel: SelectionState) => {
    if (sel !== null) suppressRevealSource.current = true;
    setSelection(sel);
  }, []);
  const [shapeMenu, setShapeMenu] = useState<{ x: number; y: number; sel: SelectionState } | null>(null);
  const openShapeMenu = useCallback((e: React.MouseEvent, sel: SelectionState) => {
    if (!sel) return;
    e.preventDefault();
    setShapeMenu({ x: e.clientX, y: e.clientY, sel });
  }, []);
  function goToModel(sel: SelectionState) {
    setShapeMenu(null);
    if (!sel) return;
    suppressRevealSource.current = true; // highlight without the sync effect double-revealing
    setSelection(sel);
    revealSelectionInSource(sel);
  }

  // ── Cmd/Ctrl+S shortcut ────────────────────────────────────────────────────

  // Use a ref so the handler always sees latest state without stale closures
  const saveRef = useRef<() => void>(() => {});
  saveRef.current = handleSave;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inEditor = !!(editorRef.current?.hasTextFocus());
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && APP_MODE === 'standalone') {
        e.preventDefault();
        saveRef.current();
      }
      // Undo/redo when focus is outside Monaco (Monaco handles it natively when focused)
      if (!inEditor) {
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
          e.preventDefault();
          editorRef.current?.trigger('global', 'undo', null);
        }
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
          e.preventDefault();
          editorRef.current?.trigger('global', 'redo', null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function warnUnsaved(): boolean {
    if (!isUnsaved) return true;
    return window.confirm('You have unsaved changes. Continue anyway?');
  }

  function applyProjectSwitch(proj: Project) {
    setSource(proj.sysmlText);
    setActiveProject(proj);
    persistActiveId(proj.id);
    setSelection(null);
  }

  function doSaveToProject(proj: Project, text: string): Project {
    const updated = { ...proj, sysmlText: text, updatedAt: Date.now() };
    const list = projects.map(p => p.id === updated.id ? updated : p);
    setProjects(list);
    saveProjects(list);
    setActiveProject(updated);
    return updated;
  }

  // ── Project handlers ───────────────────────────────────────────────────────

  function handleSave() {
    if (!activeProject) { setNewModalMode('saveAs'); return; }
    doSaveToProject(activeProject, source);
  }

  function handleNew() {
    if (!warnUnsaved()) return;
    setNewModalMode('new');
  }

  function handleLoad() { setShowLoadModal(true); }

  function handleLoadProject(proj: Project) {
    if (!warnUnsaved()) return;
    applyProjectSwitch(proj);
    setShowLoadModal(false);
  }

  function handleDeleteProject(id: string) {
    const list = projects.filter(p => p.id !== id);
    setProjects(list);
    saveProjects(list);
    if (activeProject?.id === id) {
      setActiveProject(null);
      persistActiveId(null);
    }
  }

  function handleExport() {
    const filename = (activeProject?.name ?? 'model').replace(/\s+/g, '-') + '.sysml';
    const blob = new Blob([source], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImport(text: string) {
    if (!warnUnsaved()) return;
    setSource(text);
    // Keep active project but mark as unsaved — user can Save to store it
    if (activeProject) {
      // Only clear the project link so isUnsaved becomes true
      setActiveProject({ ...activeProject });
    }
    setSelection(null);
  }

  // ── New/SaveAs modal submit ────────────────────────────────────────────────

  function submitProjectName(vals: Record<string, string>): string | null {
    const name = vals.name.trim();
    if (!name) return 'Name cannot be empty.';
    const text = newModalMode === 'new' ? makeTemplate(name) : source;
    const proj: Project = {
      id: generateId(), name, sysmlText: text,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    const list = [...projects, proj];
    setProjects(list);
    saveProjects(list);
    persistActiveId(proj.id);
    if (newModalMode === 'new') setSource(text);
    setActiveProject(proj);
    setNewModalMode(null);
    setSelection(null);
    return null;
  }

  // ── Undo / Redo ────────────────────────────────────────────────────────────

  function handleUndo() { editorRef.current?.trigger('toolbar', 'undo', null); }
  function handleRedo() { editorRef.current?.trigger('toolbar', 'redo', null); }

  // ── History ────────────────────────────────────────────────────────────────

  function handleHistoryRestore(snap: HistorySnapshot) {
    if (!window.confirm('Restore this snapshot? The current text will be overwritten.')) return;
    skipHistoryPush.current = true;
    setSource(snap.text);
    setSelection(null);
    setShowHistoryModal(false);
  }

  // ── Revert ─────────────────────────────────────────────────────────────────

  function handleRevert() {
    if (!activeProject || source === activeProject.sysmlText) return;
    if (!window.confirm(`Revert to last saved version of "${activeProject.name}"?`)) return;
    skipHistoryPush.current = true;
    setSource(activeProject.sysmlText);
    setSelection(null);
  }

  // ── TRLC requirements import ───────────────────────────────────────────────

  function handleTrlcImport(text: string): void {
    const { data, error } = parseTrlcJson(text);
    if (error) {
      setTrlcImportError(error);
      return;
    }
    setTrlcData(data);
    setTrlcImportError(null);
  }

  function handleTrlcFileInput(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      if (file.name.toLowerCase().endsWith('.trlc')) {
        const data = parseTrlcFile(text);
        setTrlcData(data);
        setTrlcImportError(null);
      } else {
        handleTrlcImport(text);
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }

  const trlcFileInputRef = useRef<HTMLInputElement | null>(null);
  const projectFilesInputRef = useRef<HTMLInputElement | null>(null);

  function handleProjectFilesInput(e: React.ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const results: { name: string; text: string }[] = [];
    let remaining = files.length;
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = ev => {
        results.push({ name: file.name, text: ev.target?.result as string });
        remaining--;
        if (remaining === 0) setProjectFiles(results);
      };
      reader.readAsText(file);
    }
    // Reset so the same file can be re-selected
    e.target.value = '';
  }

  // ── Editor helpers ─────────────────────────────────────────────────────────

  function jumpToLine(lineNum: number) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.revealLineInCenter(lineNum);
    editor.setPosition({ lineNumber: lineNum, column: 1 });
    editor.focus();
  }

  const handleBeforeMount: BeforeMount = (monaco) => {
    if (monaco.languages.getLanguages().some((l: { id: string }) => l.id === 'sysml')) return;
    monaco.languages.register({ id: 'sysml' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    monaco.languages.setMonarchTokensProvider('sysml', SYSML_TOKENS as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    monaco.editor.defineTheme('sysml-dark', SYSML_THEME as any);
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // In standalone mode, sync cursor → visualizer selection (debounced).
    // VS Code mode receives revealElementAtSource from the extension instead.
    if (APP_MODE === 'standalone') {
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      editor.onDidChangeCursorPosition(e => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (!syncCursorRef.current) return;
          // Suppress if the cursor move was triggered programmatically by visualizer→editor sync.
          if (suppressRevealSource.current) {
            suppressRevealSource.current = false;
            return;
          }
          const graph = officialParseResultRef.current?.graph;
          if (!graph) return;
          const line = e.position.lineNumber;
          const syncResult = findElementAtLineOfficial(
            line, graph, officialParseResultRef.current?.behavior
          );
          if (!syncResult) return;
          const { selection: found, suggestBehavior, suggestTab } = syncResult;
          if (found.id !== selectionRef.current?.id) {
            suppressRevealSource.current = true;
            setSelection(found);
            if (suggestBehavior) setSelectedBehavior(suggestBehavior);
            if (suggestTab) setTab(suggestTab as ViewTab);
          }
        }, 120);
      });
    }
  };

  const errCount  = activeDiagnostics.filter(d => d.severity === 'error').length;
  const warnCount = activeDiagnostics.filter(d => d.severity === 'warning').length;
  const infoCount = activeDiagnostics.filter(d => d.severity === 'info').length;

  const validatorErrCount  = validatorDiags.filter(d => d.severity === 'error').length;
  const validatorWarnCount = validatorDiags.filter(d => d.severity === 'warning').length;
  const validatorIssueCount = validatorErrCount + validatorWarnCount;
  const hasGraph = !!officialParseResult?.graph;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="app-root">

      {/* ── Project bar (standalone only) ─────────── */}
      {APP_MODE === 'standalone' && (
        <ProjectBar
          projectName={activeProject?.name ?? null}
          isUnsaved={isUnsaved}
          canRevert={isUnsaved && activeProject !== null}
          onSave={handleSave}
          onNew={handleNew}
          onLoad={handleLoad}
          onExport={handleExport}
          onImport={handleImport}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onHistory={() => setShowHistoryModal(true)}
          onRevert={handleRevert}
        />
      )}

      {/* ── VS Code "no file" overlay ────────────── */}
      {noFileOpen && (
        <div className="no-file-overlay">
          <span className="no-file-icon">⬡</span>
          <p className="no-file-msg">Open a .sysml file to visualize</p>
        </div>
      )}

      {/* ── 4-column workspace ────────────────────── */}
      <div className="app-layout">

        {/* Column 1: Editor (standalone only) */}
        {APP_MODE === 'standalone' && (col1Open ? (
          <div className="panel editor-panel">
            <div className="panel-header">
              <span>SysML v2 Source</span>
              {activeDiagnostics.length > 0 && (
                <span className="diag-badge">
                  {errCount  > 0 && <span className="badge-error">{errCount} err</span>}
                  {warnCount > 0 && <span className="badge-warn">{warnCount} warn</span>}
                  {infoCount > 0 && <span className="badge-info">{infoCount} info</span>}
                </span>
              )}
              <button className="panel-toggle-btn" onClick={() => setCol1Open(false)} title="Collapse">◀</button>
            </div>

            <div className="editor-wrap">
              <Editor
                height="100%"
                language="sysml"
                value={source}
                onChange={v => setSource(v ?? '')}
                theme="sysml-dark"
                beforeMount={handleBeforeMount}
                onMount={handleEditorMount}
                options={{
                  minimap:              { enabled: false },
                  fontSize:             13.5,
                  lineNumbers:          'on',
                  wordWrap:             'on',
                  scrollBeyondLastLine: false,
                  renderLineHighlight:  'line',
                  glyphMargin:          true,
                  overviewRulerBorder:  false,
                  folding:              true,
                  padding:              { top: 8 },
                }}
              />
            </div>

            {activeDiagnostics.length > 0 && (
              <div className="diagnostics-panel">
                <div className="diag-panel-hdr">
                  <span>Model Diagnostics</span>
                  <div className="diag-filter-bar">
                    {(['all', 'error', 'warning', 'info'] as const).map(f => {
                      const cnt = f === 'all' ? activeDiagnostics.length
                        : f === 'error'   ? errCount
                        : f === 'warning' ? warnCount
                        : infoCount;
                      return (
                        <button
                          key={f}
                          className={`diag-filter-btn${diagFilter === f ? ' active' : ''}`}
                          onClick={() => setDiagFilter(f)}
                        >
                          {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                          <span className={`diag-filter-cnt diag-filter-cnt-${f}`}>{cnt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {activeDiagnostics
                  .filter(d => diagFilter === 'all' || d.severity === diagFilter)
                  .map((d, i) => (
                    <div
                      key={i}
                      className={`diag-row diag-${d.severity}`}
                      onClick={() => jumpToLine(d.line)}
                      title={`Line ${d.line}: ${d.message}`}
                    >
                      <span className="diag-sev-icon">
                        {d.severity === 'error' ? '✖' : d.severity === 'warning' ? '⚠' : 'ℹ'}
                      </span>
                      <span className="diag-loc">L{d.line}</span>
                      {'code' in d && !!(d as Record<string,unknown>).code && <span className="diag-code">{String((d as Record<string,unknown>).code)}</span>}
                      <span className="diag-msg">{d.message}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <button
            className="panel-collapsed-strip panel-border-right"
            onClick={() => setCol1Open(true)}
          >
            <span className="panel-tab-label">Editor</span>
          </button>
        ))}

        {/* Column 2: Model Explorer */}
        {explorerOpen ? (
          <ModelExplorer
            result={vizModel}
            selectedOccurrence={selectedOccurrence}
            selectedBehavior={selectedBehavior}
            selectedStateMachine={selectedStateMachine}
            selection={selection}
            onSelectScenario={name => { setSelected(name); setTab('sequence'); }}
            onSelectBehavior={name => { setSelectedBehavior(name); setTab('behavior'); }}
            onSelectStateMachine={name => { setSelectedStateMachine(name); setTab('state'); }}
            onSelect={setSelection}
            onNavigate={setTab}
            onCollapse={() => setExplorerOpen(false)}
          />
        ) : (
          <button
            className="panel-collapsed-strip panel-border-right"
            onClick={() => setExplorerOpen(true)}
          >
            <span className="panel-tab-label">Explorer</span>
          </button>
        )}

        {/* Column 3: Visualization */}
        <div className="panel viz-panel">
          <div className="panel-header tabs">
            <div className="tab-group">
              {OFFICIAL_TABS.map(t => (
                <button
                  key={t}
                  className={`tab-btn${tab === t ? ' active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {OFFICIAL_TAB_LABELS[t] ?? TAB_LABELS[t]}
                </button>
              ))}
            </div>
            {/* ── On-demand Visualize (VS Code mode) ─────────────────── */}
            {APP_MODE === 'vscode' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                <button
                  type="button"
                  disabled={officialParseLoading}
                  onClick={() => { setOfficialParseLoading(true); getVsCodeApi()?.postMessage({ type: 'requestVisualize' }); }}
                  title={officialParseLoading ? 'Visualizing…' : (vizStale ? 'Model changed since last render — click to re-parse and refresh' : 'Diagram is up to date — click to re-parse anyway')}
                  style={{
                    fontSize: 11, fontWeight: 600,
                    background: officialParseLoading ? '#1e293b' : (vizStale ? '#3a1e1e' : '#1e3a5f'),
                    color:      officialParseLoading ? '#93c5fd' : (vizStale ? '#fca5a5' : '#7dd3fc'),
                    border:     `1px solid ${officialParseLoading ? '#475569' : (vizStale ? '#f87171' : '#38bdf8')}`,
                    borderRadius: 3, padding: '2px 10px',
                    cursor: officialParseLoading ? 'progress' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span
                    title={officialParseLoading ? 'Visualizing…' : (vizStale ? 'Unvisualized edits' : 'In sync')}
                    style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: officialParseLoading ? '#facc15' : (vizStale ? '#f87171' : '#4ade80'),
                      boxShadow: `0 0 5px ${officialParseLoading ? '#facc15' : (vizStale ? '#f87171' : '#4ade80')}`,
                    }}
                  />
                  {officialParseLoading ? 'Visualizing…' : '⟳ Visualize'}
                </button>
                <label
                  style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  title="When off, edits don't auto-refresh the diagram — click Visualize to update. Recommended for large multi-file projects (slow re-parse)."
                >
                  <input
                    type="checkbox"
                    checked={autoViz}
                    onChange={e => { setAutoViz(e.target.checked); getVsCodeApi()?.postMessage({ type: 'setAutoRefresh', enabled: e.target.checked }); }}
                  />
                  Auto
                </label>
              </div>
            )}
            {/* ── Role switch ───────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>Role:</label>
              {(['architect', 'developer'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setUserRole(r)}
                  style={{
                    fontSize: 11,
                    background: userRole === r ? '#1e3a5f' : '#1e293b',
                    color:      userRole === r ? '#7dd3fc' : '#475569',
                    border:     `1px solid ${userRole === r ? '#38bdf8' : '#334155'}`,
                    borderRadius: 3, padding: '1px 8px',
                    cursor: 'pointer', textTransform: 'capitalize',
                  }}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
              {!isVSCodeMode && (
                <input
                  type="text"
                  value={serviceEndpoint}
                  onChange={e => setServiceEndpoint(e.target.value)}
                  placeholder="http://localhost:9001"
                  title="SysML v2 parser service endpoint URL"
                  style={{
                    fontSize: 11, background: '#1e293b', color: '#e2e8f0',
                    border: '1px solid #334155', borderRadius: 3,
                    padding: '1px 6px', width: 190,
                  }}
                />
              )}
              <button
                type="button"
                title={
                  trlcData
                    ? `TRLC loaded: ${trlcData.requirements.length} reqts`
                    : trlcImportError
                      ? `Import error: ${trlcImportError}`
                      : 'Import TRLC requirements (.trlc file or JSON)'
                }
                onClick={() => trlcFileInputRef.current?.click()}
                style={{
                  fontSize: 11,
                  background: trlcData ? '#0d2e1a' : trlcImportError ? '#2d0808' : '#1e293b',
                  color:      trlcData ? '#4ade80' : trlcImportError ? '#f87171' : '#94a3b8',
                  border: `1px solid ${trlcData ? '#4ade80' : trlcImportError ? '#ef4444' : '#334155'}`,
                  borderRadius: 3, padding: '1px 6px',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {trlcData ? `TRLC (${trlcData.requirements.length})` : 'TRLC'}
              </button>
              {/* Project context files for cross-file import resolution */}
              <button
                type="button"
                title={
                  projectFiles.length > 0
                    ? `${projectFiles.length} context file(s): ${projectFiles.map(f => f.name).join(', ')}`
                    : 'Load context .sysml files (for cross-file import resolution)'
                }
                onClick={() => projectFilesInputRef.current?.click()}
                style={{
                  fontSize: 11,
                  background: projectFiles.length > 0 ? '#0d1f3c' : '#1e293b',
                  color:      projectFiles.length > 0 ? '#7dd3fc' : '#94a3b8',
                  border: `1px solid ${projectFiles.length > 0 ? '#38bdf8' : '#334155'}`,
                  borderRadius: 3, padding: '1px 6px',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {projectFiles.length > 0 ? `${projectFiles.length} context file(s)` : 'Context'}
              </button>
              {projectFiles.length > 0 && (
                <button
                  type="button"
                  title="Clear all context files"
                  onClick={() => setProjectFiles([])}
                  style={{
                    fontSize: 11, background: '#1e293b', color: '#94a3b8',
                    border: '1px solid #334155', borderRadius: 3,
                    padding: '1px 5px', cursor: 'pointer',
                  }}
                >
                  x
                </button>
              )}
              {/* ── Model checker button ──────────────────────────────── */}
              <button
                type="button"
                disabled={validatorRunning || !hasGraph}
                title={
                  !hasGraph          ? 'No model loaded — parse a .sysml file first' :
                  validatorRunning   ? 'Running model checker…' :
                  validatorRanOnce   ? `Re-run model checker (last: ${validatorIssueCount} issue${validatorIssueCount !== 1 ? 's' : ''})` :
                                       'Run SysML v2 model checker'
                }
                onClick={() => {
                  setValidatorRunning(true);
                  getVsCodeApi()?.postMessage({ type: 'runValidator' });
                }}
                style={{
                  fontSize: 11,
                  background: !validatorRanOnce ? '#1e293b'
                            : validatorErrCount  > 0 ? '#2d0f0f'
                            : validatorWarnCount > 0 ? '#1f1a0a'
                            : '#0d2e1a',
                  color: !validatorRanOnce ? '#94a3b8'
                       : validatorErrCount  > 0 ? '#f87171'
                       : validatorWarnCount > 0 ? '#facc15'
                       : '#4ade80',
                  border: `1px solid ${
                    !validatorRanOnce ? '#334155'
                    : validatorErrCount  > 0 ? '#ef4444'
                    : validatorWarnCount > 0 ? '#eab308'
                    : '#22c55e'
                  }`,
                  borderRadius: 3, padding: '1px 8px',
                  cursor: validatorRunning || !hasGraph ? 'default' : 'pointer',
                  opacity: validatorRunning || !hasGraph ? 0.5 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {validatorRunning ? 'Checking…'
                  : !validatorRanOnce ? 'Validate'
                  : validatorIssueCount === 0 ? '✓ Valid'
                  : `⚠ ${validatorIssueCount} issue${validatorIssueCount !== 1 ? 's' : ''}`}
              </button>
              <label
                title="Sync Cursor — editor cursor position updates the visualizer selection"
                style={{
                  fontSize: 11, color: syncCursor ? '#7dd3fc' : '#475569',
                  display: 'flex', alignItems: 'center', gap: 3,
                  cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                }}
              >
                <input
                  type="checkbox"
                  checked={syncCursor}
                  onChange={() => setSyncCursor(v => !v)}
                  style={{ cursor: 'pointer', accentColor: '#38bdf8' }}
                />
                Sync
              </label>
              <label
                title="Focus Subtree — behavior view zooms to the selected action node"
                style={{
                  fontSize: 11, color: focusSubtree ? '#86efac' : '#475569',
                  display: 'flex', alignItems: 'center', gap: 3,
                  cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                }}
              >
                <input
                  type="checkbox"
                  checked={focusSubtree}
                  onChange={() => setFocusSubtree(v => !v)}
                  style={{ cursor: 'pointer', accentColor: '#4ade80' }}
                />
                Focus
              </label>
            </div>
            {tab === 'sequence' && behavioralOccurrences.length > 0 && (
              <div className="occurrence-selector">
                <label>Scenario</label>
                <select
                  value={selectedOccurrence}
                  onChange={e => setSelected(e.target.value)}
                  className="occurrence-select"
                >
                  {behavioralOccurrences.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}
            {tab === 'state' && stateMachineNames.length > 0 && (
              <div className="occurrence-selector">
                <label>State Machine</label>
                <select
                  value={selectedStateMachine}
                  onChange={e => setSelectedStateMachine(e.target.value)}
                  className="occurrence-select"
                >
                  {stateMachineNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="view-area">
            {/* ── Parsing overlay: covers the view until the full model is ready ── */}
            {officialParseLoading && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 50,
                background: 'rgba(30,30,46,0.9)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 14, fontFamily: 'monospace',
              }}>
                <div className="parse-spinner" />
                <div style={{ fontSize: 13, color: '#93c5fd', fontWeight: 600 }}>Working… parsing model</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Resolving the full model — the view updates when everything is ready.
                </div>
              </div>
            )}
            {/* ── Parser status banner ──────────────────────────────────── */}
            <div style={{
              padding: '10px 16px',
              background: '#0f172a',
              borderBottom: '1px solid #1e293b',
              fontFamily: 'monospace',
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              {!isVSCodeMode && (
                <span style={{ color: '#64748b' }}>
                  Requires the SysML v2 parser service. See{' '}
                  <code style={{ color: '#94a3b8' }}>parser-service/README.md</code>.
                </span>
              )}
              {officialParseLoading && (
                <span style={{ color: '#94a3b8' }}>Parsing…</span>
              )}
              {!officialParseLoading && officialParseResult?.error === 'SERVICE_UNAVAILABLE' && (
                <span style={{ color: '#ef4444' }}>
                  {isVSCodeMode
                    ? 'Parser not available. Ensure the Java parser is installed.'
                    : `Parser service not available. Check endpoint: ${serviceEndpoint}`}
                </span>
              )}
              {!officialParseLoading && officialParseResult && officialParseResult.error !== 'SERVICE_UNAVAILABLE' && (() => {
                const hasData = !!(officialParseResult.graph?.nodes?.length || officialParseResult.behavior?.actions?.length);
                const unresolvedCount = officialParseResult.diagnostics.filter(
                  d => d.severity === 'error' && d.message.includes("Couldn't resolve reference"),
                ).length;
                const realErrorCount = officialParseResult.diagnostics.filter(
                  d => d.severity === 'error' && !d.message.includes("Couldn't resolve reference"),
                ).length;
                const onlyUnresolvedRefs = !officialParseResult.success && hasData && realErrorCount === 0;
                const color = officialParseResult.success ? '#4ade80' : onlyUnresolvedRefs ? '#facc15' : '#fb923c';
                const message = officialParseResult.success
                  ? 'Parsed successfully.'
                  : onlyUnresolvedRefs
                    ? `Parsed — ${unresolvedCount} unresolved import(s).`
                    : `Parse failed — ${officialParseResult.diagnostics.length} issue(s) reported.`;
                return (
                  <span style={{ color }}>
                    {message}
                    {!isVSCodeMode && officialParseResult.error && ` (${officialParseResult.error})`}
                  </span>
                );
              })()}
            </div>
            {/* ── Validator results panel ──────────────────────────────── */}
            {validatorRanOnce && (
              <div style={{
                background: '#0a0f1a',
                borderBottom: '1px solid #1e293b',
                fontFamily: 'monospace',
                fontSize: 11,
                flexShrink: 0,
              }}>
                {/* Header row — always visible, click to expand/collapse */}
                <div
                  style={{
                    padding: '4px 16px', display: 'flex', alignItems: 'center',
                    gap: 8, cursor: 'pointer', userSelect: 'none',
                  }}
                  onClick={() => setValidatorPanelOpen(v => !v)}
                >
                  <span style={{ fontWeight: 600, color: '#475569' }}>Model Checker</span>
                  <span style={{
                    color: validatorErrCount  > 0 ? '#f87171'
                         : (validatorWarnCount > 0 || validatorParsePartial > 0) ? '#facc15'
                         : '#4ade80',
                  }}>
                    {validatorIssueCount === 0
                      ? (validatorParsePartial > 0 ? 'no rule violations' : '✓ no issues')
                      : `${validatorErrCount > 0 ? `${validatorErrCount} error${validatorErrCount !== 1 ? 's' : ''}` : ''}${validatorErrCount > 0 && validatorWarnCount > 0 ? ', ' : ''}${validatorWarnCount > 0 ? `${validatorWarnCount} warning${validatorWarnCount !== 1 ? 's' : ''}` : ''}`
                    }
                  </span>
                  {validatorParsePartial > 0 && (
                    <span
                      style={{ color: '#facc15' }}
                      title="The parser reported errors, so the model checker ran over the partial model it could recover. These structural checks are not a clean bill of health — fix the parse errors first."
                    >
                      · ⚠ ran on a partial model — parse has {validatorParsePartial} error{validatorParsePartial !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', color: '#475569', fontSize: 9 }}>
                    {validatorPanelOpen ? '▲' : '▼'}
                  </span>
                </div>
                {/* Issue list */}
                {validatorPanelOpen && validatorDiags.length > 0 && (
                  <div style={{ maxHeight: 160, overflowY: 'auto', padding: '0 16px 6px' }}>
                    {validatorDiags.map((d, i) => (
                      <div
                        key={i}
                        className={`diag-row diag-${d.severity}`}
                        onClick={() => d.line && jumpToLine(d.line)}
                        title={d.message}
                        style={{ cursor: d.line ? 'pointer' : 'default' }}
                      >
                        <span className="diag-sev-icon">
                          {d.severity === 'error' ? '✖' : d.severity === 'warning' ? '⚠' : 'ℹ'}
                        </span>
                        {d.line && <span className="diag-loc">L{d.line}</span>}
                        {d.code  && <span className="diag-code">{d.code}</span>}
                        <span className="diag-msg">{d.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <ErrorBoundary label="Structure view error">
              {tab === 'structure' && (
                <StructureView
                  result={vizModel}
                  graph={officialParseResult?.graph}
                  selection={selection}
                  onSelect={selectFromDiagram}
                  onShapeContextMenu={openShapeMenu}
                />
              )}
            </ErrorBoundary>
            <ErrorBoundary label="Sequence view error">
              {tab === 'sequence' && (
                officialParseResult
                  ? <SysMLSequenceView
                      graph={officialParseResult.graph}
                      dependencies={officialParseResult.dependencies}
                      timing={officialParseResult.timing}
                      selection={selection}
                      onSelect={setSelection}
                    />
                  : <SequenceView
                      result={vizModel}
                      occurrenceName={selectedOccurrence}
                      selection={selection}
                      onSelect={setSelection}
                    />
              )}
            </ErrorBoundary>
            <ErrorBoundary label="Structural wiring error">
              {tab === 'flow' && (
                <StructuralWiringView
                  graph={officialParseResult?.graph}
                  selection={selection}
                  onSelect={selectFromDiagram}
                  onShapeContextMenu={openShapeMenu}
                  source={source}
                  onIncrementalEdit={
                    APP_MODE === 'vscode'
                      ? (edit: IncrementalEdit) => getVsCodeApi()?.postMessage({ type: 'applyIncrementalEdit', edit })
                      : undefined
                  }
                  onAddMemberToDef={
                    APP_MODE === 'vscode'
                      ? (defName: string, memberText: string) => getVsCodeApi()?.postMessage({ type: 'addMemberToDef', defName, memberText })
                      : undefined
                  }
                />
              )}
            </ErrorBoundary>
            <ErrorBoundary label="Behavior view error">
              {tab === 'behavior' && (
                <OfficialBehaviorView
                  behavior={officialParseResult?.behavior}
                  behaviorName={selectedBehavior}
                  behaviorNames={behaviorDefNames}
                  onBehaviorChange={setSelectedBehavior}
                  selection={selection}
                  onSelect={selectFromDiagram}
                  onShapeContextMenu={openShapeMenu}
                  focusSubtree={focusSubtree}
                />
              )}
            </ErrorBoundary>
            <ErrorBoundary label="State view error">
              {tab === 'state' && (
                <StateView
                  result={vizModel}
                  stateMachineName={selectedStateMachine}
                  selection={selection}
                  onSelect={selectFromDiagram}
                  onShapeContextMenu={openShapeMenu}
                />
              )}
            </ErrorBoundary>
            <ErrorBoundary label="Requirements view error">
              {tab === 'requirements' && (
                <RequirementsView
                  result={vizModel}
                  selection={selection}
                  onSelect={setSelection}
                  trlcData={trlcDataWithTraces ?? undefined}
                />
              )}
            </ErrorBoundary>
            <ErrorBoundary label="Traceability view error">
              {tab === 'traceability' && (
                <TraceabilityView
                  result={vizModel}
                  selection={selection}
                  onSelect={selectFromDiagram}
                  onShapeContextMenu={openShapeMenu}
                  trlcData={trlcDataWithTraces ?? undefined}
                  graph={officialParseResult?.graph}
                />
              )}
            </ErrorBoundary>
            <ErrorBoundary label="JSON view error">
              {tab === 'json' && <JsonView result={vizModel} />}
            </ErrorBoundary>
            <ErrorBoundary label="Containment graph error">
              {tab === 'graph' && (
                officialParseResult?.graph
                  ? <ContainmentGraphView graph={officialParseResult.graph} onSelect={selectFromDiagram} onShapeContextMenu={openShapeMenu} />
                  : <div style={{ padding: 24, color: '#64748b', fontFamily: 'monospace', fontSize: 13 }}>
                      No graph data yet. Open a SysML v2 file to parse it.
                    </div>
              )}
            </ErrorBoundary>
          </div>
        </div>

        {/* Column 4: Inspector — architect role only */}
        {userRole === 'architect' && (inspectorOpen ? (
          <InspectorPanel
            selection={selection}
            result={vizModel}
            source={source}
            impactTrace={impactTrace ?? undefined}
            trlcData={trlcDataWithTraces ?? undefined}
            onSelect={setSelection}
            onSourceChange={
              APP_MODE === 'vscode'
                ? (newText: string) => {
                    getVsCodeApi()?.postMessage({ type: 'applyFullTextEdit', newText });
                  }
                : setSource
            }
            onIncrementalEdit={
              APP_MODE === 'vscode'
                ? (edit: IncrementalEdit) => {
                    getVsCodeApi()?.postMessage({ type: 'applyIncrementalEdit', edit });
                  }
                : undefined
            }
            onCollapse={() => setInspectorOpen(false)}
          />
        ) : (
          <button
            className="panel-collapsed-strip panel-border-left"
            onClick={() => setInspectorOpen(true)}
          >
            <span className="panel-tab-label">Inspector</span>
          </button>
        ))}

      </div>

      {/* ── Hidden TRLC file input ───────────────── */}
      <input
        ref={trlcFileInputRef}
        type="file"
        accept=".trlc,.json"
        style={{ display: 'none' }}
        onChange={handleTrlcFileInput}
      />

      {/* ── Hidden project context files input ──── */}
      <input
        ref={projectFilesInputRef}
        type="file"
        multiple
        accept=".sysml"
        style={{ display: 'none' }}
        onChange={handleProjectFilesInput}
      />

      {/* ── Modals (standalone only) ─────────────── */}

      {APP_MODE === 'standalone' && showLoadModal && (
        <ProjectModal
          projects={projects}
          activeProjectId={activeProject?.id ?? null}
          onLoad={handleLoadProject}
          onDelete={handleDeleteProject}
          onClose={() => setShowLoadModal(false)}
        />
      )}

      {APP_MODE === 'standalone' && newModalMode !== null && (
        <ActionModal
          title={newModalMode === 'new' ? 'New Project' : 'Save As'}
          submitLabel={newModalMode === 'new' ? 'Create' : 'Save'}
          fields={[{
            key: 'name',
            label: 'Project name',
            type: 'text',
            placeholder: 'e.g. Brake System',
          }]}
          onSubmit={submitProjectName}
          onClose={() => setNewModalMode(null)}
        />
      )}

      {APP_MODE === 'standalone' && showHistoryModal && (
        <HistoryModal
          history={history}
          onRestore={handleHistoryRestore}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {/* ── Right-click "Go to model" menu for diagram shapes ──────────────── */}
      {shapeMenu && (
        <div
          onClick={() => setShapeMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setShapeMenu(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 4000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', left: shapeMenu.x, top: shapeMenu.y,
              background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
              boxShadow: '0 6px 20px rgba(0,0,0,0.45)', padding: 4, minWidth: 150,
              fontFamily: 'system-ui, sans-serif', fontSize: 12,
            }}
          >
            <button
              onClick={() => goToModel(shapeMenu.sel)}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#334155')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                padding: '6px 10px', background: 'transparent', color: '#e2e8f0',
                border: 'none', borderRadius: 4, cursor: 'pointer',
              }}
            >
              <span aria-hidden>↦</span> Go to model
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

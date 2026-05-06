import { useState, useMemo, useEffect, useRef } from 'react';
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import type { editor as MonacoEditorNS } from 'monaco-editor';
import { parse } from './parser';
import { BRK_SAMPLE } from './sample';
import { SYSML_TOKENS, SYSML_THEME } from './sysmlLanguage';
import ModelExplorer from './views/ModelExplorer';
import StructureView from './views/StructureView';
import SequenceView from './views/SequenceView';
import BehaviorView from './views/BehaviorView';
import StateView from './views/StateView';
import RequirementsView from './views/RequirementsView';
import TraceabilityView from './views/TraceabilityView';
import JsonView from './views/JsonView';
import InspectorPanel from './views/InspectorPanel';
import ProjectBar from './views/ProjectBar';
import ProjectModal from './views/ProjectModal';
import ActionModal from './views/ActionModal';
import HistoryModal from './views/HistoryModal';
import ErrorBoundary from './ErrorBoundary';
import type { SysMLNode, SelectionState } from './types';
import type { Project } from './projects';
import {
  saveProjects, persistActiveId,
  setAutosave, generateId, makeTemplate,
  getInitialProjectState,
} from './projects';
import {
  makeSnapshot, MAX_HISTORY, HISTORY_DEBOUNCE_MS,
  type HistorySnapshot,
} from './history';
import './App.css';

type ViewTab = 'structure' | 'sequence' | 'behavior' | 'state' | 'requirements' | 'traceability' | 'json';

const TAB_LABELS: Record<ViewTab, string> = {
  structure:    'Structure',
  sequence:     'Sequence',
  behavior:     'Behavior',
  state:        'State',
  requirements: 'Reqts',
  traceability: 'Trace',
  json:         'JSON',
};

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

  // ── Project state ──────────────────────────────────────────────────────────
  const [projects, setProjects]           = useState<Project[]>(init.projects);
  const [activeProject, setActiveProject] = useState<Project | null>(init.active);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [newModalMode, setNewModalMode]   = useState<'new' | 'saveAs' | null>(null);

  // ── History state ──────────────────────────────────────────────────────────
  const [history, setHistory]             = useState<HistorySnapshot[]>(() => [
    makeSnapshot(init.text, parse(init.text)),
  ]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const historyDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipHistoryPush = useRef(false);

  const isUnsaved = !activeProject || source !== activeProject.sysmlText;

  // ── Monaco refs ────────────────────────────────────────────────────────────
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // ── Parse ──────────────────────────────────────────────────────────────────
  const result = useMemo(() => parse(source), [source]);

  const behavioralOccurrences = useMemo(
    () => result.nodes
      .filter((n): n is Extract<SysMLNode, { kind: 'occurrenceDef' }> =>
        n.kind === 'occurrenceDef' && n.body.some(b => b.kind === 'message'))
      .map(n => n.name),
    [result],
  );

  const behaviorDefNames = useMemo(
    () => result.nodes
      .filter((n): n is Extract<SysMLNode, { kind: 'behaviorDef' }> => n.kind === 'behaviorDef')
      .map(n => n.name),
    [result],
  );

  const stateMachineNames = useMemo(
    () => result.nodes
      .filter((n): n is Extract<SysMLNode, { kind: 'stateDef' }> => n.kind === 'stateDef')
      .map(n => n.name),
    [result],
  );

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
        const next = [...prev, makeSnapshot(source, result)];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });
    }, HISTORY_DEBOUNCE_MS);
  }, [source, result]);

  // Sync parser diagnostics → Monaco markers
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(
      model, 'sysml',
      result.diagnostics.map(d => ({
        severity: d.severity === 'error'
          ? monaco.MarkerSeverity.Error
          : monaco.MarkerSeverity.Warning,
        startLineNumber: d.line,
        startColumn: 1,
        endLineNumber: d.line,
        endColumn: d.line <= model.getLineCount()
          ? model.getLineMaxColumn(d.line) : 999,
        message: d.message,
      })),
    );
  }, [result.diagnostics]);

  // ── Cmd/Ctrl+S shortcut ────────────────────────────────────────────────────

  // Use a ref so the handler always sees latest state without stale closures
  const saveRef = useRef<() => void>(() => {});
  saveRef.current = handleSave;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inEditor = !!(editorRef.current?.hasTextFocus());
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
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
  };

  const errCount  = result.diagnostics.filter(d => d.severity === 'error').length;
  const warnCount = result.diagnostics.filter(d => d.severity === 'warning').length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="app-root">

      {/* ── Project bar ───────────────────────────── */}
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

      {/* ── 4-column workspace ────────────────────── */}
      <div className="app-layout">

        {/* Column 1: Editor */}
        <div className="panel editor-panel">
          <div className="panel-header">
            <span>SysML v2 Source</span>
            {result.diagnostics.length > 0 && (
              <span className="diag-badge">
                {errCount  > 0 && <span className="badge-error">{errCount} err</span>}
                {warnCount > 0 && <span className="badge-warn">{warnCount} warn</span>}
              </span>
            )}
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

          {result.diagnostics.length > 0 && (
            <div className="diagnostics-panel">
              <div className="diag-panel-hdr">Problems — click to navigate</div>
              {result.diagnostics.map((d, i) => (
                <div
                  key={i}
                  className={`diag-row diag-${d.severity}`}
                  onClick={() => jumpToLine(d.line)}
                  title={`Line ${d.line}: ${d.message}`}
                >
                  <span className="diag-sev-icon">{d.severity === 'error' ? '✖' : '⚠'}</span>
                  <span className="diag-loc">L{d.line}</span>
                  <span className="diag-msg">{d.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Model Explorer */}
        <ModelExplorer
          result={result}
          selectedOccurrence={selectedOccurrence}
          selectedBehavior={selectedBehavior}
          selectedStateMachine={selectedStateMachine}
          selection={selection}
          onSelectScenario={name => { setSelected(name); setTab('sequence'); }}
          onSelectBehavior={name => { setSelectedBehavior(name); setTab('behavior'); }}
          onSelectStateMachine={name => { setSelectedStateMachine(name); setTab('state'); }}
          onSelect={setSelection}
          onNavigate={setTab}
        />

        {/* Column 3: Visualization */}
        <div className="panel viz-panel">
          <div className="panel-header tabs">
            <div className="tab-group">
              {(['structure', 'sequence', 'behavior', 'state', 'requirements', 'traceability', 'json'] as ViewTab[]).map(t => (
                <button
                  key={t}
                  className={`tab-btn${tab === t ? ' active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
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
            {tab === 'behavior' && behaviorDefNames.length > 0 && (
              <div className="occurrence-selector">
                <label>Behavior</label>
                <select
                  value={selectedBehavior}
                  onChange={e => setSelectedBehavior(e.target.value)}
                  className="occurrence-select"
                >
                  {behaviorDefNames.map(name => (
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
            <ErrorBoundary label="Structure view error">
              {tab === 'structure' && (
                <StructureView result={result} selection={selection} onSelect={setSelection} />
              )}
            </ErrorBoundary>
            <ErrorBoundary label="Sequence view error">
              {tab === 'sequence' && (
                <SequenceView
                  result={result}
                  occurrenceName={selectedOccurrence}
                  selection={selection}
                  onSelect={setSelection}
                />
              )}
            </ErrorBoundary>
            <ErrorBoundary label="Behavior view error">
              {tab === 'behavior' && (
                <BehaviorView
                  result={result}
                  behaviorName={selectedBehavior}
                  selection={selection}
                  onSelect={setSelection}
                />
              )}
            </ErrorBoundary>
            <ErrorBoundary label="State view error">
              {tab === 'state' && (
                <StateView
                  result={result}
                  stateMachineName={selectedStateMachine}
                  selection={selection}
                  onSelect={setSelection}
                />
              )}
            </ErrorBoundary>
            <ErrorBoundary label="Requirements view error">
              {tab === 'requirements' && (
                <RequirementsView result={result} selection={selection} onSelect={setSelection} />
              )}
            </ErrorBoundary>
            <ErrorBoundary label="Traceability view error">
              {tab === 'traceability' && (
                <TraceabilityView result={result} selection={selection} onSelect={setSelection} />
              )}
            </ErrorBoundary>
            <ErrorBoundary label="JSON view error">
              {tab === 'json' && <JsonView result={result} />}
            </ErrorBoundary>
          </div>
        </div>

        {/* Column 4: Inspector */}
        <InspectorPanel
          selection={selection}
          result={result}
          source={source}
          onSourceChange={setSource}
        />

      </div>

      {/* ── Modals ────────────────────────────────── */}

      {showLoadModal && (
        <ProjectModal
          projects={projects}
          activeProjectId={activeProject?.id ?? null}
          onLoad={handleLoadProject}
          onDelete={handleDeleteProject}
          onClose={() => setShowLoadModal(false)}
        />
      )}

      {newModalMode !== null && (
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

      {showHistoryModal && (
        <HistoryModal
          history={history}
          onRestore={handleHistoryRestore}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

    </div>
  );
}

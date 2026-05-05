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
import JsonView from './views/JsonView';
import InspectorPanel from './views/InspectorPanel';
import ErrorBoundary from './ErrorBoundary';
import type { SysMLNode, SelectionState } from './types';
import './App.css';

type ViewTab = 'structure' | 'sequence' | 'json';

export default function App() {
  const [source, setSource]               = useState(BRK_SAMPLE);
  const [tab, setTab]                     = useState<ViewTab>('structure');
  const [selectedOccurrence, setSelected] = useState('');
  const [selection, setSelection]         = useState<SelectionState>(null);

  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const result = useMemo(() => parse(source), [source]);

  const behavioralOccurrences = useMemo(
    () => result.nodes
      .filter((n): n is Extract<SysMLNode, { kind: 'occurrenceDef' }> =>
        n.kind === 'occurrenceDef' && n.body.some(b => b.kind === 'message'))
      .map(n => n.name),
    [result],
  );

  useEffect(() => {
    setSelected(cur => {
      if (behavioralOccurrences.length === 0)    return '';
      if (behavioralOccurrences.includes(cur))   return cur;
      return behavioralOccurrences[0];
    });
  }, [behavioralOccurrences]);

  // Sync parser diagnostics → Monaco squiggle markers
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

  return (
    <div className="app-layout">

      {/* ── Column 1: Editor ──────────────────── */}
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

      {/* ── Column 2: Model Explorer ──────────── */}
      <ModelExplorer
        result={result}
        selectedOccurrence={selectedOccurrence}
        selection={selection}
        onSelectScenario={name => { setSelected(name); setTab('sequence'); }}
        onSelect={setSelection}
        onNavigate={setTab}
      />

      {/* ── Column 3: Visualization ───────────── */}
      <div className="panel viz-panel">
        <div className="panel-header tabs">
          <div className="tab-group">
            {(['structure', 'sequence', 'json'] as ViewTab[]).map(t => (
              <button
                key={t}
                className={`tab-btn${tab === t ? ' active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
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
          <ErrorBoundary label="JSON view error">
            {tab === 'json' && <JsonView result={result} />}
          </ErrorBoundary>
        </div>
      </div>

      {/* ── Column 4: Inspector ───────────────── */}
      <InspectorPanel selection={selection} result={result} />

    </div>
  );
}

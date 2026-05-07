import { useRef } from 'react';

interface Props {
  projectName: string | null;
  isUnsaved: boolean;
  canRevert: boolean;
  onSave: () => void;
  onNew: () => void;
  onLoad: () => void;
  onExport: () => void;
  onImport: (text: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onHistory: () => void;
  onRevert: () => void;
}

export default function ProjectBar({
  projectName, isUnsaved, canRevert,
  onSave, onNew, onLoad, onExport, onImport,
  onUndo, onRedo, onHistory, onRevert,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => onImport((evt.target?.result as string) ?? '');
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="project-bar">
      <span className="pbar-logo">SysML v2</span>
      <div className="pbar-sep" />

      <span className="pbar-project-name">
        {projectName ?? 'Untitled'}
      </span>
      <span className={`pbar-status ${isUnsaved ? 'pbar-unsaved' : 'pbar-saved'}`}>
        {isUnsaved ? '● unsaved' : '● saved'}
      </span>

      <div style={{ flex: 1 }} />

      <div className="pbar-actions">
        <Btn onClick={onUndo}  title="Undo (⌘Z)">↩ Undo</Btn>
        <Btn onClick={onRedo}  title="Redo (⌘⇧Z)">↪ Redo</Btn>
        <div className="pbar-divider" />
        <Btn onClick={onSave}  title="Save project (⌘S)">Save</Btn>
        {canRevert && (
          <Btn onClick={onRevert} title="Revert to last saved version">Revert</Btn>
        )}
        <Btn onClick={onNew}   title="Create new project">New</Btn>
        <Btn onClick={onLoad}  title="Open a saved project">Load</Btn>
        <Btn onClick={onHistory} title="Browse model history">History</Btn>
        <div className="pbar-divider" />
        <Btn onClick={onExport}                       title="Download as .sysml">Export</Btn>
        <Btn onClick={() => fileRef.current?.click()} title="Import .sysml / .txt file">Import</Btn>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".sysml,.txt"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </div>
  );
}

function Btn({ children, onClick, title }: {
  children: React.ReactNode; onClick: () => void; title?: string;
}) {
  return (
    <button className="pbar-btn" onClick={onClick} title={title} type="button">
      {children}
    </button>
  );
}

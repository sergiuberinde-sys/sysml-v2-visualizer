import { useState, useEffect, useRef } from 'react';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'select';
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

interface Props {
  title: string;
  fields: FieldDef[];
  submitLabel?: string;
  // Return an error string on failure, null on success
  onSubmit: (values: Record<string, string>) => string | null;
  onClose: () => void;
}

export default function ActionModal({ title, fields, submitLabel = 'Add', onSubmit, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(
      fields.map(f => [f.key, f.defaultValue ?? f.options?.[0]?.value ?? '']),
    ),
  );
  const [error, setError] = useState('');
  const firstRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    (firstRef.current as HTMLInputElement | null)?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set(key: string, value: string) {
    setValues(prev => ({ ...prev, [key]: value }));
    if (error) setError('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = onSubmit(values);
    if (err) { setError(err); return; }
    onClose();
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <form onSubmit={handleSubmit}>
          {fields.map((f, i) => (
            <div key={f.key} className="modal-field">
              <label className="modal-label">{f.label}</label>
              {f.type === 'select' ? (
                <select
                  ref={i === 0 ? el => { firstRef.current = el; } : undefined}
                  className="modal-input modal-select"
                  value={values[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                >
                  {f.options?.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  ref={i === 0 ? el => { firstRef.current = el; } : undefined}
                  className="modal-input"
                  type="text"
                  value={values[f.key]}
                  placeholder={f.placeholder}
                  onChange={e => set(f.key, e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              )}
              {f.hint && <div className="modal-hint">{f.hint}</div>}
            </div>
          ))}
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="modal-btn modal-btn-ok">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

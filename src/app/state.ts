export interface Project {
  id: string;
  name: string;
  sysmlText: string;
  createdAt: number;
  updatedAt: number;
}

const KEY_PROJECTS  = 'sysml-projects';
const KEY_ACTIVE    = 'sysml-active-project';
const KEY_AUTOSAVE  = 'sysml-autosave';

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY_PROJECTS);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(KEY_PROJECTS, JSON.stringify(projects));
}

export function getActiveProjectId(): string | null {
  return localStorage.getItem(KEY_ACTIVE);
}

export function persistActiveId(id: string | null): void {
  if (id) localStorage.setItem(KEY_ACTIVE, id);
  else localStorage.removeItem(KEY_ACTIVE);
}

export function getAutosave(): string | null {
  return localStorage.getItem(KEY_AUTOSAVE);
}

export function setAutosave(text: string): void {
  localStorage.setItem(KEY_AUTOSAVE, text);
}

export function generateId(): string {
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makeTemplate(name: string): string {
  const pkg = name.replace(/\s+/g, '');
  return `package ${pkg};

// Add interface and part definitions here.
`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Called once at app startup to derive initial state
export function getInitialProjectState(fallbackText: string) {
  const projects = loadProjects();
  const id       = getActiveProjectId();
  const active   = id ? (projects.find(p => p.id === id) ?? null) : null;
  const text     = active?.sysmlText ?? getAutosave() ?? fallbackText;
  return { projects, active, text };
}

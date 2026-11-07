/**
 * Idea pendiente: lo que el visitante escribe en la homepage antes de registrarse.
 * Se guarda en sessionStorage (y localStorage como respaldo) y se consume en
 * /projects/new tras la autenticación.
 */
const KEY = "ideon.pendingIdea";

export interface PendingIdea {
  idea: string;
  locale: string;
  savedAt: string;
}

export function savePendingIdea(idea: string, locale: string) {
  const payload: PendingIdea = { idea, locale, savedAt: new Date().toISOString() };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* almacenamiento no disponible (modo privado); el flujo sigue sin persistir */
  }
}

export function readPendingIdea(): PendingIdea | null {
  try {
    const raw = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingIdea;
    if (!parsed?.idea) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingIdea() {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

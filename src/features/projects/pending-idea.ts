/**
 * Idea pendiente: lo que el visitante escribe en la homepage antes de registrarse.
 * Se guarda en sessionStorage (y localStorage como respaldo) y se consume en
 * /projects/new tras la autenticación.
 */
const KEY = "ideon.pendingIdea";

export interface PendingIdea {
  idea: string;
  locale: string;
  kind?: string;
  savedAt: string;
}

export function savePendingIdea(idea: string, locale: string, kind = "web") {
  const payload: PendingIdea = { idea, locale, kind, savedAt: new Date().toISOString() };
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

// ----------------------------------------------------------------- adjuntos pendientes
// Los archivos adjuntados en la homepage antes de registrarse se guardan en
// IndexedDB (sessionStorage no admite archivos) y se suben al crear el proyecto.
const DB = "ideon"; const STORE = "pendingFiles";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

export async function savePendingFiles(files: File[]) {
  try { await tx("readwrite", (s) => s.put(files, "files")); } catch { /* sin IndexedDB: se adjuntan después */ }
}

export async function readPendingFiles(): Promise<File[]> {
  try { return ((await tx<File[] | undefined>("readonly", (s) => s.get("files"))) ?? []).filter((f) => f instanceof Blob); } catch { return []; }
}

export async function clearPendingFiles() {
  try { await tx("readwrite", (s) => s.delete("files")); } catch { /* ignore */ }
}

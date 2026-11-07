/**
 * Dominio elegido en la portada antes de tener proyecto: se guarda en el
 * navegador y se propone al activar el proyecto (o al comprar dominio después).
 */
const KEY = "ideon.pendingDomain";

export function savePendingDomain(domain: string) {
  try { localStorage.setItem(KEY, JSON.stringify({ domain, savedAt: new Date().toISOString() })); } catch { /* sin almacenamiento */ }
}

export function readPendingDomain(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { domain, savedAt } = JSON.parse(raw) as { domain?: string; savedAt?: string };
    // Una elección de hace más de 30 días ya no se propone.
    if (!domain || !savedAt || Date.now() - new Date(savedAt).getTime() > 30 * 86_400_000) return null;
    return domain;
  } catch { return null; }
}

export function clearPendingDomain() {
  try { localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
}

/**
 * Generador de propuestas (presupuestos) a partir de la especificación.
 * Módulo puro: los precios vienen de la configuración (pricing_plans); si el
 * administrador no ha fijado precio, la propuesta queda "según alcance".
 */
import type { PricingPlan, ProjectComplexity } from "@/types/database.types";

export interface SpecLike {
  kind?: string;
  name?: string;
  complexity?: string;
  estimated_days?: number;
  pages?: { title?: string; sections?: { heading?: string; type?: string; content?: string }[] }[];
  entities?: { label?: string; name?: string; fields?: unknown[] }[];
  workflows?: string[];
}

export interface ProposalDraft {
  title: string;
  summary: string;
  complexity: ProjectComplexity;
  plan_key: string | null;
  items: { name: string; description: string; effort_days: number }[];
  estimated_days: number;
  price: number | null;
  currency: string;
  external_costs: { name: string; amount: number | null; currency: string; period: string; note?: string }[];
  maintenance_option: { price: number | null; currency: string; period: string; includes: string[] } | null;
}

const VALID: ProjectComplexity[] = ["starter", "pro", "custom"];

export function buildProposal(spec: SpecLike, plans: PricingPlan[], currency = "USD"): ProposalDraft {
  const isApp = spec.kind === "app";
  const complexity: ProjectComplexity = VALID.includes(spec.complexity as ProjectComplexity)
    ? (spec.complexity as ProjectComplexity)
    : isApp ? "pro" : "starter";
  const plan = plans.find((p) => p.key === complexity) ?? null;

  const items: ProposalDraft["items"] = [];
  if (isApp) {
    for (const e of spec.entities ?? []) {
      items.push({ name: `Módulo ${e.label ?? e.name ?? "entidad"}`, description: `Listado, búsqueda, alta/edición y borrado (${(e.fields ?? []).length} campos).`, effort_days: 1.5 });
    }
    items.push({ name: "Panel de indicadores", description: "KPIs calculados sobre los datos de la aplicación.", effort_days: 1 });
    for (const w of spec.workflows ?? []) items.push({ name: "Flujo de negocio", description: w, effort_days: 1 });
    items.push({ name: "Diseño y responsive", description: "Sistema visual, navegación y adaptación a móvil.", effort_days: 1 });
    items.push({ name: "QA y entrega", description: "Pruebas funcionales, revisión y publicación.", effort_days: 1 });
  } else {
    for (const pg of spec.pages ?? []) for (const s of pg.sections ?? []) {
      items.push({ name: s.heading || s.type || "Sección", description: (s.content || "").slice(0, 160), effort_days: 0.5 });
    }
    items.push({ name: "Diseño y responsive", description: "Identidad visual, tipografía y adaptación a móvil.", effort_days: 1 });
    items.push({ name: "QA y publicación", description: "Comprobaciones, optimización y puesta en línea.", effort_days: 0.5 });
  }
  const effort = items.reduce((n, i) => n + i.effort_days, 0);
  const estimated_days = Math.max(1, Math.round(spec.estimated_days && spec.estimated_days > 0 ? spec.estimated_days : effort));

  const price = plan?.price_from != null ? Number(plan.price_from) : null;
  const cur = plan?.currency || currency;

  return {
    title: `Propuesta · ${spec.name ?? "Proyecto"}`,
    summary: isApp
      ? `Aplicación ${complexity === "custom" ? "a medida con integraciones" : "web funcional"} con ${(spec.entities ?? []).length} módulos y panel de indicadores.`
      : `Sitio web de una página con ${(spec.pages?.[0]?.sections ?? []).length} secciones, diseño responsive y formulario de contacto.`,
    complexity,
    plan_key: plan?.key ?? null,
    items,
    estimated_days,
    price,
    currency: cur,
    external_costs: [
      { name: "Hosting en Ideon (subdominio)", amount: 0, currency: cur, period: "mes", note: "Incluido en la Fase de publicación." },
      { name: "Dominio propio", amount: null, currency: cur, period: "año", note: "Según el registrador y la extensión elegida (.com, .co…)." },
    ],
    maintenance_option: { price: null, currency: cur, period: "mes", includes: ["Hosting", "Copias de seguridad", "Cambios menores por chat", "Soporte"] },
  };
}

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { PricingPlan, SolutionCategory } from "@/types/database.types";

/**
 * Catálogo de configuración (categorías y planes).
 * Fuente de verdad: tablas `solution_categories` y `pricing_plans` (ver supabase/seed.sql).
 * Si Supabase no está configurado (entorno local sin credenciales) se usa el
 * mismo contenido del seed como respaldo para que la web siga siendo navegable.
 */

export const FALLBACK_CATEGORIES: SolutionCategory[] = [
  { key: "web_app", name_es: "Aplicación web", name_en: "Web application", description_es: "Aplicaciones a medida con usuarios, datos y lógica de negocio.", description_en: "Custom apps with users, data and business logic.", icon: "app-window", sort_order: 10, is_active: true },
  { key: "website", name_es: "Web corporativa", name_en: "Corporate website", description_es: "Sitios web profesionales, rápidos y optimizados para SEO.", description_en: "Professional, fast, SEO-ready websites.", icon: "globe", sort_order: 20, is_active: true },
  { key: "ecommerce", name_es: "Tienda online", name_en: "Online store", description_es: "Catálogo, carrito, pagos y gestión de pedidos.", description_en: "Catalog, cart, payments and order management.", icon: "shopping-bag", sort_order: 30, is_active: true },
  { key: "crm", name_es: "CRM personalizado", name_en: "Custom CRM", description_es: "Seguimiento de clientes, oportunidades y ventas.", description_en: "Customers, pipeline and sales tracking.", icon: "users", sort_order: 40, is_active: true },
  { key: "erp", name_es: "Sistema ERP", name_en: "ERP system", description_es: "Gestión integral: compras, ventas, finanzas, operaciones.", description_en: "End-to-end management: purchasing, sales, finance, operations.", icon: "layers", sort_order: 50, is_active: true },
  { key: "inventory", name_es: "Inventario y almacenes", name_en: "Inventory & warehouses", description_es: "Stock, movimientos, recetas de producción y alertas.", description_en: "Stock, movements, production recipes and alerts.", icon: "package", sort_order: 60, is_active: true },
  { key: "management", name_es: "Gestión empresarial", name_en: "Business management", description_es: "Software administrativo y herramientas internas.", description_en: "Administrative software and internal tools.", icon: "briefcase", sort_order: 70, is_active: true },
  { key: "automation", name_es: "Automatización de procesos", name_en: "Process automation", description_es: "Flujos automáticos entre sistemas y tareas repetitivas.", description_en: "Automated flows between systems and repetitive tasks.", icon: "workflow", sort_order: 80, is_active: true },
  { key: "analytics", name_es: "Dashboards y analítica", name_en: "Dashboards & analytics", description_es: "Indicadores, informes y visualización de datos.", description_en: "KPIs, reports and data visualization.", icon: "bar-chart-3", sort_order: 90, is_active: true },
  { key: "portal", name_es: "Portales de clientes y proveedores", name_en: "Customer & supplier portals", description_es: "Áreas privadas con pedidos, documentos y seguimiento.", description_en: "Private areas with orders, documents and tracking.", icon: "door-open", sort_order: 100, is_active: true },
  { key: "saas", name_es: "Plataforma SaaS", name_en: "SaaS platform", description_es: "Productos multiusuario con suscripciones y planes.", description_en: "Multi-tenant products with subscriptions and plans.", icon: "cloud", sort_order: 110, is_active: true },
  { key: "integration", name_es: "Integraciones", name_en: "Integrations", description_es: "Conexión entre sistemas, APIs y servicios externos.", description_en: "Connecting systems, APIs and external services.", icon: "plug", sort_order: 120, is_active: true },
  { key: "ai_agent", name_es: "Agentes y asistentes de IA", name_en: "AI agents & assistants", description_es: "Asistentes conversacionales y agentes autónomos.", description_en: "Conversational assistants and autonomous agents.", icon: "bot", sort_order: 130, is_active: true },
  { key: "internal_tool", name_es: "Herramientas internas", name_en: "Internal tools", description_es: "Utilidades a medida para equipos y operaciones.", description_en: "Custom utilities for teams and operations.", icon: "wrench", sort_order: 140, is_active: true },
];

export const FALLBACK_PLANS: PricingPlan[] = [
  { key: "starter", name_es: "Starter", name_en: "Starter", description_es: "Para proyectos pequeños, páginas web y herramientas sencillas.", description_en: "For small projects, websites and simple tools.", price_from: null, currency: "USD", features: ["single_module", "responsive", "basic_auth", "hosting_optional"], is_active: true, sort_order: 10, updated_at: "" },
  { key: "pro", name_es: "Pro", name_en: "Pro", description_es: "Para aplicaciones, sistemas empresariales y plataformas con varios módulos.", description_en: "For applications, business systems and multi-module platforms.", price_from: null, currency: "USD", features: ["multi_module", "roles", "database", "integrations", "qa", "maintenance_optional"], is_active: true, sort_order: 20, updated_at: "" },
  { key: "custom", name_es: "Custom", name_en: "Custom", description_es: "Para proyectos complejos, desarrollos avanzados e integraciones específicas.", description_en: "For complex projects, advanced development and specific integrations.", price_from: null, currency: "USD", features: ["dedicated_architecture", "advanced_integrations", "sla", "dedicated_support"], is_active: true, sort_order: 30, updated_at: "" },
];

export async function getCategories(): Promise<SolutionCategory[]> {
  if (!isSupabaseConfigured) return FALLBACK_CATEGORIES;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("solution_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (error || !data?.length) return FALLBACK_CATEGORIES;
    return data;
  } catch {
    return FALLBACK_CATEGORIES;
  }
}

export async function getPricingPlans(): Promise<PricingPlan[]> {
  if (!isSupabaseConfigured) return FALLBACK_PLANS;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("pricing_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (error || !data?.length) return FALLBACK_PLANS;
    return data;
  } catch {
    return FALLBACK_PLANS;
  }
}

export function localized<T extends { name_es: string; name_en: string; description_es?: string | null; description_en?: string | null }>(
  row: T,
  locale: string,
) {
  const isEn = locale === "en";
  return {
    name: isEn ? row.name_en : row.name_es,
    description: (isEn ? row.description_en : row.description_es) ?? "",
  };
}

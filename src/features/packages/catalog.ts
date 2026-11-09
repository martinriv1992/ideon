import type { ProjectKind } from "@/types/database.types";

/**
 * Ideon Business: soluciones empresariales con módulos base ya definidos que
 * el cliente personaliza (su sector, productos, campos, roles y marca).
 * Módulo puro: lo usan la página /business, el alta de proyectos y los agentes.
 *
 * El precio de referencia está aquí; el vigente sale de `pricing_plans`
 * (filas `pkg_<key>`), editable desde el panel de administración.
 */

export type PackageKey = "inventory" | "crm" | "suite";

export interface BusinessPackage {
  key: PackageKey;
  planKey: `pkg_${PackageKey}`;
  kind: ProjectKind;
  name: string;
  price: number;
  currency: "COP";
  demo: string;
  tagline: { es: string; en: string };
  modules: { es: string; en: string }[];
  /** Lo que los agentes deben incluir siempre (en español, para los prompts). */
  agentBrief: string;
}

export const PACKAGES: BusinessPackage[] = [
  {
    key: "inventory", planKey: "pkg_inventory", kind: "inventory", name: "Ideon Inventory", price: 1_490_000, currency: "COP", demo: "ideon-inventory",
    tagline: { es: "Controla tu inventario en tiempo real: existencias por bodega, entradas, salidas y alertas.", en: "Real-time inventory control: stock per warehouse, movements and alerts." },
    modules: [
      { es: "Productos con categorías, SKU, costo y precio", en: "Products with categories, SKU, cost and price" },
      { es: "Varias bodegas y traslados", en: "Multiple warehouses and transfers" },
      { es: "Entradas, salidas y ajustes con kardex", en: "Stock in, out and adjustments with a full ledger" },
      { es: "Alertas de stock mínimo", en: "Low-stock alerts" },
      { es: "Proveedores y órdenes de compra", en: "Suppliers and purchase orders" },
      { es: "Panel con valor del inventario y rotación", en: "Dashboard with stock value and turnover" },
    ],
    agentBrief: "Inventario multibodega: productos (SKU, categoría, costo, precio, stock mínimo), bodegas y traslados, movimientos de entrada/salida/ajuste que actualizan existencias, kardex por producto, alertas de stock mínimo, proveedores y órdenes de compra que al recibirse suman stock, panel con valor del inventario, productos críticos y más vendidos, exportación a CSV.",
  },
  {
    key: "crm", planKey: "pkg_crm", kind: "crm", name: "Ideon CRM", price: 1_490_000, currency: "COP", demo: "ideon-crm",
    tagline: { es: "Vende más con un embudo claro: clientes, oportunidades, cotizaciones y seguimiento del equipo.", en: "Sell more with a clear funnel: clients, deals, quotes and team follow-up." },
    modules: [
      { es: "Clientes y contactos con historial", en: "Clients and contacts with history" },
      { es: "Embudo de oportunidades (kanban)", en: "Deal pipeline (kanban)" },
      { es: "Cotizaciones con IVA listas para enviar", en: "Quotes with tax, ready to send" },
      { es: "Vendedores, metas y comisiones", en: "Sales reps, targets and commissions" },
      { es: "Tareas y recordatorios de seguimiento", en: "Follow-up tasks and reminders" },
      { es: "Campañas por correo y WhatsApp a segmentos", en: "Email and WhatsApp campaigns to segments" },
      { es: "Exportación de contactos a Excel y vCard", en: "Contact export to Excel and vCard" },
      { es: "Panel de ventas y conversión", en: "Sales and conversion dashboard" },
    ],
    agentBrief: "CRM de ventas: clientes y contactos con historial de actividades, embudo de oportunidades en kanban con etapas configurables (arrastrar para mover), cotizaciones con líneas, descuento e IVA que se pueden imprimir y convertir en venta, vendedores con metas mensuales y comisiones, tareas y recordatorios de seguimiento con vencimiento, campañas por correo y WhatsApp a segmentos de contactos (filtros por sector, ciudad, estado y etapa; mensaje con variables como {nombre} y {empresa}; envío o programación; registro en el historial; marcar respuestas y convertirlas en oportunidades vinculadas a la campaña), exportación de contactos a CSV y vCard, panel con ventas del mes, tasa de conversión, valor del embudo por etapa y ranking de vendedores.",
  },
  {
    key: "suite", planKey: "pkg_suite", kind: "erp", name: "Ideon Business Suite", price: 2_900_000, currency: "COP", demo: "ideon-suite",
    tagline: { es: "Toda tu operación en un solo sistema: ventas, inventario, clientes, compras y finanzas.", en: "Your whole operation in one system: sales, inventory, clients, purchasing and finance." },
    modules: [
      { es: "Todo Ideon Inventory + Ideon CRM", en: "Everything in Ideon Inventory + Ideon CRM" },
      { es: "Punto de venta y facturas que descuentan stock", en: "Point of sale and invoices that update stock" },
      { es: "Compras y proveedores", en: "Purchasing and suppliers" },
      { es: "Gastos, cuentas por cobrar y por pagar", en: "Expenses, receivables and payables" },
      { es: "Usuarios con roles y permisos", en: "Users with roles and permissions" },
      { es: "Panel ejecutivo con utilidad y flujo de caja", en: "Executive dashboard with profit and cash flow" },
    ],
    agentBrief: "Suite de gestión integrada: punto de venta y facturas que descuentan inventario, inventario multibodega con kardex y alertas, clientes con embudo de oportunidades y cotizaciones, compras a proveedores que suman stock, gastos por categoría, cuentas por cobrar y por pagar con vencimientos y abonos, usuarios con roles (administrador, ventas, bodega, contabilidad) que limitan las vistas, panel ejecutivo con ventas, utilidad bruta, flujo de caja y alertas.",
  },
];

export const PACKAGE_KEYS = PACKAGES.map((p) => p.key) as PackageKey[];

export function getPackage(key: string | null | undefined): BusinessPackage | null {
  return PACKAGES.find((p) => p.key === key) ?? null;
}

/** Precio vigente: el de `pricing_plans` si el administrador lo fijó; si no, el de referencia. */
export function packagePrice(pkg: BusinessPackage, plans: { key: string; price_from: number | string | null; currency: string; is_active?: boolean }[]) {
  const row = plans.find((p) => p.key === pkg.planKey && p.is_active !== false);
  if (row?.price_from != null && Number(row.price_from) > 0) return { price: Number(row.price_from), currency: row.currency.toUpperCase() };
  return { price: pkg.price, currency: pkg.currency };
}

/** Bloque para los prompts de los agentes cuando el proyecto parte de un paquete. */
export function packagePromptBlock(pkg: BusinessPackage) {
  return `PAQUETE EMPRESARIAL: ${pkg.name}. La solución parte de estos módulos base, que SIEMPRE deben estar y funcionar: ${pkg.agentBrief}
El objetivo es PERSONALIZARLOS para el negocio del cliente: su sector, sus productos o servicios reales, sus campos propios, sus roles, su terminología y su marca. Añade lo que el cliente pida además de la base.`;
}

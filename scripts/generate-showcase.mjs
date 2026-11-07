// Genera las demos de la página de ejemplos con el mismo motor de Ideon
// (arquitecto + desarrollador + QA) y datos ficticios.
//
// Uso:
//   npx tsc -p tsconfig.tests.json            # compila los módulos puros a dist-tests/
//   ANTHROPIC_API_KEY=... node scripts/generate-showcase.mjs [slug ...]
//
// Escribe src/content/showcase/<slug>.html y src/content/showcase/index.json.
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs/promises";
import path from "node:path";
import { architectSystem, architectUser, cleanHtml, developerSystem, developerUser, extractJson, isCompleteHtml } from "../dist-tests/features/agents/prompts.js";
import { jsSyntaxErrors, runQa, qaSummary } from "../dist-tests/features/agents/qa.js";

const MODEL = process.env.SHOWCASE_MODEL || "claude-sonnet-5-5";
const PRICE = { in: 2, out: 10 }; // USD por millón de tokens (Sonnet 5.5)
const OUT = path.resolve("src/content/showcase");

const DEMOS = [
  {
    slug: "restaurante", kind: "web",
    title: { es: "Web de restaurante", en: "Restaurant website" },
    summary: { es: "Landing con carta, reservas por WhatsApp, horarios y galería.", en: "Landing page with menu, WhatsApp bookings, opening hours and gallery." },
    idea: "Web para La Huerta, restaurante de cocina mediterránea con terraza en Medellín.",
    brief: { name: "La Huerta", goal: "Conseguir reservas y mostrar la carta", audience: "Parejas y familias del barrio, turistas", sections: ["inicio", "carta", "terraza", "testimonios", "horarios", "reservas", "contacto"], style: "Cálido y natural: verdes oliva, crema y terracota, tipografía serif elegante", contact: "Datos de ejemplo: WhatsApp +57 300 000 0000, Calle 10 #40-20, Medellín", cta: "Reservar mesa", language: "es", notes: "Datos ficticios de demostración; precios en COP." },
  },
  {
    slug: "crm-inmobiliaria", kind: "crm",
    title: { es: "CRM inmobiliario", en: "Real-estate CRM" },
    summary: { es: "Clientes, propiedades, visitas y embudo de ventas con indicadores.", en: "Clients, properties, viewings and a sales pipeline with KPIs." },
    idea: "CRM para una agencia inmobiliaria pequeña: clientes interesados, propiedades, visitas agendadas y negocios por etapa.",
    brief: { name: "Habitar CRM", goal: "Seguir clientes y cerrar más ventas y arriendos", roles: ["asesor", "gerente"], entities: ["clientes", "propiedades", "visitas", "negocios"], features: ["embudo por etapas", "agenda de visitas", "búsqueda y filtros", "indicadores de cierre"], style: "Profesional y limpio, azul petróleo", sampleData: true, language: "es" },
  },
  {
    slug: "inventario-ferreteria", kind: "inventory",
    title: { es: "Inventario de ferretería", en: "Hardware-store inventory" },
    summary: { es: "Productos, entradas y salidas, alertas de stock mínimo y proveedores.", en: "Products, stock in/out, low-stock alerts and suppliers." },
    idea: "Inventario para una ferretería de barrio: productos por categoría, movimientos de entrada y salida, proveedores y alertas de stock bajo.",
    brief: { name: "Ferretería El Tornillo · Inventario", goal: "Saber qué hay, qué falta y qué pedir", roles: ["administrador", "vendedor"], entities: ["productos", "movimientos", "proveedores", "categorías"], features: ["alertas de stock mínimo", "entradas y salidas que actualizan existencias", "valor del inventario", "búsqueda por código"], style: "Funcional, gris grafito con acento naranja", sampleData: true, language: "es" },
  },
  {
    slug: "inventario-produccion", kind: "inventory",
    title: { es: "Inventario con producción", en: "Inventory with production" },
    summary: { es: "Insumos, recetas, lotes de producción, pedidos, qué comprar y conteo físico.", en: "Supplies, recipes, production batches, orders, what to buy and stock counts." },
    idea: "Inventario para una jabonería artesanal que fabrica sus productos: insumos, recetas, producción por lotes, producto terminado, pedidos de clientes y compras.",
    brief: { name: "Espuma de Monte · Inventario", goal: "Saber qué insumos hay, qué producir y qué comprar sin quedarse sin stock", roles: ["administración", "producción"],
      entities: ["insumos", "movimientos", "recetas", "lotes de producción", "producto terminado", "pedidos", "proveedores", "conteos físicos"],
      features: ["insumos con código, categoría, unidad, proveedor, stock mínimo y costo unitario", "entradas y salidas con motivo que actualizan el stock", "recetas: insumos por unidad de cada producto", "registrar un lote de producción descuenta los insumos de la receta y suma producto terminado", "pedidos de clientes con estados pendiente, producido, entregado y cancelado", "lista de qué comprar según stock mínimo y consumo reciente, con texto listo para enviar por WhatsApp al proveedor", "conteo físico con diferencias frente al sistema", "panel con alertas de stock bajo, lo que más sale en 30 días y actividad reciente"],
      style: "Natural y ordenado: verde salvia, crema y madera", sampleData: true, language: "es", notes: "Datos ficticios; precios en COP." },
  },
  {
    slug: "crm-ventas", kind: "crm",
    title: { es: "CRM de ventas con cotizaciones", en: "Sales CRM with quotes" },
    summary: { es: "Embudo por etapas, seguimientos, historial y cotizaciones con descuentos e impuestos.", en: "Stage pipeline, follow-ups, history and quotes with discounts and taxes." },
    idea: "CRM comercial para una distribuidora mayorista: embudo de ventas, contactos, seguimientos y cotizaciones a clientes.",
    brief: { name: "Nativa Distribuciones · CRM", goal: "Ordenar la prospección, no olvidar seguimientos y cotizar rápido", roles: ["asesor comercial", "gerente comercial"],
      entities: ["contactos", "oportunidades", "seguimientos", "interacciones", "cotizaciones", "productos", "cadencias"],
      features: ["embudo comercial por etapas (nuevo, contactado, interesado, cotizado, negociación, ganado, perdido) con valor estimado y cambio de etapa", "contactos con tipo de negocio, fuente, ciudad, responsable y lista de precios habitual", "seguimientos con fecha y tarea, con vencidos y de hoy destacados", "historial de interacciones por contacto (llamada, WhatsApp, correo, visita)", "cotizaciones: cliente, productos del catálogo con cantidades, lista de precios, descuento sobre precio público, descuento por volumen, descuento adicional, envío, impuestos, validez en días, condiciones y notas, con numeración consecutiva COT-0001", "estados de cotización (borrador, enviada, aceptada, rechazada, vencida) y vista lista para imprimir y texto para WhatsApp", "cadencias de seguimiento con pasos por día y canal", "indicadores: valor del embudo, tasa de cierre, cotizaciones abiertas y seguimientos vencidos", "ajustes: equipo comercial, prefijo y próximo número de cotización, validez por defecto"],
      style: "Profesional y cálido: verde oliva, arena y blanco roto", sampleData: true, language: "es", notes: "Datos ficticios; precios en COP." },
  },
  {
    slug: "ideon-inventory", kind: "inventory",
    title: { es: "Ideon Inventory", en: "Ideon Inventory" },
    summary: { es: "Productos, bodegas, entradas y salidas, kardex, alertas, compras a proveedores y reportes.", en: "Products, warehouses, stock in/out, kardex, alerts, purchase orders and reports." },
    idea: "Ideon Inventory: sistema de inventario completo para una pyme comercial con varias bodegas.",
    brief: { name: "Ideon Inventory · Distribuidora Andina (demo)", goal: "Controlar existencias en varias bodegas, no quedarse sin stock y saber cuánto vale el inventario", roles: ["administrador", "bodeguero", "compras"],
      entities: ["productos", "categorías", "bodegas", "movimientos", "proveedores", "órdenes de compra", "ajustes de inventario", "usuarios"],
      features: ["catálogo de productos con SKU, código de barras, categoría, unidad, costo, precio de venta, stock mínimo y máximo por bodega", "existencias por bodega y total, con valorización al costo", "entradas, salidas y traslados entre bodegas con motivo, responsable y documento", "kardex por producto (historial de movimientos con saldo)", "alertas de stock bajo y de sobre-stock, y productos sin movimiento en 60 días", "órdenes de compra a proveedores: borrador, enviada, recibida parcial o total; al recibir suma existencias", "ajustes por conteo físico con diferencias", "panel con KPIs (valor del inventario, productos bajo mínimo, rotación, entradas y salidas del mes) y gráficos", "reportes filtrables por fecha, bodega y categoría con exportación CSV", "selector de usuario/rol de demostración que cambia lo que se puede hacer"],
      style: "Corporativo moderno: azul índigo, blanco y grises, tipografía sans clara", sampleData: true, language: "es", notes: "Datos ficticios; precios en COP. Debe sentirse como un producto SaaS terminado." },
  },
  {
    slug: "ideon-crm", kind: "crm",
    title: { es: "Ideon CRM", en: "Ideon CRM" },
    summary: { es: "Clientes, oportunidades, embudo por vendedor, tareas, cotizaciones, metas y reportes.", en: "Clients, opportunities, per-rep pipeline, tasks, quotes, targets and reports." },
    idea: "Ideon CRM: CRM comercial completo para una empresa B2B con equipo de vendedores.",
    brief: { name: "Ideon CRM · Soluciones Atlas (demo)", goal: "Que cada vendedor gestione su embudo, nadie olvide un seguimiento y la gerencia vea metas y resultados", roles: ["vendedor", "gerente comercial"],
      entities: ["clientes", "contactos", "oportunidades", "vendedores", "tareas", "actividades", "cotizaciones", "productos", "metas"],
      features: ["clientes (empresas) con varios contactos, sector, ciudad, vendedor asignado y estado", "oportunidades en tablero kanban por etapa (prospecto, contactado, propuesta, negociación, ganada, perdida) con valor, probabilidad y fecha estimada de cierre; mover tarjetas cambia la etapa", "tareas y actividades (llamada, reunión, correo, WhatsApp) con fecha, vencidas y de hoy destacadas", "cotizaciones con productos, descuentos, IVA, numeración consecutiva, estados y vista imprimible", "metas mensuales por vendedor con avance", "panel gerencial: embudo por etapa, ventas ganadas del mes, tasa de cierre, ranking de vendedores y pronóstico ponderado", "filtro por vendedor en todas las vistas y selector de usuario de demostración (vendedor o gerente)", "historial de actividad por cliente", "reportes con exportación CSV"],
      style: "Profesional y enérgico: azul petróleo con acento coral, mucho aire", sampleData: true, language: "es", notes: "Datos ficticios; precios en COP. Debe sentirse como un producto SaaS terminado." },
  },
  {
    slug: "ideon-suite", kind: "erp",
    title: { es: "Ideon Business Suite", en: "Ideon Business Suite" },
    summary: { es: "Ventas, facturas, inventario, clientes, compras, gastos y finanzas en un solo sistema.", en: "Sales, invoices, inventory, clients, purchases, expenses and finances in one system." },
    idea: "Ideon Business Suite: sistema de gestión integrado para una pyme (ventas, inventario, clientes, compras y finanzas).",
    brief: { name: "Ideon Business Suite · Comercializadora Norte (demo)", goal: "Gestionar todo el negocio en un solo lugar: vender, facturar, controlar inventario, comprar y ver la rentabilidad", roles: ["gerente", "vendedor", "administración"],
      entities: ["clientes", "productos", "inventario", "ventas", "facturas", "cotizaciones", "proveedores", "compras", "gastos", "cuentas por cobrar", "cuentas por pagar"],
      features: ["punto de venta simple: buscar producto, agregar al carrito, cliente, descuento y forma de pago; al vender descuenta inventario y genera factura", "facturas y cotizaciones con numeración, IVA, estados (pagada, pendiente, vencida) y vista imprimible", "cuentas por cobrar por cliente con abonos", "inventario con stock mínimo y alertas, entradas por compra", "compras a proveedores que suman inventario y generan cuentas por pagar", "gastos por categoría", "panel ejecutivo: ventas del día y del mes, utilidad bruta, cartera vencida, productos más vendidos, gráfico de ventas vs gastos", "reportes por período con exportación CSV", "selector de usuario de demostración por rol"],
      style: "Ejecutivo y limpio: verde esmeralda, blanco y gris carbón", sampleData: true, language: "es", notes: "Datos ficticios; precios en COP. Debe sentirse como un producto SaaS terminado. Prioriza que cada módulo funcione de verdad sobre la cantidad de pantallas." },
  },
  {
    slug: "gestion-taller", kind: "erp",
    title: { es: "Gestión de taller mecánico", en: "Auto-repair shop management" },
    summary: { es: "Órdenes de trabajo, vehículos, repuestos y cobros en un solo lugar.", en: "Work orders, vehicles, parts and payments in one place." },
    idea: "Sistema de gestión para un taller mecánico: clientes y vehículos, órdenes de trabajo con estados, repuestos usados y cobros.",
    brief: { name: "MotorPro Taller", goal: "Organizar órdenes y facturar sin papel", roles: ["recepción", "mecánico", "dueño"], entities: ["clientes", "vehículos", "órdenes de trabajo", "repuestos", "pagos"], features: ["estados de la orden (recibido, en reparación, listo, entregado)", "total de la orden con repuestos y mano de obra", "pagos pendientes", "historial por vehículo"], style: "Robusto, negro y amarillo", sampleData: true, language: "es" },
  },
  {
    slug: "dashboard-ventas", kind: "dashboard",
    title: { es: "Dashboard de ventas", en: "Sales dashboard" },
    summary: { es: "Ventas por día, canal y producto con gráficos y metas mensuales.", en: "Sales by day, channel and product with charts and monthly goals." },
    idea: "Dashboard de ventas para una tienda online de café: ventas diarias, por canal, productos más vendidos y cumplimiento de metas.",
    brief: { name: "Café Altura · Ventas", goal: "Ver el negocio de un vistazo y decidir rápido", roles: ["dueño"], entities: ["ventas", "productos", "canales", "metas"], features: ["gráfico de ventas por día", "ventas por canal", "top de productos", "meta mensual con progreso", "filtro por fechas"], style: "Elegante, marrón café y crema", sampleData: true, language: "es" },
  },
  {
    slug: "portal-clientes", kind: "portal",
    title: { es: "Portal de clientes", en: "Client portal" },
    summary: { es: "Documentos, solicitudes y estado de trámites para clientes de un estudio contable.", en: "Documents, requests and case status for an accounting firm's clients." },
    idea: "Portal de clientes para un estudio contable: cada cliente ve sus trámites, documentos pendientes, vencimientos tributarios y puede enviar solicitudes.",
    brief: { name: "Contaplus · Portal", goal: "Que el cliente se autogestione y llame menos", roles: ["cliente", "contador"], entities: ["clientes", "trámites", "documentos", "solicitudes", "vencimientos"], features: ["estado de cada trámite", "lista de documentos pendientes", "calendario de vencimientos", "envío de solicitudes con seguimiento"], style: "Confiable y sobrio, azul marino y blanco", sampleData: true, language: "es" },
  },
  {
    slug: "app-gimnasio", kind: "app",
    title: { es: "App de gimnasio", en: "Gym admin app" },
    summary: { es: "Socios, planes, pagos y asistencia a clases con recordatorios de vencimiento.", en: "Members, plans, payments and class attendance with expiry reminders." },
    idea: "App administrativa para un gimnasio: socios, planes de membresía, pagos, clases y asistencia.",
    brief: { name: "Pulso Gym", goal: "Controlar membresías, cobros y asistencia", roles: ["recepción", "administrador"], entities: ["socios", "planes", "pagos", "clases", "asistencias"], features: ["membresías por vencer", "registro rápido de asistencia", "ingresos del mes", "cupos por clase"], style: "Energético, negro con verde lima", sampleData: true, language: "es" },
  },
];

const client = new Anthropic();

async function call(task, system, user, maxTokens) {
  const res = await client.messages.stream({
    model: MODEL, max_tokens: maxTokens, output_config: { effort: "medium" },
    system, messages: [{ role: "user", content: user }],
  }).finalMessage();
  if (res.stop_reason === "refusal") throw new Error(`${task}: rechazo del modelo`);
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return { text, usage: res.usage, truncated: res.stop_reason === "max_tokens" };
}

const cost = (u) => (u.input_tokens * PRICE.in + u.output_tokens * PRICE.out) / 1e6;

async function generate(demo) {
  const arch = await call("architect", architectSystem(demo.kind), architectUser({ brief: demo.brief, idea: demo.idea, images: [] }), 8192);
  const spec = extractJson(arch.text);
  if (!spec?.pages) throw new Error(`${demo.slug}: especificación no válida`);
  const devUser = developerUser({ spec, images: [] }) + "\n\nNOTA: es una DEMO pública de Ideon; todos los datos (nombres, teléfonos, direcciones, cifras) deben ser claramente ficticios.";
  const MAX = Number(process.env.SHOWCASE_MAX_TOKENS) || 32000;
  let dev = await call("developer", developerSystem(demo.kind), devUser, MAX);
  let html = cleanHtml(dev.text);
  const calls = [arch.usage, dev.usage];
  // Igual que la plataforma: si el JavaScript sale con errores de sintaxis, un reintento.
  const jsErr = isCompleteHtml(html) && !dev.truncated ? jsSyntaxErrors(html) : [];
  if (jsErr.length) {
    console.log(`${demo.slug}: error de sintaxis (${jsErr[0]}), reintentando`);
    dev = await call("developer", developerSystem(demo.kind), devUser + `\n\nIMPORTANTE: un intento anterior produjo JavaScript con un error de sintaxis (${jsErr[0]}). Genera de nuevo el HTML completo y revisa que todo el JavaScript sea válido (paréntesis, llaves y comillas equilibrados).`, MAX);
    html = cleanHtml(dev.text); calls.push(dev.usage);
  }
  if (!isCompleteHtml(html) || dev.truncated) {
    // El intento fallido también se paga: se registra su coste.
    const lost = calls.reduce((n, u) => n + cost(u), 0);
    throw new Error(`${demo.slug}: HTML incompleto (${calls.map((u) => `${u.input_tokens}→${u.output_tokens}`).join(", ")} tokens · $${lost.toFixed(3)} gastados)`);
  }
  const qa = qaSummary(runQa(html, { app: demo.kind !== "web", imageIds: [] }));
  await fs.writeFile(path.join(OUT, `${demo.slug}.html`), html);
  const usd = calls.reduce((n, u) => n + cost(u), 0);
  console.log(`${demo.slug}: ${Math.round(html.length / 1024)} KB · QA ${qa.ok}/${qa.total} (${qa.bad} graves) · ${calls.length} llamadas · ${calls.map((u) => `${u.input_tokens}→${u.output_tokens}`).join(", ")} tokens · $${usd.toFixed(3)}`);
  return { slug: demo.slug, kind: demo.kind, title: demo.title, summary: demo.summary, idea: demo.idea, name: spec.name ?? demo.brief.name, model: MODEL, qa, calls: calls.length, costUsd: Number(usd.toFixed(4)), generatedAt: new Date().toISOString() };
}

await fs.mkdir(OUT, { recursive: true });
const only = process.argv.slice(2);
const indexPath = path.join(OUT, "index.json");
const prev = JSON.parse(await fs.readFile(indexPath, "utf8").catch(() => "[]"));
const results = await Promise.allSettled(DEMOS.filter((d) => !only.length || only.includes(d.slug)).map(generate));
const done = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
for (const r of results) if (r.status === "rejected") console.error("ERROR", r.reason?.message ?? r.reason);
const merged = DEMOS.map((d) => done.find((x) => x.slug === d.slug) ?? prev.find((x) => x.slug === d.slug)).filter(Boolean);
await fs.writeFile(indexPath, JSON.stringify(merged, null, 2) + "\n");
console.log(`Total: $${done.reduce((n, d) => n + d.costUsd, 0).toFixed(3)} · ${done.length}/${results.length} demos`);

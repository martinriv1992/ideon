# Ideonapp · Commercial Launch 1.0

Extensión comercial de la plataforma existente. **No es una reconstrucción**:
todo lo anterior (app, agentes, pagos, dominios, backoffice) sigue igual.

## 1. Auditoría de arquitectura (fase 0)

| Área | Hallazgo |
|---|---|
| Frontend | Next.js 15 (App Router, Server Components y Server Actions), React 19, Tailwind 4, next-intl (es/en, prefijo de idioma obligatorio). |
| Backend | Route handlers de Next (`src/app/api/*`) y Server Actions. Sin backend aparte. |
| Base de datos | Supabase Postgres con RLS. Migraciones en `supabase/migrations` (0001–0008). |
| Autenticación | Supabase Auth (correo y contraseña, enlaces de correo con token_hash). Middleware con prefijos protegidos. Administradores mediante `profiles.is_platform_admin`. |
| Rutas | Grupos `(marketing)`, `(auth)`, `(app)` y `(admin)` bajo `[locale]`. Además `/demo/[slug]` (HTML estático), `/s/[slug]` (sitios publicados) y `/api/*`. |
| Agentes de IA | `src/features/agents`: consultor → arquitecto → propuesta → desarrollador (HTML único) → QA estático → publicación. Anthropic (Haiku 5.5 en la vista previa gratuita, Sonnet 5.5 tras el pago). |
| Integraciones | ePayco (pagos en vivo), registrador y proyectos de Vercel (dominios y despliegue), Resend (SMTP de Supabase), WhatsApp (enlace). |
| Despliegue | Vercel: el proyecto `ideon` se despliega desde `main`; producción en ideonapp.com. |
| Variables de entorno | Supabase, Anthropic, ePayco (`EPAYCO_TEST=false` en producción), Vercel, `NEXT_PUBLIC_APP_URL=https://ideonapp.com`. |
| Diseño | Tokens en `globals.css` (tema oscuro), `components/ui` (Button, Card, Badge, Input, Container, SectionHeading), `marketing/Reveal`, Logo. |

**Reutilizado:** layout y header del grupo `(marketing)`, FAQ, componente del prompt inicial y del buscador de dominios (`HeroStart`), componentes UI, `money()`, `whatsappLink()`, `rateLimit()` y hash de IP (antiabuso), guard y tablas del backoffice, generador de demos (`scripts/generate-showcase.mjs`) y ruta `/demo/[slug]`.

**Riesgos evaluados:**
- Rutas nuevas sin colisión con las existentes.
- La migración es aditiva (solo crea la tabla `leads`).
- Sin cambios en auth, pagos ni agentes.
- La portada cambia de contenido, pero conserva el punto de entrada del producto (prompt inicial y buscador de dominios en el hero) y el acceso a login y panel en el header.

## 2. Mapa de rutas comerciales

Todas existen en `/es/...` y `/en/...`. Una ruta sin prefijo (p. ej. `/inventory`) redirige según el idioma del navegador o la cookie `NEXT_LOCALE`.

| Ruta | Contenido |
|---|---|
| `/` | Landing: hero, soluciones, producto destacado, cómo trabajamos, por qué Ideonapp, portafolio, cómo empezar y precios, FAQ y CTA final. |
| `/inventory` | Ideon Inventory con la demo interactiva NOVA Distribution incrustada (ES/EN). |
| `/crm` | Ideon CRM. La demo está solo en español y la página en inglés lo indica. |
| `/custom-software` | Software a medida, IA, plataformas web y automatización; metodología y precios. |
| `/portfolio` | Las tres demostraciones de producto, etiquetadas como tales. |
| `/contact` | Formulario de leads y consulta de 20 minutos (WhatsApp como alternativa). |
| Existentes | `/business`, `/examples`, `/login`, `/dashboard`, `/projects/*`, `/admin/*`… sin cambios. |
| Nueva en el backoffice | `/admin/leads` (embudo comercial del fundador) y `/api/admin/leads/export` (CSV). |

## 3. Archivos

**Nuevos:**
- `src/components/site/*`: secciones, tabla de precios, formulario de leads, demo incrustada, analítica y zona horaria.
- `src/app/[locale]/(marketing)/{inventory,crm,custom-software,portfolio,contact}/page.tsx`
- `src/app/[locale]/opengraph-image.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`
- `src/app/api/leads/route.ts`, `src/app/api/admin/leads/export/route.ts`
- `src/app/[locale]/(admin)/admin/leads/page.tsx`, `src/components/admin/lead-form.tsx`
- `src/features/leads/{schema,notify}.ts`, `src/content/commercial/pricing.ts`
- `src/lib/{analytics,seo}.ts`
- `src/content/showcase/nova-distribution{,-en}.html` y `public/showcase/nova-distribution{,-en}.jpg`
- `supabase/migrations/0009_leads.sql`, `tests/commercial.test.mjs` y este documento.

**Modificados:**
- `src/app/[locale]/(marketing)/page.tsx` (nueva composición) y `layout.tsx` (analítica).
- Header (navegación comercial y CTA de consulta) y footer.
- `LocaleSwitcher` (evento de idioma).
- Logo (wordmark «ideonapp»).
- `messages/{es,en}.json` (claves `site.*` y `admin.leads`).
- Layout del backoffice (enlace a Leads) y `src/features/admin/actions.ts` (`updateLeadAction`).
- `src/features/auth/abuse.ts` (exporta el hash de IP).
- `src/types/database.types.ts` (tipo `Lead`).
- Ruta `/demo/[slug]` (sello en el idioma de la demo).
- Página de ejemplos (oculta las versiones `-en`).
- `scripts/generate-showcase.mjs` (briefs de NOVA).
- Plantilla del título (`· Ideonapp`).

## 4. Estado por requisito

| Requisito | Estado |
|---|---|
| Landing bilingüe con todas las secciones | COMPLETED AND TESTED (local, navegador, es/en, móvil) |
| Rutas comerciales y navegación entre sitio y app | COMPLETED AND TESTED |
| Idioma: detección, cambio, persistencia, sin mezcla | COMPLETED AND TESTED. Excepción: las demos CRM y Business Suite solo existen en español; la versión en inglés lo indica. |
| Demo NOVA Distribution (ES y EN) | COMPLETED AND TESTED. 14 y 12 comprobaciones de flujo: crear y editar producto, entradas, salidas rechazadas por stock, alertas con sugerencia de reposición, pedido bloqueado por stock, total con IVA, despacho que descuenta stock, reportes y panel coherentes, móvil sin desbordamiento. |
| Aislamiento de la demo | COMPLETED AND TESTED: HTML estático en iframe `sandbox` sin `allow-same-origin`; datos ficticios solo en el navegador; sin acceso a la base de datos. |
| Estado de las demos CRM y Business Management | COMPLETED (probadas en la versión anterior: todas las vistas, altas y una venta en el punto de venta). Solo en español. |
| Formulario de leads: validación en cliente y servidor, antispam, origen y UTM | COMPLETED AND TESTED en producción: lead real guardado con consentimiento, UTM, página de entrada y hash de IP; el spam se descarta; el CSV sin sesión devuelve 403. |
| Aviso al fundador por correo | COMPLETED AND TESTED: Resend aceptó el envío (`notified_at` registrado) a los administradores de la plataforma. Falta confirmar que llega a la bandeja de entrada. |
| Gestión comercial del fundador (embudo NEW→WON/LOST, valor, último contacto, próximo seguimiento, notas, vencidos, origen, CSV) | IMPLEMENTED BUT NOT VERIFIED en el navegador: requiere iniciar sesión como administrador (cuenta del fundador). Compila y está protegido (sin sesión → login; CSV → 403). |
| Agenda de consulta de 20 min | BLOCKED (sin proveedor). Punto de integración: `NEXT_PUBLIC_BOOKING_URL` (Cal.com o Calendly). Mientras tanto, la casilla «Quiero agendar» y WhatsApp. No se simulan reservas. `meeting_booked` no se emite sin proveedor. |
| Eventos de analítica | COMPLETED AND TESTED en `dataLayer`: page_view, language_selected, solution_viewed, inventory_demo_opened, demo_interaction, lead_form_started, lead_form_submitted, meeting_cta_clicked y proposal_requested. Sin datos personales. |
| GA4 y Search Console | BLOCKED (credenciales). Con `NEXT_PUBLIC_GA_ID`, GA4 se carga solo tras aceptar cookies (aparece el aviso). Search Console: verificar ideonapp.com y enviar `/sitemap.xml`. |
| Informe de conversión | COMPLETED: `/admin/leads` (por etapa, por origen y campaña, tasa de cierre) y exportación CSV. |
| SEO: títulos y descripciones por ruta, canónicas, hreflang y x-default, sitemap con alternativas, robots, Open Graph con imagen por idioma, JSON-LD (Organization, WebSite, Service) | COMPLETED AND TESTED (local) |
| Precios indicativos editables (COP para Colombia, USD para el resto, según la IP) | COMPLETED AND TESTED. Se editan en `src/content/commercial/pricing.ts`. |
| Seguridad | COMPLETED: validación con zod en el servidor, límite de 5 leads por hora por IP, campo trampa y tiempo mínimo, RLS sin políticas en `leads`, CSV protegido contra fórmulas, escapado HTML en el correo, sin secretos en el cliente. |
| Producto existente | COMPLETED AND TESTED (regresión): login, redirección con `?package=`, buscador de dominios del hero, dominio preseleccionado al activar, `/business`, ejemplos, 34/34 pruebas unitarias. Los agentes no cambiaron; no se ejecutaron de nuevo para no gastar créditos. |

## 5. Configuración pendiente (credenciales)

1. ~~Migración 0009~~: aplicada el 07/11/2026.
2. ~~`RESEND_API_KEY`~~: configurada en producción. Opcionales: `LEADS_NOTIFY_EMAIL` (por defecto, los administradores) y `LEADS_FROM_EMAIL` (por defecto `no-reply@ideonapp.com`).
3. **`NEXT_PUBLIC_BOOKING_URL`**: enlace de Cal.com o Calendly de 20 minutos.
4. **`NEXT_PUBLIC_GA_ID`**: ID de GA4 (G-XXXX). Además, verificar el dominio en Search Console y enviar el sitemap.
5. Redes sociales: no hay cuentas configuradas, así que el footer no muestra enlaces.

## 6. Despliegue

PR a `main` → Vercel despliega producción automáticamente. Orden: **migración 0009 → variables → merge**.

## 7. Rollback

- **Código:** en Vercel → Deployments, «Instant Rollback» al despliegue anterior al lanzamiento (`dpl_AbKR7ErDTTSj2v7pxAnLSjtb27ZP`, commit `125efe7`). El lanzamiento se desplegó como `dpl_74SL2KbECeChcNCXbWNjwkeX7hHX` (commit `de68add`). También se puede hacer `git revert` del merge.
- **Base de datos:** `drop table public.leads;` (solo si se quiere eliminar; la tabla no afecta a nada más).
- **Variables:** quitar las añadidas (`RESEND_API_KEY`, `NEXT_PUBLIC_*`); no se modificó ninguna existente.

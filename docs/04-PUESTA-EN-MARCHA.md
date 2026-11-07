# Ideon — Puesta en marcha

## 1. Requisitos
- Node.js 20+ y npm.
- Cuenta en [Supabase](https://supabase.com) (plan gratuito suficiente para empezar).
- Clave de API de [Anthropic](https://console.anthropic.com) para los agentes (Fase 2+).
- Cuenta en [Vercel](https://vercel.com) para desplegar la plataforma (recomendado; las ejecuciones de agentes usan `maxDuration = 300`, disponible con Fluid Compute).
- Opcionales: cuenta de Stripe (pagos), token de Vercel (desplegar sitios de clientes en Vercel además del hosting propio).

## 2. Crear el proyecto Supabase
1. Crea un proyecto nuevo (región recomendada: `us-east-1` para Colombia/LATAM).
2. En **SQL Editor** ejecuta, en este orden:
   - `supabase/migrations/0001_foundation.sql`
   - `supabase/seed.sql`
   - `supabase/migrations/0002_intelligence_build_deploy_billing.sql` (crea también el bucket privado `project-images` y sus políticas).
   - `supabase/migrations/0003_project_assets.sql` (archivos del proyecto: documentos que lee la IA y archivos que se publican; bucket privado `project-files` de 10 MB por archivo).
   - `supabase/migrations/0004_models_sonnet_5_5.sql` (los agentes pasan a `claude-sonnet-5-5`).
   - `supabase/migrations/0005_launch_domains_epayco.sql` (vista previa gratuita, pagos con ePayco, pedidos de dominio y paquete anual).
   - `supabase/migrations/0006_preview_costs_abuse_changes.sql` (modelos mixtos Haiku/Sonnet, freno diario de gasto, antiabuso del registro y paquetes de cambios).
3. **Authentication → Providers → Email**: activa *Email*; decide si exiges confirmación de correo.
4. **Authentication → URL Configuration**: *Site URL* = `http://localhost:3000` (y la de producción); *Redirect URLs* = `http://localhost:3000/api/auth/callback` y `https://<tu-dominio>/api/auth/callback`.
5. Para convertirte en administrador de la plataforma, tras registrarte ejecuta en SQL Editor:
   `update public.profiles set is_platform_admin = true where id = '<tu-user-id>';`
   (el id está en Authentication → Users). El backoffice aparece en `/admin`.

## 3. Variables de entorno
```bash
cp .env.example .env.local
```
Mínimo: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` y `ANTHROPIC_API_KEY`.
- Sin `ANTHROPIC_API_KEY` la plataforma funciona, pero el workspace muestra «proveedor de IA no configurado» y los agentes no responden (no se simula nada).
- `AI_PROVIDER=mock` activa un proveedor determinista **solo para desarrollo y pruebas** (genera un sitio de ejemplo sin llamar a ningún modelo).
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` activan el botón «Pagar con tarjeta» en las propuestas con precio. Webhook: `POST /api/billing/webhook` (evento `checkout.session.completed`).
- `VERCEL_TOKEN` (+ `VERCEL_TEAM_ID`, `VERCEL_SITES_PROJECT`) activan «Desplegar en Vercel» y la gestión de dominios vía API de Vercel. El hosting propio (`/s/<slug>`) no lo necesita.
- `NEXT_PUBLIC_SITE_BASE_URL`: si quieres servir los sitios publicados desde otro dominio (p. ej. `https://sites.ideon.app` apuntando a la misma app), indícalo aquí; también es el destino CNAME para dominios propios de clientes.

## 4. Ejecutar
```bash
npm install
npm run dev      # http://localhost:3000
npm test         # pruebas de los módulos de agentes (prompts, QA, propuestas)
npm run build
```

## 5. Flujo completo (lo que verá un cliente)
1. Homepage → elige tipo de solución, escribe la idea → registro → el proyecto se crea y el **consultor** empieza el cuestionario (una pregunta con opciones por turno).
2. Al cerrar el alcance, el **arquitecto** genera la especificación y se emite la **propuesta** (plan, entregables, días, precio o «según alcance»). El cliente la aprueba en la pestaña Propuesta (configurable en `platform_settings.require_proposal_approval`).
3. El **desarrollador** genera la primera versión; **QA** la comprueba; aparece en la vista previa. Cada petición por chat genera una nueva versión (con restauración de versiones anteriores).
4. Fotos: pestaña Imágenes (se guardan en Storage; los agentes las usan por nombre).
5. **Publicar**: en Ideon (`/s/<slug>`, inmediato), dominio propio (CNAME + verificación DNS desde la app) y, si está configurado, Vercel. Descarga ZIP siempre disponible.
6. Presupuestos, facturación, suscripciones (hosting), archivos y soporte en el área de cliente; backoffice en `/admin` para administradores.

## 6. Despliegue en Vercel
1. Importa el repositorio y añade las variables de entorno.
2. En producción, `NEXT_PUBLIC_APP_URL` debe ser el dominio final. Para dominios propios de clientes, añade también el dominio comodín o cada dominio al proyecto de Vercel (o usa `VERCEL_SITES_PROJECT` con un proyecto dedicado a sitios).
3. Las rutas de agentes declaran `maxDuration = 300`; en el plan Hobby el límite puede ser menor: en ese caso las construcciones largas fallarán con timeout y deberá usarse el plan Pro o un worker externo (previsto en `docs/01-ARQUITECTURA.md`).

## 7. Tipos de base de datos
Tras cualquier cambio de esquema: `npx supabase gen types typescript --project-id <id> > src/types/database.types.ts`.

## 8. Vista previa gratuita, pagos y dominios

**Modelo comercial.** El cliente obtiene gratis la primera versión y `free_preview_changes` cambios por chat (2 por defecto). Para publicar, descargar el ZIP, conectar un dominio o seguir pidiendo cambios, **activa el proyecto** desde la pestaña Publicar con un único pago: desarrollo (precio de la propuesta) + primer año de hosting + primer año de dominio (opcional). Después renueva cada año hosting + dominio desde Suscripciones; si no renueva, tras `renewal_grace_days` el sitio muestra «suspendido».

**Precios** (en `/admin/settings`): `billing_currency` (COP), `usd_to_billing_rate`, `hosting_price_year`, `domain_markup_pct`, `domain_tlds`, `free_preview_changes`, `renewal_grace_days`. El precio del desarrollo sale del plan de la propuesta: **define `price_from` en `/admin/pricing`**, o la activación queda en «precio pendiente». El dominio se cotiza con el mayor entre su precio de compra y de renovación en Vercel, más el margen, para que la renovación nunca dé pérdida.

**ePayco.** Variables `EPAYCO_PUBLIC_KEY`, `EPAYCO_P_CUST_ID_CLIENTE`, `EPAYCO_P_KEY` y `EPAYCO_TEST=true` mientras pruebas. La confirmación (servidor a servidor) llega a `/api/billing/epayco/confirmation`; se valida la firma, el importe y la moneda, y es idempotente. Prueba primero en modo de pruebas de ePayco con una tarjeta de prueba.

**Dominios.** Variables `VERCEL_TOKEN` (token dedicado, alcance del equipo), `VERCEL_TEAM_ID` y `VERCEL_PROJECT_ID` (el proyecto de la plataforma). Al confirmarse el pago, el dominio se compra en el registrador de Vercel **a nombre del cliente** (los datos de titular se piden en el checkout), con renovación automática desactivada; se cobra al **método de pago de la cuenta de Vercel**. Después se añade al proyecto (con `www` → redirección), Vercel gestiona DNS y SSL y el middleware sirve el sitio. Si el precio del registrador sube más de un 10 % respecto a lo cotizado, la compra se detiene y el pedido queda «requiere revisión». Cuando el cliente paga su renovación, el dominio se renueva un año.

## 9. Control de costes de IA

- **Modelos mixtos** (`/admin/ai`): consultor, arquitecto y todo lo que ocurre durante la vista previa gratuita (`developer_preview`, `modify_preview`) usan Claude Haiku 5.5; al activarse el proyecto, desarrollo y modificaciones pasan a Claude Sonnet 5.5.
- **Freno diario** (`free_preview_daily_budget_usd`, 5 USD): si el gasto de IA del día (hora de Colombia) en proyectos sin activar alcanza el tope, las vistas previas nuevas esperan al día siguiente con un aviso; los proyectos activados no se detienen. Los proyectos de administradores no cuentan.
- **Registro**: se rechazan correos desechables y más de `max_signups_per_ip_day` cuentas nuevas por conexión en 24 h (la IP se guarda con hash y sal; opcionalmente `IP_HASH_SALT`).
- **Cambios del plan anual**: `included_changes_year` (20) por año; después, paquetes `change_packs` pagados con ePayco. El contador y los paquetes se reinician al renovar.
- **Panel**: `/admin/ai` muestra el gasto de hoy frente al tope, el gasto de 14 días en vistas previas frente a proyectos activados y la conversión.
- **Red de seguridad**: define además un límite mensual de gasto en console.anthropic.com.

# Ideon Data · datos en la nube y usuarios para las apps de los clientes

Las aplicaciones que generan los agentes (inventario, CRM, suite…) guardan sus
datos en la nube del proyecto. El equipo del cliente entra con usuario y
contraseña. Antes, cada navegador tenía su propia copia en `localStorage`.

## Cómo funciona

| Pieza | Dónde |
|---|---|
| SDK del navegador `IdeonDB` | `public/ideon-data.js` (sin dependencias, interfaz en Shadow DOM) |
| Inyección del SDK (solo si la app usa `IdeonDB.ready(`) | `injectDataSdk` en `src/features/deploy/serve.ts` |
| API de la app (login, sesión, registros) | `src/app/api/apps/[projectId]/…` |
| Gestión del equipo desde el workspace | `src/app/api/projects/[id]/app-users/…` y la tarjeta «Equipo y datos de la app» (Publicar) |
| Copia de seguridad (JSON) | `GET /api/projects/[id]/app-data/export` |
| Núcleo puro (validación, límites) | `src/features/appdata/core.ts` (`tests/appdata.test.mjs`) |
| Servidor (contraseñas scrypt, sesiones, correo de acceso) | `src/features/appdata/server.ts` |
| Tablas | `app_users`, `app_sessions`, `app_records` (migración `0010_app_data.sql`, RLS sin políticas: solo el servidor) |

**Modos del SDK:**
- `live`: app publicada; datos en la nube y obligación de iniciar sesión.
- `demo`: vista previa del workspace; datos de ejemplo en el navegador y sin red.
- `local`: archivo ZIP descargado o demos públicas; igual que `demo`.

**API para el código de la app** (también va en el prompt del desarrollador, `IDEON_DATA_GUIDE`):
- `db.all / get / find / count`: lectura síncrona sobre la caché.
- `db.insert / update / remove / increment`: escritura síncrona; se sincroniza en segundo plano.
- `db.seed`: configuración inicial, se crea una sola vez y también en la app real.
- `db.sample`: datos de ejemplo, solo en la vista previa.
- `db.on('change')`: cambios de otros usuarios (sondeo cada 8 s).
- `db.user`, `db.users()`, `db.logout()`, `db.downloadJSON()`.

## Garantías

- **Varias personas a la vez:**
  - Las escrituras van registro a registro.
  - `update` fusiona campos de forma atómica en el servidor.
  - `increment` es atómico; se usa para stock y saldos y nunca pierde unidades.
  - Los ids nuevos son UUID generados en el navegador, así que no hay colisiones.
- **Sin conexión:** los cambios se encolan, se conservan aunque se recargue la página y se envían al volver.
- **Sesiones:**
  - Cookie httpOnly por proyecto, `SameSite=Lax`, de 30 días.
  - Desactivar a un usuario o regenerar su contraseña cierra sus sesiones.
- **Límites:** 25.000 registros y 50 usuarios por app, 32 KB por registro, 100 operaciones por lote.
- **Acceso:**
  - La app solo funciona con el proyecto activado y el plan al día (si no, 403 o 402).
  - Login con límite de 10 intentos cada 15 minutos por conexión.

## Seguridad

- Las apps se sirven desde `sitios.ideonapp.com` o desde su dominio propio. `ideonapp.com/s/…` redirige al dominio de sitios, para que el código de una app nunca comparta origen con la sesión del panel.
- `connect-src 'self'` solo en apps publicadas que usan Ideon Data. La vista previa y las demos siguen con `connect-src 'none'`.
- **Limitación conocida:** en `sitios.ideonapp.com` todas las apps comparten origen. El código de una app podría hacer peticiones a la API de otra app si la misma persona tiene sesión abierta en ambas en ese navegador. Las apps las genera la plataforma, así que el riesgo es bajo. **Recomendación:** que cada cliente use su dominio propio, que aísla por completo. Más adelante se puede pasar a un subdominio por app (`<slug>.sitios.ideonapp.com`), lo que requiere un DNS comodín.
- Los roles (`admin` / `member`) se aplican en la interfaz de cada app. El servidor no restringe colecciones por rol.

## Agentes

- **Prompts:** las apps nuevas se generan con `IdeonDB` (`IDEON_DATA_GUIDE`). Al editar una app antigua basada en `localStorage`, el agente la migra si el cliente pide compartir datos o tener usuarios.
- **QA:** avisa si una app no usa Ideon Data.
- **Razonamiento:** generar o editar con Haiku 5.5 (vista previa) va con el razonamiento desactivado. Con él activo, Haiku gastaba 55.000 de 64.000 tokens pensando y dejaba el HTML cortado; sin él, la app sale completa (unos 18.000 tokens, ~0,01 USD).

## Pruebas realizadas (07/11/2026)

- 39/39 pruebas unitarias.
- SDK en modo local: 11/11.
- En vivo contra la base real, con el proyecto de prueba restaurado después:
  - El dueño da acceso a dos personas desde Publicar.
  - Login y rechazo de una contraseña incorrecta.
  - La cookie no es legible desde JavaScript.
  - La app real empieza sin datos de ejemplo y la semilla no se duplica.
  - Stock atómico con dos usuarios a la vez: 0 + 25 − 3 = 22 en ambos.
  - Los cambios y los borrados se propagan de una persona a la otra.
  - Sin conexión, los cambios se envían al volver.
  - Cierre de sesión.
  - Un usuario desactivado pierde la sesión (401); una sesión de otro proyecto no sirve (404); un proyecto ajeno no se puede gestionar (404).
  - Exportación JSON.
- Apps generadas por los agentes:
  - Haiku: completa, QA 16/16, funciona en la vista previa.
  - Sonnet: completa, QA 15/16, funciona en vivo con login, 5 vistas y persistencia entre sesiones.

## Prospección con IA (`db.prospect`)

- **Qué hace:** desde el CRM del cliente, `db.prospect('ferreterías', { location: 'Medellín', max: 10 })` busca en la web, con Claude y las herramientas `web_search` y `web_fetch`, empresas reales y sus datos de contacto corporativos. Devuelve nombre, sector, ciudad, dirección, teléfono, WhatsApp, correo, web, la URL de la **fuente** y una nota.
- **Fuentes:** no se usan LinkedIn, Instagram, Facebook, TikTok ni X (están bloqueadas). Solo datos publicados por la propia empresa o por directorios públicos, sin inventar.
- **Dónde está:**
  - API `POST /api/apps/[projectId]/prospect`, solo para usuarios de la app con sesión.
  - Lógica en `src/features/appdata/prospect.ts`; limpieza de resultados en `normalizeProspects` (`core.ts`).
- **Cobro (ePayco, COP, editable en Backoffice → Ajustes):**
  - 3 búsquedas de prueba gratis por app (`prospect_trial_searches`).
  - Plan prepago: 80.000 COP por 20 búsquedas durante 30 días (`prospect_plan_price`, `prospect_plan_searches`, `prospect_plan_days`). Renovar con el plan activo suma las búsquedas y alarga la vigencia desde el final; si venció, empieza de cero.
  - Búsquedas sueltas: 12.000 COP cada una (`prospect_single_price`), no vencen.
  - Se gastan en orden prueba → plan → sueltas. Una búsqueda fallida no gasta saldo. Sin saldo, la API responde 402 `no_searches` y el SDK le dice al usuario que el dueño compre en Ideonapp.
  - El uso se cuenta en `rate_limits` (`prospect:trial|plan|credit`); el plan y las compras en columnas `prospect_*` de `projects` (migración `0011_prospect_billing.sql`).
  - El dueño compra desde Publicar → «Prospección con IA» (solo aparece si la app usa `db.prospect`). API: `GET /api/projects/[id]/prospect`, `POST /api/projects/[id]/prospect/buy`; se acredita en `fulfilPayment` al confirmarse el pago.
  - Margen: cada búsqueda cuesta ~0,35 USD (~1.400 COP); el plan sale a 4.000 COP por búsqueda.
- **Coste:** se registra en `ai_usage`. Prueba real del 09/11/2026: «ferreterías en Medellín» devolvió 6 empresas reales en 47 s por 0,35 USD con Opus 5.5.
- **Modelo:** el de la fila `prospect` de `model_policies`; sin ella, `claude-opus-5-5`.
- **Si `web_fetch` no está permitido** (como en entornos con red restringida), se busca solo con `web_search`.
- **Vista previa y demo:** resultados ficticios marcados como tales. En el demo CRM, vista «Prospección IA» con importación como prospectos y campaña para los importados.

## Rollback

- **Código:** revertir el merge o usar Instant Rollback en Vercel. Las apps publicadas antes de este cambio no usan el SDK y no se ven afectadas.
- **Base de datos:** `drop table app_records, app_sessions, app_users; drop function app_record_patch, app_record_increment;`.

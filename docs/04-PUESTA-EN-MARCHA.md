# Ideon — Puesta en marcha (Fase 1)

## 1. Requisitos
- Node.js 20+ y npm.
- Cuenta en [Supabase](https://supabase.com) (plan gratuito suficiente para empezar).
- Cuenta en [Vercel](https://vercel.com) para el despliegue del frontend (opcional en local).

## 2. Crear el proyecto Supabase
1. Crea un proyecto nuevo (región recomendada: `us-east-1` para Colombia/LATAM por latencia).
2. En **SQL Editor** ejecuta, en este orden:
   - `supabase/migrations/0001_foundation.sql`
   - `supabase/seed.sql`
3. En **Authentication → Providers → Email** deja activado *Email* y decide si exiges confirmación de correo (*Confirm email*). Si la desactivas, el registro inicia sesión al instante.
4. En **Authentication → URL Configuration**:
   - *Site URL*: `http://localhost:3000` (y la URL de producción cuando exista).
   - *Redirect URLs*: `http://localhost:3000/api/auth/callback`, `https://<tu-dominio>/api/auth/callback`.
5. (Opcional) **Database → Replication**: activa Realtime para `messages` y `project_events` cuando llegue la Fase 2.

## 3. Variables de entorno
```bash
cp .env.example .env.local
```
Completa `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API) y `SUPABASE_SERVICE_ROLE_KEY` (solo servidor).

Sin estas variables la web pública funciona, pero el registro/inicio de sesión muestra un aviso explícito de "no configurado" (no se simula).

## 4. Ejecutar
```bash
npm install
npm run dev
```
- `/es` y `/en`: homepage.
- `/es/register`: crear cuenta → `/es/projects/new` recupera la idea escrita en la homepage y crea el proyecto.
- `/api/health`: estado del servicio.

## 5. Tipos de base de datos
Cuando cambies el esquema, regenera los tipos:
```bash
npx supabase gen types typescript --project-id <id> > src/types/database.types.ts
```

## 6. Despliegue en Vercel
1. Importa el repositorio en Vercel.
2. Añade las variables de entorno (las mismas de `.env.local`, con `NEXT_PUBLIC_APP_URL` apuntando al dominio final).
3. Despliega. El middleware gestiona idioma y sesión; no se requiere configuración adicional.

## 7. Verificación realizada en esta entrega
- `npm run build`, `npx tsc --noEmit` y `npm run lint` sin errores.
- Migración y seed ejecutados sobre PostgreSQL 16 con un stub del esquema `auth`; pruebas de RLS: un usuario no ve ni puede insertar en proyectos, mensajes ni eventos de otra organización; catálogos legibles públicamente.
- Flujo de conversión probado con Playwright: homepage → ejemplo → "Comenzar proyecto" → registro con la idea recuperada; validación de idea vacía; redirección de rutas privadas a `/login`; páginas ES/EN; vistas de escritorio y móvil.
- Pendiente de probar con un proyecto Supabase real: registro, confirmación por correo, creación de proyecto y envío de mensajes (la lógica está implementada contra la API oficial de Supabase; sin credenciales no se puede ejecutar aquí).

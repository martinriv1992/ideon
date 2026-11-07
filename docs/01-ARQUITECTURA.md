# Ideon — Análisis de arquitectura

> Plataforma autónoma de creación y desarrollo digital mediante IA.
> Documento vivo. Versión 0.1 — Fase 1 (Fundación).

## 1. Principios de diseño

1. **Ejecución real, no demostración.** Cada capa existe para que un agente pueda, con el tiempo, escribir, ejecutar, probar y publicar software de verdad. Nada se marca como "hecho" si no se ha ejecutado y comprobado.
2. **Aislamiento por proyecto.** Datos, archivos, secretos, entorno de ejecución y memoria de IA son privados por proyecto y por organización (cliente).
3. **Humano en el bucle donde hay coste o riesgo.** Presupuestos, despliegues, compras de dominio, integraciones externas y cualquier operación que genere costes requieren aprobación explícita y quedan registradas.
4. **Modularidad por fases.** La Fase 1 crea los contratos (tablas, tipos, rutas, eventos) que las fases 2–5 amplían sin reescribir.
5. **Una sola fuente de verdad.** PostgreSQL (Supabase) guarda el estado; la UI y los agentes lo leen y lo mutan mediante acciones tipadas y auditadas.
6. **Bilingüe desde el día uno.** ES/EN con `next-intl`; ningún texto de interfaz está incrustado en componentes.

## 2. Visión general del sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│  CAPA WEB (Next.js 15, App Router, Vercel)                          │
│  Marketing · Auth · Dashboard cliente · Workspace · Backoffice      │
│  Server Components + Server Actions + Route Handlers (API)          │
└──────────────┬──────────────────────────────────────┬──────────────┘
               │ Supabase SSR (cookies)               │ HTTPS / WS
┌──────────────▼──────────────┐          ┌────────────▼──────────────┐
│  SUPABASE                   │          │  MOTOR DE AGENTES (Fase 2)│
│  Postgres + RLS             │◄────────►│  Orquestador · Consultor  │
│  Auth · Storage · Realtime  │          │  Arquitecto · Diseñador   │
│  pg_cron / colas (pgmq)     │          │  Desarrollador · QA · Ops │
└──────────────┬──────────────┘          └────────────┬──────────────┘
               │                                      │ API LLM (Anthropic / OpenAI)
┌──────────────▼──────────────────────────────────────▼──────────────┐
│  SERVICIO DE EJECUCIÓN (Fase 3) — infraestructura independiente    │
│  Workers Node · Sandboxes Docker/Firecracker por proyecto          │
│  FS virtual · Git · Terminal controlada · Preview por proyecto     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1 Por qué esta arquitectura

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Next.js 15 App Router + Server Actions | SPA React + API Express | Menos superficie; SSR y streaming gratis; un solo despliegue en Vercel en Fase 1. |
| Supabase (Postgres + Auth + Storage + Realtime) | Auth0 + RDS + S3 por separado | Un proveedor, RLS nativo para separar datos por cliente, Realtime para el workspace, coste casi cero al inicio. |
| `next-intl` con prefijo de ruta (`/es`, `/en`) | i18n solo en cliente | SEO correcto por idioma y textos en Server Components. |
| Tailwind 4 + componentes propios | Librería UI de terceros | Control total de la identidad visual premium; sin peso de componentes no usados. |
| Motor de agentes como servicio separado (Fase 2–3) | Ejecutar agentes dentro de Vercel | Ejecuciones largas (minutos/horas), WebSockets persistentes y Docker no caben en funciones serverless. |
| Cola de trabajos en Postgres (`pgmq`) en Fase 2; Redis/BullMQ si crece | Redis desde el inicio | Evita infraestructura adicional hasta que el volumen lo justifique. |
| Pagos: Stripe primero; Wompi como adaptador para Colombia | Pasarela única | Interfaz `PaymentProvider` desde el modelo de datos para añadir Wompi sin tocar la lógica comercial. |

## 3. Estructura de carpetas

```
ideon/
├── docs/                         # Decisiones técnicas (este documento y siguientes)
├── supabase/
│   ├── migrations/               # SQL versionado (esquema, RLS, funciones)
│   └── seed.sql                  # Datos de configuración (planes, categorías)
├── messages/                     # Traducciones es.json / en.json
├── public/                       # Estáticos
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── (marketing)/      # Homepage, legal, precios
│   │   │   ├── (auth)/           # login, register, forgot, callback
│   │   │   ├── (app)/            # Área privada del cliente
│   │   │   │   ├── dashboard/
│   │   │   │   ├── projects/[id]/  # Workspace (3 zonas)
│   │   │   │   ├── billing/ · settings/ · support/
│   │   │   └── (admin)/          # Backoffice (Fase 5)
│   │   └── api/                  # Route handlers (webhooks, health)
│   ├── components/
│   │   ├── ui/                   # Primitivos: Button, Input, Card, Badge…
│   │   ├── marketing/            # Secciones de la homepage
│   │   ├── app/                  # Shell del dashboard, sidebar, header
│   │   └── workspace/            # Chat, preview, panel de proyecto
│   ├── features/                 # Lógica por dominio (acciones + consultas + esquemas)
│   │   ├── auth/
│   │   ├── projects/
│   │   ├── conversations/
│   │   ├── proposals/            # Fase 2
│   │   └── agents/               # Fase 2 (cliente del motor)
│   ├── i18n/                     # routing.ts, request.ts, navigation.ts
│   ├── lib/
│   │   ├── supabase/             # client.ts, server.ts, middleware.ts, admin.ts
│   │   ├── env.ts                # Validación de variables de entorno (zod)
│   │   └── utils.ts
│   ├── types/                    # database.types.ts (generado), dominio
│   └── middleware.ts             # i18n + refresco de sesión + protección de rutas
├── .env.example
└── package.json
```

Regla: **la UI no habla con Supabase directamente desde componentes cliente para escribir**. Las mutaciones van por Server Actions en `features/*/actions.ts`, validadas con `zod`, para que el mismo punto registre auditoría y, en el futuro, encole trabajos de agentes.

## 4. Capas y responsabilidades

### 4.1 Web (Next.js)
- **Marketing**: estático/ISR, bilingüe, el cuadro conversacional es el CTA principal. La idea que escribe el visitante se guarda en `sessionStorage` y se convierte en el primer proyecto tras registrarse (sin formularios largos).
- **Auth**: Supabase Auth con cookies (SSR). Email + contraseña en Fase 1; OAuth (Google/GitHub) es un interruptor de configuración.
- **Dashboard**: proyectos, estados, conversaciones. Los módulos de presupuestos, facturación y suscripciones existen como rutas con estado "sin datos" real (no simulado) hasta su fase.
- **Workspace**: tres zonas (conversación / vista previa / estructura). En Fase 1 la conversación persiste mensajes del cliente y muestra el historial; el agente consultor responde a partir de la Fase 2. La vista previa muestra el estado real del proyecto (sin preview hasta que exista un entorno).

### 4.2 Datos (Supabase)
- Postgres con **RLS en todas las tablas**: un usuario solo ve filas de las organizaciones a las que pertenece.
- `organizations` es la unidad de facturación y aislamiento; un usuario puede pertenecer a varias (su empresa, la de un cliente suyo).
- Auditoría: `project_events` registra cada acción relevante (creación, mensaje, cambio de estado, aprobación), base del "historial de instrucciones" del workspace y de la trazabilidad de costes.

### 4.3 Motor de agentes (Fase 2)
- Servicio Node/TypeScript independiente (`services/agent-engine`, futuro monorepo con pnpm workspaces).
- Orquestador que ejecuta un **grafo de agentes** con estado persistido en `agent_runs` / `agent_steps`.
- Selección de modelo por tarea (`model_policies`): consultor y arquitecto → modelos de razonamiento; generación de código → modelo de código; resúmenes → modelo económico.
- Memoria por proyecto: `project_memory` (hechos, decisiones, glosario) + embeddings (`pgvector`) sobre especificaciones y código.
- Todo consumo queda en `ai_usage` (tokens, modelo, coste) por proyecto y organización → margen por proyecto en el backoffice.

### 4.4 Servicio de ejecución (Fase 3)
- Un **sandbox por proyecto** (contenedor Docker con límites de CPU/RAM/red; evaluar Firecracker/E2B/Fly Machines).
- Sistema de archivos del proyecto versionado en Git (repositorio por proyecto, remoto privado).
- Terminal controlada: lista blanca de comandos, tiempo máximo, sin acceso a secretos de plataforma.
- Preview desplegable por proyecto en subdominio (`<slug>.preview.ideon.app`) tras cada build válido.
- Rollback = checkout de un `project_versions.commit_sha` + redeploy.

### 4.5 Publicación y comercialización (Fases 4–5)
- Despliegue a infraestructura propia o a la del cliente (Vercel/Fly/Railway vía adaptadores).
- Stripe Checkout + Billing para presupuestos cerrados y suscripciones; Wompi como `PaymentProvider` adicional para Colombia.
- Backoffice con rol `platform_admin` (claim en JWT), separado por RLS de los datos de clientes salvo lectura supervisada y auditada.

## 5. Seguridad (desde Fase 1)

- Autenticación Supabase con cookies `httpOnly`; refresco de sesión en `middleware.ts`.
- RLS en todas las tablas; políticas por pertenencia a organización y por rol (`owner`, `admin`, `member`, `viewer`).
- Clave `service_role` solo en servidor (`lib/supabase/admin.ts`), nunca expuesta al cliente; variables validadas con `zod` al arrancar.
- Validación de todas las entradas de Server Actions con `zod`; límites de longitud en mensajes e ideas.
- Rate limiting por IP/usuario en acciones públicas (Fase 2, con Upstash o tabla `rate_limits`).
- Auditoría en `project_events`; backups automáticos de Supabase (PITR en plan Pro).
- Fase 3: sandboxes sin red saliente por defecto, secretos del proyecto cifrados (`project_secrets` con `pgsodium`), lista blanca de comandos, cuotas de consumo por organización.

## 6. Entorno y variables

Ver `.env.example`. Mínimo para Fase 1:

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (RLS aplica) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor (tareas administrativas) |
| `NEXT_PUBLIC_APP_URL` | URL pública (redirecciones de auth) |

Fase 2+: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `STRIPE_*`, `WOMPI_*`, `AGENT_ENGINE_URL`.

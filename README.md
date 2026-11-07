# Ideon

**Tu idea. Nuestra inteligencia. Tu próximo negocio.**
Plataforma SaaS para convertir ideas en productos digitales reales mediante un sistema multiagente de IA.

Estado: **Fases 1–5 implementadas** (ver `docs/05-ESTADO-POR-FASES.md`): identidad, auth, agentes (consultor con cuestionario guiado, arquitecto, desarrollador, QA), propuestas, versiones, vista previa, imágenes, publicación con hosting propio y dominios, pagos con Stripe y backoffice.

## Documentación

- [`docs/01-ARQUITECTURA.md`](docs/01-ARQUITECTURA.md) — análisis de arquitectura, estructura de carpetas, decisiones técnicas y seguridad.
- [`docs/02-MODELO-DE-DATOS.md`](docs/02-MODELO-DE-DATOS.md) — modelo de datos (Fase 1 y contrato de fases 2–5), políticas RLS.
- [`docs/03-FLUJOS-Y-PLAN.md`](docs/03-FLUJOS-Y-PLAN.md) — flujos de usuario y plan de implementación por fases.
- [`docs/04-PUESTA-EN-MARCHA.md`](docs/04-PUESTA-EN-MARCHA.md) — cómo configurar Supabase, variables de entorno y desplegar.
- [`docs/05-ESTADO-POR-FASES.md`](docs/05-ESTADO-POR-FASES.md) — qué está hecho y qué falta en cada fase.

## Stack

Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · next-intl (ES/EN) · Supabase (Postgres + RLS, Auth, Storage) · Zod · Framer Motion · Lucide.

## Comandos

```bash
npm install
cp .env.example .env.local   # completar con las claves de Supabase
npm run dev                  # http://localhost:3000
npm run build && npm start   # producción
npm run lint
npm test                     # pruebas de agentes (prompts, QA, propuestas)
```

## Principios de desarrollo

- Nada se simula: lo que aún no existe se muestra con su estado real (p. ej. "El consultor de IA se activa en la Fase 2").
- Toda mutación pasa por Server Actions validadas con Zod y queda registrada en `project_events`.
- RLS en todas las tablas; la clave `service_role` nunca llega al navegador.
- Textos de interfaz solo en `messages/*.json`.

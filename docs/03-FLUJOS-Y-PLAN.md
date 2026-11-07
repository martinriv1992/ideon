# Ideon — Flujos de usuario y plan de implementación

## Flujos de usuario

### F-01 · Visitante → primer proyecto (conversión)
1. Llega a la homepage (`/es` o `/en` según `Accept-Language`).
2. Escribe su idea en el cuadro conversacional o elige un ejemplo.
3. Pulsa **Comenzar proyecto** → la idea se guarda en `sessionStorage` (`ideon.pendingIdea`).
4. Si no tiene sesión → `/register?next=/projects/new`. Registro mínimo: nombre, email, contraseña.
5. Tras confirmar/iniciar sesión, `/projects/new` recupera la idea, crea organización personal (si no existe), proyecto en `draft` y la conversación inicial con el primer mensaje del usuario.
6. Aterriza en el workspace del proyecto. (Fase 2: el agente consultor responde en segundos.)

### F-02 · Descubrimiento con el consultor (Fase 2)
Conversación guiada: el agente pregunta solo lo necesario, propone funcionalidades, fija complejidad. Estado `discovery` → `specification` cuando el usuario confirma el alcance.

### F-03 · Especificación y propuesta (Fase 2)
Arquitecto genera `specifications` → se crea `proposals` (plan Starter/Pro/Custom, tiempo, precio, costes externos). El usuario revisa, pide ajustes o **aprueba**. Estado → `approved`.

### F-04 · Contratación (Fase 5)
Pago inicial vía Stripe/Wompi → `payments` → estado `in_development`.

### F-05 · Desarrollo e iteración (Fase 3)
Desarrollador ejecuta en sandbox; el cliente ve preview y escribe cambios ("Quiero añadir un módulo de proveedores"). El orquestador analiza el proyecto existente, planifica el delta y lo ejecuta; QA valida; se crea una `project_version`.

### F-06 · Publicación y mantenimiento (Fase 4–5)
Solicitud de despliegue → `approvals` → despliegue → `live`. Suscripción de hosting/mantenimiento.

### F-07 · Administración (Fase 5)
Backoffice: clientes, proyectos, costes de IA, margen, ejecuciones, errores, tickets, configuración de planes.

## Plan de implementación

| Fase | Entregables | Estado |
|---|---|---|
| **1 · Fundación** | Identidad visual, sistema de diseño, i18n ES/EN, homepage, auth (Supabase), dashboard, proyectos, conversación persistente, migraciones + RLS, auditoría | **En construcción (esta entrega)** |
| 2 · Inteligencia | Servicio de agentes, orquestador, agente consultor y arquitecto, memoria por proyecto, especificaciones, presupuestos, consumo de IA, selección de modelo | Pendiente |
| 3 · Construcción | Sandboxes por proyecto, Git, FS, terminal controlada, generación de código, preview, versionado, aprobaciones | Pendiente |
| 4 · Calidad y publicación | QA automático, despliegue, dominios, rollback, mantenimiento | Pendiente |
| 5 · Comercialización | Stripe + Wompi, suscripciones, facturación, backoffice, analítica | Pendiente |

### Criterios de aceptación Fase 1
- `npm run build` y `npm run lint` sin errores.
- Homepage bilingüe, responsive, con cuadro conversacional funcional (persiste la idea y conduce a registro/proyecto).
- Registro, inicio de sesión, cierre de sesión y recuperación de contraseña reales con Supabase.
- Rutas privadas protegidas por middleware; RLS verificada.
- Crear proyecto desde la idea; listar proyectos; abrir workspace con las tres zonas; enviar mensajes que persisten; historial de eventos.
- Sin botones sin función: lo que aún no existe se indica como tal (no se simula).

# Ideon — Estado por fases

| Fase | Estado | Qué está hecho | Qué falta / siguientes pasos |
|---|---|---|---|
| 1 · Fundación | ✅ | Identidad visual, homepage ES/EN con selector de tipo de solución, auth Supabase, dashboard, proyectos, migraciones + RLS, auditoría | Probar registro/confirmación con un proyecto Supabase real |
| 2 · Inteligencia | ✅ | Capa de proveedor (Anthropic + mock), políticas de modelo editables, agente consultor (cuestionario guiado con opciones), arquitecto (especificación web/app), generación de propuestas desde planes configurables, registro de runs/tokens/coste | Memoria vectorial por proyecto (pgvector), streaming de respuestas, OpenAI como segundo proveedor |
| 3 · Construcción | ✅ (sitios/apps de un archivo) | Desarrollador (web y aplicaciones funcionales), modificaciones incrementales por chat, versiones y restauración, archivos, imágenes en Storage, vista previa aislada (sandbox + CSP), descarga ZIP | Entorno de ejecución Docker por proyecto, proyectos multi-archivo con Git y backend propio (Supabase por proyecto) |
| 4 · Calidad y publicación | ✅ | QA estático real por versión, aprobaciones registradas, hosting propio `/s/<slug>`, adaptador Vercel, dominios propios con instrucciones DNS y verificación, enrutado de dominios en middleware | Pruebas en navegador (Playwright) en el entorno de ejecución, compra de dominios desde la app (API de registrador), SSL automático en dominios propios depende del hosting elegido |
| 5 · Comercialización | ✅ (base + lanzamiento) | Stripe Checkout + webhook + facturas, páginas de presupuestos/facturación/suscripciones/archivos/soporte con tickets, backoffice (KPIs, clientes, proyectos con margen, ejecuciones, consumo IA por modelo, planes, despliegues, tickets, configuración); vista previa gratuita con cambios limitados; activación con ePayco (desarrollo + hosting + dominio); compra de dominios en el registrador de Vercel; paquete anual con renovación y suspensión por impago | Cobro automático de la renovación (tarjeta tokenizada en ePayco), avisos por correo antes del vencimiento, panel de pedidos de dominio en el backoffice, PDF de facturas, contratos |

## Decisiones de seguridad vigentes
- Toda escritura de agentes y publicación se hace en servidor con `service_role`; los usuarios solo escriben lo que RLS les permite.
- La vista previa se sirve con `sandbox` sin `allow-same-origin` y cabeceras CSP; los sitios publicados llevan CSP que impide recursos externos salvo Google Fonts.
- Las operaciones con coste o efecto externo (publicar, dominio) quedan en `approvals` con el usuario que las autorizó.
- Imágenes en bucket privado con políticas por organización; se sirven por `/api/images/<uuid>`.

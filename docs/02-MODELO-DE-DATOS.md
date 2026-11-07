# Ideon — Modelo de datos

Base: PostgreSQL (Supabase). Todas las tablas tienen `id uuid`, `created_at`, `updated_at` y RLS activado.
Las tablas marcadas **F1** se crean en la Fase 1 (`supabase/migrations/0001_foundation.sql`). El resto se documenta aquí para que los contratos de Fase 1 ya las contemplen.

## Diagrama (núcleo)

```
auth.users ──1:1── profiles
     │
     └──< organization_members >── organizations ──< projects ──< conversations ──< messages
                                        │               │
                                        │               ├──< project_events (auditoría)
                                        │               ├──< specifications      (F2)
                                        │               ├──< proposals ──< proposal_items (F2)
                                        │               ├──< agent_runs ──< agent_steps   (F2)
                                        │               ├──< project_memory              (F2)
                                        │               ├──< project_files / versions    (F3)
                                        │               ├──< environments / deployments  (F3-F4)
                                        │               └──< ai_usage                    (F2)
                                        ├──< subscriptions ──< invoices ──< payments     (F5)
                                        └──< support_tickets                             (F5)
pricing_plans (F1, configurable desde admin en F5)
solution_categories (F1)
```

## Tablas Fase 1

### `profiles` **F1**
Extiende `auth.users`. Se crea por trigger al registrarse.
| columna | tipo | notas |
|---|---|---|
| id | uuid PK → auth.users | |
| full_name | text | |
| avatar_url | text | |
| locale | text | `es` / `en` |
| is_platform_admin | boolean | acceso al backoffice |

### `organizations` **F1**
Unidad de aislamiento y facturación ("cliente").
| id, name, slug (unique), type (`personal`/`company`), country, tax_id, billing_email, created_by |

### `organization_members` **F1**
| organization_id, user_id, role (`owner`/`admin`/`member`/`viewer`) — PK compuesta |

### `solution_categories` **F1**
Catálogo orientativo (web app, ecommerce, CRM, ERP, inventario…). `key`, `name_es`, `name_en`, `icon`, `sort_order`. El usuario **no** está limitado a ellas.

### `projects` **F1**
| columna | tipo | notas |
|---|---|---|
| id | uuid | |
| organization_id | uuid FK | |
| created_by | uuid FK profiles | |
| name | text | |
| slug | text | único por organización |
| initial_idea | text | lo que el usuario escribió en el cuadro conversacional |
| category_key | text FK solution_categories (nullable) | sugerida por IA en F2 |
| status | enum `project_status` | ver máquina de estados |
| complexity | enum `project_complexity` (nullable) | `starter` / `pro` / `custom`, fijada por el arquitecto (F2) |
| locale | text | idioma de trabajo |
| archived_at | timestamptz | |

**Máquina de estados `project_status`:**
`draft` → `discovery` (consultor) → `specification` (arquitecto) → `proposal` (presupuesto emitido) → `approved` (cliente aprueba) → `in_development` → `review` (QA) → `ready_to_deploy` → `live` → `maintenance`. Transversales: `on_hold`, `cancelled`.

### `conversations` **F1**
Un proyecto puede tener varias (descubrimiento, cambios posteriores). `project_id`, `title`, `agent_type` (`consultant`/`architect`/`developer`/…), `status` (`open`/`closed`).

### `messages` **F1**
| id, conversation_id, role (`user`/`assistant`/`system`/`tool`), content text, content_json jsonb (bloques estructurados: preguntas, propuestas), author_id (nullable), agent_type (nullable), token_usage jsonb (F2), created_at |

### `project_events` **F1**
Auditoría e historial del workspace. `project_id`, `actor_id` (nullable, null = sistema/agente), `actor_type` (`user`/`agent`/`system`), `type` (texto: `project.created`, `message.sent`, `status.changed`, `proposal.approved`, `deploy.requested`…), `payload jsonb`.

### `pricing_plans` **F1**
Modalidades comerciales editables desde admin. `key` (`starter`/`pro`/`custom`), `name_es`, `name_en`, `description_*`, `price_from` (numeric, nullable), `currency`, `features jsonb`, `is_active`, `sort_order`. **No se insertan precios en el seed**: se muestran "según alcance" hasta que el administrador los configure.

## Tablas Fases 2–5 (contrato)

- **`specifications`** (F2): `project_id`, `version`, `content jsonb` (objetivos, módulos, roles, navegación, arquitectura, modelo de datos, integraciones, seguridad, plan, criterios de aceptación), `generated_by_run_id`.
- **`proposals`** (F2): `project_id`, `specification_id`, `plan_key`, `complexity`, `estimated_days`, `price`, `currency`, `external_costs jsonb`, `maintenance_option jsonb`, `status` (`draft`/`sent`/`approved`/`rejected`/`expired`), `approved_at`, `approved_by`. **`proposal_items`**: módulos/funcionalidades con esfuerzo y precio.
- **`agent_runs`** / **`agent_steps`** (F2): ejecución de un agente sobre un proyecto; `agent_type`, `model`, `status`, `input jsonb`, `output jsonb`, `error`, `started_at`, `finished_at`. Steps = llamadas a herramientas con entrada/salida.
- **`ai_usage`** (F2): `organization_id`, `project_id`, `run_id`, `provider`, `model`, `input_tokens`, `output_tokens`, `cost_usd`. Fuente de "consumo de IA" y "margen por proyecto".
- **`model_policies`** (F2): tarea → proveedor/modelo/parámetros, editable en admin.
- **`project_memory`** (F2): `project_id`, `kind` (`fact`/`decision`/`glossary`/`constraint`), `content`, `embedding vector(1536)`.
- **`project_files`**, **`project_versions`** (F3): metadatos del repositorio (ruta, hash, tamaño; el contenido vive en Git/Storage), `commit_sha`, `message`, `created_by_run_id`.
- **`environments`** (F3): `project_id`, `kind` (`sandbox`/`preview`/`production`), `provider`, `external_id`, `url`, `status`, `resources jsonb`.
- **`deployments`** (F4): `environment_id`, `version_id`, `status`, `logs_url`, `approved_by`, `approved_at`.
- **`approvals`** (F3): operaciones sensibles pendientes (`deploy`, `purchase_domain`, `external_integration`, `spend_over_limit`) con `requested_by_run_id`, `decided_by`, `decision`.
- **`subscriptions`**, **`invoices`**, **`payments`** (F5): `provider` (`stripe`/`wompi`), `external_id`, importes, estados, `period_start/end`.
- **`support_tickets`**, **`ticket_messages`** (F5).
- **`platform_settings`** (F5): claves de configuración comercial (moneda por defecto, impuestos, límites).

## Políticas RLS (Fase 1)

- `profiles`: cada usuario lee/actualiza el suyo; `is_platform_admin` solo lo cambia `service_role`.
- `organizations`: lectura si es miembro; actualización si rol `owner`/`admin`; inserción por usuario autenticado (se vuelve `owner` por trigger).
- `organization_members`: lectura si es miembro de la misma organización; gestión por `owner`/`admin`.
- `projects`, `conversations`, `messages`, `project_events`: acceso si es miembro de la organización del proyecto; `viewer` solo lectura.
- `solution_categories`, `pricing_plans`: lectura pública de filas activas; escritura solo `service_role` (admin en F5).
- Función auxiliar `is_org_member(org_id, min_role)` en `security definer` para no repetir subconsultas.

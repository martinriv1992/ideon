-- Ideon · Seed de configuración (sin datos ficticios de clientes)

insert into public.solution_categories (key, name_es, name_en, description_es, description_en, icon, sort_order) values
  ('web_app',      'Aplicación web',            'Web application',        'Aplicaciones a medida con usuarios, datos y lógica de negocio.', 'Custom apps with users, data and business logic.', 'app-window', 10),
  ('website',      'Web corporativa',           'Corporate website',      'Sitios web profesionales, rápidos y optimizados para SEO.', 'Professional, fast, SEO-ready websites.', 'globe', 20),
  ('ecommerce',    'Tienda online',             'Online store',           'Catálogo, carrito, pagos y gestión de pedidos.', 'Catalog, cart, payments and order management.', 'shopping-bag', 30),
  ('crm',          'CRM personalizado',         'Custom CRM',             'Seguimiento de clientes, oportunidades y ventas.', 'Customers, pipeline and sales tracking.', 'users', 40),
  ('erp',          'Sistema ERP',               'ERP system',             'Gestión integral: compras, ventas, finanzas, operaciones.', 'End-to-end management: purchasing, sales, finance, operations.', 'layers', 50),
  ('inventory',    'Inventario y almacenes',    'Inventory & warehouses', 'Stock, movimientos, recetas de producción y alertas.', 'Stock, movements, production recipes and alerts.', 'package', 60),
  ('management',   'Gestión empresarial',       'Business management',    'Software administrativo y herramientas internas.', 'Administrative software and internal tools.', 'briefcase', 70),
  ('automation',   'Automatización de procesos','Process automation',     'Flujos automáticos entre sistemas y tareas repetitivas.', 'Automated flows between systems and repetitive tasks.', 'workflow', 80),
  ('analytics',    'Dashboards y analítica',    'Dashboards & analytics', 'Indicadores, informes y visualización de datos.', 'KPIs, reports and data visualization.', 'bar-chart-3', 90),
  ('portal',       'Portales de clientes y proveedores', 'Customer & supplier portals', 'Áreas privadas con pedidos, documentos y seguimiento.', 'Private areas with orders, documents and tracking.', 'door-open', 100),
  ('saas',         'Plataforma SaaS',           'SaaS platform',          'Productos multiusuario con suscripciones y planes.', 'Multi-tenant products with subscriptions and plans.', 'cloud', 110),
  ('integration',  'Integraciones',             'Integrations',           'Conexión entre sistemas, APIs y servicios externos.', 'Connecting systems, APIs and external services.', 'plug', 120),
  ('ai_agent',     'Agentes y asistentes de IA','AI agents & assistants', 'Asistentes conversacionales y agentes autónomos.', 'Conversational assistants and autonomous agents.', 'bot', 130),
  ('internal_tool','Herramientas internas',     'Internal tools',         'Utilidades a medida para equipos y operaciones.', 'Custom utilities for teams and operations.', 'wrench', 140)
on conflict (key) do update set
  name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en,
  icon = excluded.icon, sort_order = excluded.sort_order;

-- Planes: sin precio (price_from = null) hasta que el administrador los configure.
insert into public.pricing_plans (key, name_es, name_en, description_es, description_en, features, sort_order) values
  ('starter', 'Starter', 'Starter',
   'Para proyectos pequeños, páginas web y herramientas sencillas.',
   'For small projects, websites and simple tools.',
   '["single_module","responsive","basic_auth","hosting_optional"]', 10),
  ('pro', 'Pro', 'Pro',
   'Para aplicaciones, sistemas empresariales y plataformas con varios módulos.',
   'For applications, business systems and multi-module platforms.',
   '["multi_module","roles","database","integrations","qa","maintenance_optional"]', 20),
  ('custom', 'Custom', 'Custom',
   'Para proyectos complejos, desarrollos avanzados e integraciones específicas.',
   'For complex projects, advanced development and specific integrations.',
   '["dedicated_architecture","advanced_integrations","sla","dedicated_support"]', 30)
on conflict (key) do update set
  description_es = excluded.description_es, description_en = excluded.description_en,
  features = excluded.features, sort_order = excluded.sort_order;

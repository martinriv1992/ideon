-- =============================================================================
-- Ideon · 0007 · Más margen de salida para construir y modificar
-- Una app con 8 módulos generó 48.605 tokens de salida (HTML + razonamiento) y con
-- 32.000 se cortaba: la construcción fallaba después de haberse pagado. Solo se
-- facturan los tokens realmente generados.
-- =============================================================================
update public.model_policies set max_output_tokens = 64000, updated_at = now()
where task in ('developer', 'modify', 'developer_preview', 'modify_preview') and max_output_tokens < 64000;

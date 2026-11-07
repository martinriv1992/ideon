-- =============================================================================
-- Ideon · 0004 · Modelos: claude-sonnet-4-5 ya no está disponible en la API.
-- Se pasa a Claude Sonnet 5.5 ($2 / $10 por millón de tokens de entrada / salida).
-- Más margen de salida porque el modelo razona antes de responder y esos tokens
-- cuentan dentro de max_tokens. Solo cambia las políticas que siguen en el modelo retirado.
-- =============================================================================
update public.model_policies set model = 'claude-sonnet-5-5', input_cost_per_mtok = 2, output_cost_per_mtok = 10,
  max_output_tokens = case task when 'consultant' then 4096 when 'architect' then 8192 else 32000 end,
  updated_at = now()
where model = 'claude-sonnet-4-5';

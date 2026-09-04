-- Agrega ciudad a market_comparable_snapshots (Fase 4, Market Data Model) — hasta hoy solo se
-- guardaba colonia, así que no había forma de agrupar/comparar colonias de una misma ciudad sin
-- adivinar por texto. Necesario para lib/market/betaTramoEngine.ts: encontrar la colonia de
-- banda económica/media con más historial dentro de la MISMA ciudad, para estimar la plusvalía
-- de zonas premium sin historial propio suficiente (San Pedro, etc.) vía el beta calibrado con
-- datos reales de FRED (Case-Shiller tiered index).
--
-- NOTA: esta migración no existía como archivo en el repo pese a que el código (lib/market/
-- persistencia.ts) ya referenciaba supabase/migrations/20260826000000_market_data_model.sql —
-- ese archivo tampoco está en este checkout (el directorio supabase/migrations/ no existía).
-- Este archivo no reconstruye esa migración original, solo agrega la columna nueva sobre la
-- tabla que ya existe en producción.

alter table market_comparable_snapshots
  add column if not exists ciudad text;

create index if not exists idx_market_comparable_snapshots_ciudad
  on market_comparable_snapshots (ciudad);

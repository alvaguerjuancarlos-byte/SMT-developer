-- ============================================================
-- Market Data Model — Fase 4 del Agente de Mercado nuevo (lib/market/)
-- Ver Documents/smartdeveloper/buenas notasde mejora de JCAS/
-- PREFORMA_PROMPT_MAESTRO_AGENTE_MERCADO.md §4, §36, §60, §89.
--
-- Alcance real: solo las 2 tablas mínimas necesarias para que Appreciation
-- Engine (Fase 9) pueda algún día calcular plusvalía real — registrar cada
-- comparable observado CON FECHA, sin sobrescribir el anterior (§36: "no
-- sobrescribir el inventario anterior, esto permitirá estudiar velocidad
-- real del mercado"). El resto de las ~20 tablas de §89 (market_projects,
-- market_zones, market_pipeline, etc.) se agregan cuando exista un motor
-- real que las necesite — no antes, para no acumular tablas vacías.
-- ============================================================

-- 1. Tabla market_sources
--    Registro de fuentes (§60) — hoy solo 2 tipos reales existen en el
--    pipeline (ver lib/market/tipos.ts MarketSource).
create table if not exists market_sources (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,
  source_type   text not null check (source_type in ('web_search', 'llm_estimate')),
  retrieved_at  timestamptz not null default now()
);

-- ============================================================
-- 2. Tabla market_comparable_snapshots
--    Un renglón por comparable observado en un momento dado. NUNCA se
--    actualiza un renglón existente — cada corrida de comparables-venta
--    inserta renglones nuevos con su propio observed_at, para poder
--    construir series de tiempo reales más adelante (Fase 9, Appreciation
--    Engine). proyecto_id es nullable: puede haber observaciones
--    exploratorias sin un proyecto guardado todavía.
-- ============================================================
create table if not exists market_comparable_snapshots (
  id                uuid primary key default gen_random_uuid(),
  proyecto_id       uuid references proyectos(id) on delete cascade,
  source_id         uuid references market_sources(id),
  nombre            text,
  direccion         text,
  colonia           text,
  precio_m2         numeric,
  precio_total      numeric,
  superficie_m2     numeric,
  tipologia         text,
  avance_obra       text,
  fecha_referencia  text,
  url               text,
  lat               numeric,
  lng               numeric,
  distancia_km      numeric,
  observed_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists market_comparable_snapshots_proyecto_idx
  on market_comparable_snapshots (proyecto_id);

-- Índice por fecha — es el que va a usar Appreciation Engine para construir
-- series de tiempo (filtrar por rango de observed_at).
create index if not exists market_comparable_snapshots_observed_at_idx
  on market_comparable_snapshots (observed_at);

-- Índice por colonia — segmentación geográfica más granular disponible hoy
-- (microzona real todavía no existe, ver lib/market/geographyEngine.ts).
create index if not exists market_comparable_snapshots_colonia_idx
  on market_comparable_snapshots (colonia);

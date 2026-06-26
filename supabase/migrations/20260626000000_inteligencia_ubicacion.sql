-- ============================================================
-- Módulo de Inteligencia de Ubicación — Paso 1
-- Habilita PostGIS, crea tablas de isocronas / zonas / análisis
-- y añade columnas de ubicación a terrenos.
-- ============================================================

-- 1. Extensión PostGIS
create extension if not exists postgis;

-- ============================================================
-- 2. Tabla zonas_referencia
--    Polígonos con precio de suelo por colonia / municipio.
-- ============================================================
create table if not exists zonas_referencia (
  id                  uuid primary key default gen_random_uuid(),
  municipio           text not null,
  colonia             text not null,
  geometria           geometry(Polygon, 4326) not null,
  precio_m2_min       numeric not null,
  precio_m2_base      numeric not null,
  precio_m2_max       numeric not null,
  factor_negociacion  numeric not null default 0.90,
  n_muestras          int not null default 0,
  fuente              text,
  fecha_actualizacion timestamptz not null default now()
);

-- Índice espacial para point-in-polygon rápido
create index if not exists zonas_referencia_geometria_gist
  on zonas_referencia using gist (geometria);

-- ============================================================
-- 3. Tabla terrenos (crea si no existe; si ya existe, no-op)
--    Las columnas lat/lng se añaden a continuación con IF NOT EXISTS.
-- ============================================================
create table if not exists terrenos (
  id         uuid primary key default gen_random_uuid(),
  lat        numeric,
  lng        numeric,
  created_at timestamptz not null default now()
);

-- Agrega columnas de ubicación si la tabla pre-existía sin ellas
alter table terrenos
  add column if not exists lat numeric;

alter table terrenos
  add column if not exists lng numeric;

-- FK a zona (se agrega después de crear zonas_referencia)
alter table terrenos
  add column if not exists zona_id uuid references zonas_referencia(id);

-- ============================================================
-- 4. Tabla isocronas
--    Cache de polígonos calculados por OpenRouteService.
-- ============================================================
create table if not exists isocronas (
  id                   uuid primary key default gen_random_uuid(),
  terreno_id           uuid not null references terrenos(id) on delete cascade,
  perfil               text not null default 'driving'
                         check (perfil in ('driving', 'walking')),
  rango_min            int  not null,   -- 15 / 30 / 45
  geojson              jsonb not null,
  poblacion_alcanzada  int,
  fuente_api           text not null default 'openrouteservice',
  fecha_calculo        timestamptz not null default now()
);

-- Índice único para cache upsert por (terreno, perfil, rango)
create unique index if not exists isocronas_cache_idx
  on isocronas (terreno_id, perfil, rango_min);

-- ============================================================
-- 5. Tabla analisis_ubicacion
--    Resultado consolidado por terreno (score + precio suelo).
-- ============================================================
create table if not exists analisis_ubicacion (
  id                   uuid primary key default gen_random_uuid(),
  terreno_id           uuid not null references terrenos(id) on delete cascade unique,
  score_accesibilidad  numeric,
  poblacion_15         int,
  poblacion_30         int,
  poblacion_45         int,
  pois_cercanos        jsonb,
  precio_suelo_zona    numeric,
  -- 'sobreprecio' | 'en_rango' | 'subprecio' | null
  bandera_precio       text check (bandera_precio in ('sobreprecio', 'en_rango', 'subprecio')),
  fecha_calculo        timestamptz not null default now()
);

-- ============================================================
-- 6. Función RPC zona_por_punto
--    Recibe lat/lng y devuelve la fila de zonas_referencia
--    cuyo polígono contiene el punto (point-in-polygon).
--    Usada desde /api/market/land-price vía fetch RPC.
-- ============================================================
create or replace function zona_por_punto(p_lat float8, p_lng float8)
returns setof zonas_referencia
language sql
stable
as $$
  select *
  from   zonas_referencia
  where  st_contains(
           geometria,
           st_setsrid(st_makepoint(p_lng, p_lat), 4326)
         )
  limit 1;
$$;

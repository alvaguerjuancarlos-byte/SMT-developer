import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['playwright-core'],
  // @smt/shared-realestate se publica como .ts fuente sin paso de build propio -- Turbopack no
  // transpila TS dentro de node_modules por default (encontrado 2026-10-03 probando el mismo
  // paquete en smtbroker; next dev/build nunca se corrió aquí tras la extracción, solo tsc/vitest,
  // así que este repo tenía el mismo bug latente sin detectar).
  transpilePackages: ['@smt/shared-realestate'],
};

export default nextConfig;

import type { NextConfig } from "next";

// Linting is owned by Biome (`npm run lint`/`npm run check`), not ESLint.
// Next 16 removed `next lint` and the `eslint` config key, so `next build`
// no longer runs ESLint. Type checking still runs during `next build` via TS.
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    env: { NODE_ENV: "test" },
    setupFiles: ["dotenv/config"],
  },
});

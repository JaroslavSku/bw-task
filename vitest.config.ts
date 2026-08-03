import path from "node:path";
import { defineConfig } from "vitest/config";

const testDatabaseUrl =
    process.env.TEST_DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/taskmaster_test";

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname),
        },
    },
    test: {
        environment: "node",
        globalSetup: "./tests/globalSetup.ts",
        env: {
            DATABASE_URL: testDatabaseUrl,
            JWT_SECRET: "vitest-secret-0123456789abcdef0123456789abcdef",
        },
    },
});

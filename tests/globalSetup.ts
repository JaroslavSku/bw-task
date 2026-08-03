import { execSync } from "node:child_process";

export default function runMigrations(): void {
    const databaseUrl =
        process.env.TEST_DATABASE_URL ??
        "postgres://postgres:postgres@localhost:5432/taskmaster_test";

    execSync("node node_modules/db-migrate/bin/db-migrate up", {
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: "inherit",
    });
}

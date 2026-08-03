import { z } from "zod";

const envSchema = z.object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
    if (!cachedEnv) {
        const parsed = envSchema.safeParse(process.env);
        if (!parsed.success) {
            const problems = parsed.error.issues
                .map(issue => `${issue.path.join(".")}: ${issue.message}`)
                .join("; ");
            throw new Error(`Invalid environment configuration - ${problems}`);
        }
        cachedEnv = parsed.data;
    }
    return cachedEnv;
}

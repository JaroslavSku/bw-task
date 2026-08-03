import { z } from "zod";

export const credentialsSchema = z.object({
    email: z.email().max(254),
    password: z.string().min(8, "password must be at least 8 characters").max(200),
});

export type Credentials = z.infer<typeof credentialsSchema>;

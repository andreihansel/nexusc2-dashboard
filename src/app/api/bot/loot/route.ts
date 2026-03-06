import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
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

        return NextResponse.json({ status: "ok" });
    } catch (e) {
        console.error("Loot error:", e);
        return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
}

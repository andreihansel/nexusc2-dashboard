import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

// GET: Poll pending commands for a bot
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

        // Mark as delivered
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

// POST: Report command execution result
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
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

        return NextResponse.json({ status: "ok" });
    } catch (e) {
        console.error("Commands POST error:", e);
        return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
}

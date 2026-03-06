"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Module {
    id: string;
    label: string;
    icon: string;
    desc: string;
}

export default function BotModuleToggles({
    botId,
    availableModules,
    enabledModules: initialEnabled,
}: {
    botId: string;
    availableModules: Module[];
    enabledModules: string[];
}) {
    const [enabled, setEnabled] = useState<string[]>(initialEnabled);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const supabase = createClient();

    const toggle = (moduleId: string) => {
        setEnabled((prev) =>
            prev.includes(moduleId)
                ? prev.filter((m) => m !== moduleId)
                : [...prev, moduleId]
        );
        setSaved(false);
    };

    const saveConfig = async () => {
        setSaving(true);
        const { error } = await supabase
            .from("bot_configs")
            .upsert(
                { bot_id: botId, modules_enabled: enabled, updated_at: new Date().toISOString() },
                { onConflict: "bot_id" }
            );

        if (!error) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
        setSaving(false);
    };

    return (
        <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableModules.map((mod) => {
                    const isEnabled = enabled.includes(mod.id);
                    return (
                        <button
                            key={mod.id}
                            onClick={() => toggle(mod.id)}
                            className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${isEnabled
                                    ? "bg-emerald-500/5 border-emerald-500/30 shadow-sm shadow-emerald-500/5"
                                    : "bg-zinc-800/20 border-zinc-800/50 hover:border-zinc-700/50"
                                }`}
                        >
                            <span className="text-xl mt-0.5">{mod.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <p className={`text-sm font-medium ${isEnabled ? "text-emerald-400" : "text-zinc-300"}`}>
                                        {mod.label}
                                    </p>
                                    <div className={`w-8 h-4.5 rounded-full flex items-center transition-colors ${isEnabled ? "bg-emerald-500" : "bg-zinc-700"}`}>
                                        <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transform transition-transform ${isEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                                    </div>
                                </div>
                                <p className="text-xs text-zinc-500 mt-0.5">{mod.desc}</p>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-zinc-500">{enabled.length} module{enabled.length !== 1 ? "s" : ""} enabled</p>
                <button
                    onClick={saveConfig}
                    disabled={saving}
                    className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${saved
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600 shadow-lg shadow-emerald-500/15"
                        } disabled:opacity-50`}
                >
                    {saving ? "Saving..." : saved ? "✓ Saved" : "Save Configuration"}
                </button>
            </div>
        </div>
    );
}

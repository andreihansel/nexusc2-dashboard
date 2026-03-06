import fs from "fs";
import path from "path";

// Utility formatting
function ab2b64(buf: ArrayBuffer): string {
    return Buffer.from(buf).toString("base64");
}
function b642ab(base64: string): ArrayBuffer {
    const b = Buffer.from(base64, "base64");
    return new Uint8Array(b).buffer;
}

let __masterKeyPair: CryptoKeyPair | null = null;
let __masterPubKeyB64: string | null = null;

export async function getMasterKey() {
    if (__masterKeyPair) return { keyPair: __masterKeyPair, pubKeyB64: __masterPubKeyB64! };

    // Check if key exists on disk
    const keyPath = path.join(process.cwd(), ".nexus-key");
    if (fs.existsSync(keyPath)) {
        const data = fs.readFileSync(keyPath, "utf8");
        const parsed = JSON.parse(data);
        const pubBuf = b642ab(parsed.pub);
        const privBuf = b642ab(parsed.priv);

        const pubKey = await crypto.subtle.importKey(
            "raw", pubBuf, { name: "ECDH", namedCurve: "P-256" }, true, []
        );
        const privKey = await crypto.subtle.importKey(
            "pkcs8", privBuf, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
        );
        __masterKeyPair = { publicKey: pubKey, privateKey: privKey };
        __masterPubKeyB64 = parsed.pub;
    } else {
        // Generate new
        const kp = await crypto.subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" },
            true,
            ["deriveKey", "deriveBits"]
        );
        const pubRaw = await crypto.subtle.exportKey("raw", kp.publicKey);
        const privPkcs8 = await crypto.subtle.exportKey("pkcs8", kp.privateKey);

        const pubB64 = ab2b64(pubRaw);
        const privB64 = ab2b64(privPkcs8);

        fs.writeFileSync(keyPath, JSON.stringify({ pub: pubB64, priv: privB64 }));
        __masterKeyPair = kp;
        __masterPubKeyB64 = pubB64;
    }

    return { keyPair: __masterKeyPair, pubKeyB64: __masterPubKeyB64! };
}

export async function deriveSessionKey(botPubKeyB64: string) {
    const { keyPair } = await getMasterKey();

    const botPubRaw = b642ab(botPubKeyB64);
    const botPubKey = await crypto.subtle.importKey(
        "raw", botPubRaw, { name: "ECDH", namedCurve: "P-256" }, true, []
    );

    const sessionKey = await crypto.subtle.deriveKey(
        { name: "ECDH", public: botPubKey },
        keyPair.privateKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    return sessionKey;
}

export async function encryptPayload(sessionKey: CryptoKey, payloadObj: any) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const data = enc.encode(JSON.stringify(payloadObj));

    const ciphertextBuf = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        sessionKey,
        data
    );

    return {
        iv: ab2b64(iv.buffer),
        ciphertext: ab2b64(ciphertextBuf)
    };
}

export async function decryptPayload(sessionKey: CryptoKey, ivB64: string, ciphertextB64: string) {
    const iv = new Uint8Array(b642ab(ivB64));
    const ciphertext = b642ab(ciphertextB64);

    const plaintextBuf = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        sessionKey,
        ciphertext
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(plaintextBuf));
}

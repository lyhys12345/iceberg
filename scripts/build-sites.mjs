import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");

const staticFiles = ["index.html", ...["app.mjs", "styles.css"].map((file) => `src/${file}`)];
const moduleFiles = [
  "ai-provider.mjs",
  "ai-risk-layer.mjs",
  "advisor-engine.mjs",
  "conversation-agent.mjs",
  "gemini-risk-agent.mjs",
  "iceberg-agent.mjs",
  "market-data.mjs",
  "openai-risk-agent.mjs",
  "portfolio-advisor.mjs",
  "risk-engine.mjs",
  "strategy-catalog.mjs",
  "agent-skills/ai-risk-brief.mjs",
  "agent-skills/behavioral-friction.mjs",
  "agent-skills/final-response.mjs",
  "agent-skills/index.mjs",
  "agent-skills/intent-extraction.mjs",
  "agent-skills/market-research.mjs",
  "agent-skills/market-resolver.mjs",
  "agent-skills/portfolio-context.mjs",
  "agent-skills/pre-trade-risk-check.mjs",
  "agent-skills/risk-sizing.mjs",
  "agent-skills/trade-protection-strategy.mjs",
];

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "server"), { recursive: true });
await mkdir(join(dist, "src"), { recursive: true });

for (const file of moduleFiles) {
  await copyFile(`src/${file}`, `dist/src/${file}`);
}

await writeFile(join(dist, "server", "index.js"), await buildWorkerEntrypoint(), "utf8");
await writeFile(join(dist, "server", "static-assets.mjs"), await buildStaticAssetModule(), "utf8");

async function copyFile(source, target) {
  const targetPath = join(root, target);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, await readFile(join(root, source), "utf8"), "utf8");
}

async function buildStaticAssetModule() {
  const entries = {};

  for (const file of staticFiles) {
    const pathname = `/${file.replaceAll("\\", "/")}`;
    entries[pathname] = {
      contentType: mimeType(file),
      body: await readFile(join(root, file), "utf8"),
    };
  }

  entries["/"] = entries["/index.html"];

  return `export const staticAssets = ${JSON.stringify(entries, null, 2)};\n`;
}

async function buildWorkerEntrypoint() {
  const source = await readFile(join(root, "sites-worker.mjs"), "utf8");
  return source
    .replaceAll("from \"./src/", "from \"../src/")
    .replaceAll("from \"./server/static-assets.mjs\"", "from \"./static-assets.mjs\"");
}

function mimeType(pathname) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
  };
  return types[extname(pathname)] || "application/octet-stream";
}

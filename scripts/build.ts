import { rm } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const outdir = join(root, "build");

await rm(outdir, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [join(root, "src", "index.ts"), join(root, "src", "demo.ts")],
  minify: true,
  outdir,
  target: "bun",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await import("./copy-demo-assets");

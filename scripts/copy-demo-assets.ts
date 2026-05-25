import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const source = join(import.meta.dir, "..", "src", "demo", "index.html");
const destination = join(import.meta.dir, "..", "build", "demo", "index.html");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);

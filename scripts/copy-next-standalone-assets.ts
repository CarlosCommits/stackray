import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standaloneDirectory = join(root, ".next", "standalone");
const standaloneNextDirectory = join(standaloneDirectory, ".next");
const staticDirectory = join(root, ".next", "static");
const publicDirectory = join(root, "public");

await mkdir(standaloneNextDirectory, { recursive: true });

if (existsSync(staticDirectory)) {
  await cp(staticDirectory, join(standaloneNextDirectory, "static"), {
    recursive: true,
    force: true,
  });
}

if (existsSync(publicDirectory)) {
  await cp(publicDirectory, join(standaloneDirectory, "public"), {
    recursive: true,
    force: true,
  });
}

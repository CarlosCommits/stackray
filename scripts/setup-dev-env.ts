import { copyFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const target = resolve(process.cwd(), ".env.local");
  const example = resolve(process.cwd(), ".env.local.example");

  if (await exists(target)) {
    console.log(".env.local already exists; leaving it unchanged.");
    return;
  }

  await copyFile(example, target);
  console.log("Created .env.local from .env.local.example.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

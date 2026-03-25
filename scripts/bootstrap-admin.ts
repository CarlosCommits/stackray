import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";

import { authAccounts, users } from "../drizzle/schema.ts";

function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = join(process.cwd(), fileName);

    if (!existsSync(filePath)) {
      continue;
    }

    const contents = readFileSync(filePath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      if (!key || process.env[key] !== undefined) {
        continue;
      }

      let value = trimmed.slice(separatorIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set before running pnpm seed:admin");
}

const pool = new Pool({
  connectionString: databaseUrl,
});

const db = drizzle(pool);

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const email = getArgValue("--email");
  const password = getArgValue("--password");
  const displayName = getArgValue("--name") ?? "Admin User";

  if (!email || !password) {
    throw new Error("Usage: pnpm seed:admin --email admin@example.com --password 'StrongPassword123!' [--name 'Admin User']");
  }

  const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  const userId = existingUser[0]?.id ?? randomUUID();
  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    if (!existingUser[0]) {
      await tx.insert(users).values({
        id: userId,
        email: email.toLowerCase(),
        displayName,
        emailVerified: true,
        role: "admin",
      });
    }

    await tx
      .update(users)
      .set({
        displayName,
        emailVerified: true,
        role: "admin",
        passwordChangeRequiredAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    const existingCredentialAccount = await tx
      .select({ id: authAccounts.id })
      .from(authAccounts)
      .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "credential")))
      .limit(1);

    if (existingCredentialAccount[0]) {
      await tx
        .update(authAccounts)
        .set({
          password: passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(authAccounts.id, existingCredentialAccount[0].id));
    } else {
      await tx.insert(authAccounts).values({
        userId,
        providerId: "credential",
        accountId: userId,
        password: passwordHash,
      });
    }
  });

  console.log(`Bootstrapped admin ${email.toLowerCase()}. Sign in with email + password.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

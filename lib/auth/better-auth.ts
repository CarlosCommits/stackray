import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { authAccessControl, authRoles } from "@/lib/auth/permissions";
import {
  authAccounts,
  authSessions,
  authVerifications,
  users,
} from "@/lib/db/schema";
import { env } from "@/lib/env/server";
import { sendAuthEmail, canSendAuthEmail } from "@/lib/auth/mailer";

const betterAuthSecret = env.BETTER_AUTH_SECRET ?? (env.NODE_ENV === "production" ? null : "stackray-dev-better-auth-secret-change-me");
const betterAuthUrl = env.BETTER_AUTH_URL ?? (env.NODE_ENV === "production" ? null : "http://localhost:3000");

if (!betterAuthSecret) {
  throw new Error("BETTER_AUTH_SECRET must be configured.");
}

if (!betterAuthUrl) {
  throw new Error("BETTER_AUTH_URL must be configured.");
}

const emailEnabled = canSendAuthEmail();

export const auth = betterAuth({
  appName: "Stackray",
  baseURL: betterAuthUrl,
  secret: betterAuthSecret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
    },
  }),
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    database: {
      generateId: "uuid",
    },
  },
  user: {
    fields: {
      name: "displayName",
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    minPasswordLength: 12,
    maxPasswordLength: 256,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: emailEnabled
      ? async ({ user, url }) => {
          await sendAuthEmail({
            to: user.email,
            subject: "Reset your Stackray password",
            html: `<p>Reset your Stackray password by clicking the link below:</p><p><a href="${url}">${url}</a></p>`,
            text: `Reset your Stackray password: ${url}`,
          });
        }
      : undefined,
    onPasswordReset: async ({ user }) => {
      await db
        .update(users)
        .set({
          passwordChangeRequiredAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    },
  },
  emailVerification: emailEnabled
    ? {
        sendVerificationEmail: async ({ user, url }) => {
          await sendAuthEmail({
            to: user.email,
            subject: "Verify your Stackray email",
            html: `<p>Verify your email address for Stackray:</p><p><a href="${url}">${url}</a></p>`,
            text: `Verify your Stackray email: ${url}`,
          });
        },
      }
    : undefined,
  plugins: [
    admin({
      ac: authAccessControl,
      roles: authRoles,
      defaultRole: "user",
      adminRoles: ["admin"],
      schema: {
        user: {
          fields: {
            role: "role",
            banned: "banned",
            banReason: "banReason",
            banExpires: "banExpires",
          },
        },
        session: {
          fields: {
            impersonatedBy: "impersonatedBy",
          },
        },
      },
    }),
    nextCookies(),
  ],
});

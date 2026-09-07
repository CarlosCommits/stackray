import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
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
import { sendAuthEmail } from "@/lib/auth/mailer";
import { buildAuthEmail } from "@/lib/server/email/templates/auth-email";
import { getConfiguredPublicOrigin, getPublicOriginAllowedHosts } from "@/lib/public-origin";

const betterAuthSecret = env.BETTER_AUTH_SECRET ?? (env.NODE_ENV === "production" ? null : "stackray-dev-better-auth-secret-change-me");
const betterAuthUrl = getConfiguredPublicOrigin();

if (!betterAuthSecret) {
  throw new Error("BETTER_AUTH_SECRET must be configured.");
}

export const auth = betterAuth({
  appName: "Stackray",
  baseURL: {
    allowedHosts: getPublicOriginAllowedHosts(),
    protocol: env.NODE_ENV === "development" ? "http" : "auto",
    ...(betterAuthUrl ? { fallback: betterAuthUrl } : {}),
  },
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
    sendResetPassword: async ({ user, url }) => {
      const email = buildAuthEmail("password-reset", url);
      await sendAuthEmail({
        to: user.email,
        ...email,
      });
    },
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
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const email = buildAuthEmail("email-verification", url);
      await sendAuthEmail({
        to: user.email,
        ...email,
      });
    },
  },
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

"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

import { authAccessControl, authRoles } from "@/lib/auth/permissions";

export const authClient = createAuthClient({
  plugins: [
    adminClient({
      ac: authAccessControl,
      roles: authRoles,
    }),
  ],
});

export const {
  signIn,
  requestPasswordReset,
  resetPassword,
} = authClient;

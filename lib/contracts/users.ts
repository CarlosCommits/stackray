import { z } from "zod";

const userRoleSchema = z.enum(["admin", "user", "viewer"]);

const passwordDeliveryModeSchema = z.enum(["email", "temp-password"]);

export const createUserRequestSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1),
  role: userRoleSchema,
  apiKeyAccessEnabled: z.boolean().default(true),
  deliveryMode: passwordDeliveryModeSchema,
});

export const updateUserRequestSchema = z
  .object({
    email: z.string().trim().email().optional(),
    displayName: z.string().trim().min(1).optional(),
    role: userRoleSchema.optional(),
    apiKeyAccessEnabled: z.boolean().optional(),
  })
  .refine((value) => value.email !== undefined || value.displayName !== undefined || value.role !== undefined || value.apiKeyAccessEnabled !== undefined, {
    message: "At least one user field must be updated.",
  });

export const resetUserPasswordRequestSchema = z.object({
  deliveryMode: passwordDeliveryModeSchema,
});

const appUserSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: userRoleSchema,
  isActive: z.boolean(),
  requiresPasswordChange: z.boolean(),
  hasPassword: z.boolean(),
  lastLoginAt: z.string().datetime().nullable(),
  apiKeyAccessEnabled: z.boolean(),
});

export const listUsersResponseSchema = z.object({
  items: z.array(appUserSchema),
});

export const createUserResponseSchema = z.object({
  user: appUserSchema,
  temporaryPassword: z.string().nullable(),
});

export const resetUserPasswordResponseSchema = z.object({
  temporaryPassword: z.string().nullable(),
  deliveredByEmail: z.boolean(),
});

export type AppUser = z.infer<typeof appUserSchema>;

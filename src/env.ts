import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  EMAIL_SERVER_HOST: z.string().optional(),
  EMAIL_SERVER_PORT: z.coerce.number().int().default(587),
  EMAIL_SERVER_USER: z.string().optional(),
  EMAIL_SERVER_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  OTP_EXP_MINUTES: z.coerce.number().int().positive().default(10),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
  EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT ?? "587",
  EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
  EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM,
  OTP_EXP_MINUTES: process.env.OTP_EXP_MINUTES ?? "10",
});

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment configuration. Check your .env file.");
}

export const env = parsed.data;
export const emailTransportConfigured = Boolean(
  env.EMAIL_SERVER_HOST &&
  env.EMAIL_SERVER_USER &&
  env.EMAIL_SERVER_PASSWORD &&
  env.EMAIL_FROM,
);

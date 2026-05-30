import "server-only";

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE_NAME = "tvb_admin_session";

const DEFAULT_ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;

type AdminSessionPayload = {
  role: "admin";
  exp: number;
};

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "";
}

function getAdminSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() || "";
}

function getNowEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}

function toBase64UrlJson(value: object): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function parseBase64UrlJson(value: string): AdminSessionPayload | null {
  try {
    const raw = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(raw);

    if (
      parsed &&
      parsed.role === "admin" &&
      typeof parsed.exp === "number" &&
      Number.isFinite(parsed.exp)
    ) {
      return parsed as AdminSessionPayload;
    }

    return null;
  } catch {
    return null;
  }
}

function signPayload(payloadBase64: string): string {
  const secret = getAdminSessionSecret();

  if (!secret) {
    return "";
  }

  return createHmac("sha256", secret).update(payloadBase64).digest("base64url");
}

function safeTokenPartEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

export function isAdminPasswordConfigured(): boolean {
  return Boolean(getAdminPassword());
}

export function isAdminSessionSecretConfigured(): boolean {
  return Boolean(getAdminSessionSecret());
}

export function verifyAdminPassword(inputPassword: string): boolean {
  const configuredPassword = getAdminPassword();

  if (!configuredPassword || !inputPassword) {
    return false;
  }

  return safeTokenPartEquals(configuredPassword, inputPassword);
}

export function getAdminSessionTtlSeconds(): number {
  const value = Number(process.env.ADMIN_SESSION_TTL_SECONDS);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_ADMIN_SESSION_TTL_SECONDS;
  }

  return Math.floor(value);
}

export function createAdminSessionToken(): string {
  const exp = getNowEpochSeconds() + getAdminSessionTtlSeconds();
  const payloadBase64 = toBase64UrlJson({ role: "admin", exp });
  const signature = signPayload(payloadBase64);

  if (!signature) {
    throw new Error("Admin session secret is not configured");
  }

  return `${payloadBase64}.${signature}`;
}

export function verifyAdminSessionToken(
  token: string | null | undefined,
): boolean {
  if (!token) {
    return false;
  }

  const [payloadBase64, signature, ...rest] = token.split(".");

  if (!payloadBase64 || !signature || rest.length > 0) {
    return false;
  }

  const expectedSignature = signPayload(payloadBase64);

  if (
    !expectedSignature ||
    !safeTokenPartEquals(signature, expectedSignature)
  ) {
    return false;
  }

  const payload = parseBase64UrlJson(payloadBase64);

  if (!payload) {
    return false;
  }

  return payload.exp > getNowEpochSeconds();
}

export function getAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getAdminSessionTtlSeconds(),
  };
}

export async function isAdminSessionActive(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}

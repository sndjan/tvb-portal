import { cookies } from "next/headers";
import { z } from "zod";

import {
  ADMIN_SESSION_COOKIE_NAME,
  createAdminSessionToken,
  getAdminSessionCookieOptions,
  isAdminPasswordConfigured,
  isAdminSessionSecretConfigured,
  verifyAdminPassword,
} from "@/lib/backend/admin-session";
import { HttpError, toRouteErrorResponse } from "@/lib/backend/errors";
import { readJsonBody } from "@/lib/backend/route-helpers";

export const runtime = "nodejs";

const loginSchema = z.object({
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    if (!isAdminPasswordConfigured()) {
      throw new HttpError(
        500,
        "ADMIN_PASSWORD ist nicht konfiguriert",
        "admin_password_not_configured",
      );
    }

    if (!isAdminSessionSecretConfigured()) {
      throw new HttpError(
        500,
        "ADMIN_SESSION_SECRET oder SUPABASE_PRIVATE_KEY fehlt",
        "admin_session_secret_not_configured",
      );
    }

    const body = await readJsonBody(request);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      throw new HttpError(
        400,
        "Ungueltige Eingabedaten",
        "validation_error",
        parsed.error.flatten(),
      );
    }

    if (!verifyAdminPassword(parsed.data.password)) {
      throw new HttpError(401, "Falsches Passwort", "unauthorized");
    }

    const cookieStore = await cookies();

    cookieStore.set({
      name: ADMIN_SESSION_COOKIE_NAME,
      value: createAdminSessionToken(),
      ...getAdminSessionCookieOptions(),
    });

    return Response.json({ ok: true });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

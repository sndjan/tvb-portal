import { cookies } from "next/headers";

import {
  ADMIN_SESSION_COOKIE_NAME,
  getAdminSessionCookieOptions,
} from "@/lib/backend/admin-session";
import { toRouteErrorResponse } from "@/lib/backend/errors";

export const runtime = "nodejs";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.set({
      name: ADMIN_SESSION_COOKIE_NAME,
      value: "",
      ...getAdminSessionCookieOptions(),
      maxAge: 0,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

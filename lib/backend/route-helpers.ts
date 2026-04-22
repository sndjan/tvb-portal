import "server-only";

import type { NextRequest } from "next/server";

import {
  ADMIN_SESSION_COOKIE_NAME,
  verifyAdminSessionToken,
} from "@/lib/backend/admin-session";
import { HttpError } from "@/lib/backend/errors";

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(
      400,
      "Request Body ist kein gueltiges JSON",
      "invalid_json",
    );
  }
}

export function isAdminRequest(request: NextRequest): boolean {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}

export function requireAdminRequest(request: NextRequest): void {
  if (!isAdminRequest(request)) {
    throw new HttpError(401, "Nicht autorisiert", "unauthorized");
  }
}

export function requireNonEmptyTaskId(taskId: string): string {
  const trimmed = taskId.trim();

  if (!trimmed) {
    throw new HttpError(400, "Task-ID fehlt", "validation_error");
  }

  return trimmed;
}

import type { NextRequest } from "next/server";

import { HttpError, toRouteErrorResponse } from "@/lib/backend/errors";
import { readJsonBody } from "@/lib/backend/route-helpers";
import {
  parseToggleEmailRecipientInput,
  toggleEmailRecipient,
} from "@/lib/backend/tasks-service";

export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

const requestLog = new Map<string, number[]>();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

function enforceRateLimit(ip: string): void {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const history = requestLog.get(ip) ?? [];
  const recent = history.filter((timestamp) => timestamp > cutoff);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    throw new HttpError(
      429,
      "Zu viele Anfragen. Bitte später erneut versuchen.",
      "rate_limited",
    );
  }

  recent.push(now);
  requestLog.set(ip, recent);

  if (requestLog.size > 5000) {
    for (const [key, timestamps] of requestLog) {
      const stillRecent = timestamps.filter((t) => t > cutoff);
      if (stillRecent.length === 0) {
        requestLog.delete(key);
      } else {
        requestLog.set(key, stillRecent);
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(getClientIp(request));

    const body = await readJsonBody(request);
    const input = parseToggleEmailRecipientInput(body);
    const result = await toggleEmailRecipient(input);

    return Response.json(result);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

import type { NextRequest } from "next/server";

import { toRouteErrorResponse } from "@/lib/backend/errors";
import { isAdminRequest } from "@/lib/backend/route-helpers";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    return Response.json({
      isAdmin: isAdminRequest(request),
    });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

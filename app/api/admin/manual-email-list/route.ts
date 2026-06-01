import type { NextRequest } from "next/server";

import { toRouteErrorResponse } from "@/lib/backend/errors";
import { readJsonBody, requireAdminRequest } from "@/lib/backend/route-helpers";
import {
  addManualEmailRecipient,
  listEmailRecipients,
  parseAddManualEmailRecipientInput,
  parseRemoveEmailRecipientInput,
  removeEmailRecipient,
} from "@/lib/backend/tasks-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    requireAdminRequest(request);
    const recipients = await listEmailRecipients();
    return Response.json({ recipients });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdminRequest(request);
    const body = await readJsonBody(request);
    const input = parseAddManualEmailRecipientInput(body);
    const recipient = await addManualEmailRecipient(input);
    return Response.json({ recipient }, { status: 201 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireAdminRequest(request);
    const body = await readJsonBody(request);
    const input = parseRemoveEmailRecipientInput(body);
    await removeEmailRecipient(input);
    return Response.json({ ok: true });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

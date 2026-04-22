import type { NextRequest } from "next/server";

import { toRouteErrorResponse } from "@/lib/backend/errors";
import { requireAdminRequest, readJsonBody } from "@/lib/backend/route-helpers";
import {
  addEmailRecipient,
  listEmailRecipients,
  parseAddEmailRecipientInput,
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
    const input = parseAddEmailRecipientInput(body);
    const recipient = await addEmailRecipient(input);

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

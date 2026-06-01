import type { NextRequest } from "next/server";

import { toRouteErrorResponse } from "@/lib/backend/errors";
import {
  isAdminRequest,
  readJsonBody,
  requireNonEmptyTaskId,
} from "@/lib/backend/route-helpers";
import {
  addTaskParticipant,
  hasTaskParticipant,
  listTaskParticipants,
  parseAddParticipantInput,
  parseRemoveParticipantInput,
  removeTaskParticipant,
} from "@/lib/backend/tasks-service";

export const runtime = "nodejs";

type TaskParticipantsRouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: TaskParticipantsRouteContext,
) {
  try {
    const { taskId } = await context.params;
    const id = requireNonEmptyTaskId(taskId);
    const isAdmin = isAdminRequest(request);
    const snapshot = await listTaskParticipants(id, isAdmin);

    if (!isAdmin) {
      const firstName = request.nextUrl.searchParams.get("firstName")?.trim();
      const lastName = request.nextUrl.searchParams.get("lastName")?.trim();

      if (firstName && lastName) {
        const isRegistered = await hasTaskParticipant(id, {
          firstName,
          lastName,
        });

        return Response.json({
          count: snapshot.count,
          isRegistered,
          isAdmin,
        });
      }
    }

    return Response.json({
      count: snapshot.count,
      participants: snapshot.participants,
      isAdmin,
    });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: TaskParticipantsRouteContext,
) {
  try {
    const { taskId } = await context.params;
    const id = requireNonEmptyTaskId(taskId);
    const isAdmin = isAdminRequest(request);
    const body = await readJsonBody(request);
    const input = parseAddParticipantInput(body);
    const participant = await addTaskParticipant(id, input, {
      bypassLimit: isAdmin,
    });

    return Response.json({ participant }, { status: 201 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: TaskParticipantsRouteContext,
) {
  try {
    const { taskId } = await context.params;
    const id = requireNonEmptyTaskId(taskId);
    const body = await readJsonBody(request);
    const input = parseRemoveParticipantInput(body);
    await removeTaskParticipant(id, input);

    return Response.json({ ok: true });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

import type { NextRequest } from "next/server";

import { toRouteErrorResponse } from "@/lib/backend/errors";
import { isAdminRequest, requireNonEmptyTaskId } from "@/lib/backend/route-helpers";
import { listTaskParticipantHistory } from "@/lib/backend/tasks-service";

export const runtime = "nodejs";

type TaskHistoryRouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: TaskHistoryRouteContext,
) {
  try {
    if (!isAdminRequest(request)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { taskId } = await context.params;
    const id = requireNonEmptyTaskId(taskId);
    const history = await listTaskParticipantHistory(id);

    return Response.json({ history });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

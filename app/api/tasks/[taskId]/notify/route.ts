import type { NextRequest } from "next/server";

import { HttpError, toRouteErrorResponse } from "@/lib/backend/errors";
import {
  readJsonBody,
  requireAdminRequest,
  requireNonEmptyTaskId,
} from "@/lib/backend/route-helpers";
import {
  getTaskById,
  notifyTaskCreated,
  parseNotifyTaskInput,
} from "@/lib/backend/tasks-service";

export const runtime = "nodejs";

type NotifyRouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function POST(request: NextRequest, context: NotifyRouteContext) {
  try {
    requireAdminRequest(request);

    const { taskId } = await context.params;
    const id = requireNonEmptyTaskId(taskId);
    const task = await getTaskById(id, false);

    if (!task) {
      throw new HttpError(404, "Task nicht gefunden", "task_not_found");
    }

    let body: unknown = {};
    try {
      body = await readJsonBody(request);
    } catch {
      body = {};
    }
    const { mailListVariant } = parseNotifyTaskInput(body);

    const notification = await notifyTaskCreated(task, mailListVariant);

    return Response.json({ notification });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

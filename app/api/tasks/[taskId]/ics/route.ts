import type { NextRequest } from "next/server";

import { HttpError, toRouteErrorResponse } from "@/lib/backend/errors";
import {
  isAdminRequest,
  requireNonEmptyTaskId,
} from "@/lib/backend/route-helpers";
import { buildTaskIcs, getTaskById } from "@/lib/backend/tasks-service";

export const runtime = "nodejs";

type TaskIcsRouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

function toSafeFileName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "arbeitseinsatz"
  );
}

export async function GET(request: NextRequest, context: TaskIcsRouteContext) {
  try {
    const { taskId } = await context.params;
    const id = requireNonEmptyTaskId(taskId);
    const isAdmin = isAdminRequest(request);
    const task = await getTaskById(id, false);

    if (!task || (!isAdmin && task.isHidden)) {
      throw new HttpError(404, "Task nicht gefunden", "task_not_found");
    }

    const ics = buildTaskIcs(task);
    const fileName = `${toSafeFileName(task.title)}.ics`;

    return new Response(ics, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename=\"${fileName}\"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

import type { NextRequest } from "next/server";

import { toRouteErrorResponse } from "@/lib/backend/errors";
import {
  isAdminRequest,
  readJsonBody,
  requireAdminRequest,
} from "@/lib/backend/route-helpers";
import {
  createTask,
  listTasks,
  notifyTaskCreated,
  parseCreateTaskInput,
} from "@/lib/backend/tasks-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const isAdmin = isAdminRequest(request);
    const tasks = await listTasks({
      includeHidden: isAdmin,
      includeParticipantNames: isAdmin,
    });

    return Response.json({
      tasks,
      isAdmin,
    });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdminRequest(request);

    const body = await readJsonBody(request);
    const input = parseCreateTaskInput(body);
    const task = await createTask(input);

    let notification = null;

    if (input.sendEmail) {
      notification = await notifyTaskCreated(task);
    }

    return Response.json(
      {
        task,
        notification,
      },
      { status: 201 },
    );
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

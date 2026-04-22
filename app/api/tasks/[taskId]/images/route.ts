import type { NextRequest } from "next/server";

import { HttpError, toRouteErrorResponse } from "@/lib/backend/errors";
import {
  isAdminRequest,
  requireAdminRequest,
  requireNonEmptyTaskId,
} from "@/lib/backend/route-helpers";
import {
  getTaskById,
  listTaskImages,
  uploadTaskImages,
} from "@/lib/backend/tasks-service";

export const runtime = "nodejs";

type TaskImagesRouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

function extractFilesFromFormData(formData: FormData): File[] {
  const entries = [...formData.getAll("files"), ...formData.getAll("file")];
  return entries.filter((entry): entry is File => entry instanceof File);
}

export async function GET(
  request: NextRequest,
  context: TaskImagesRouteContext,
) {
  try {
    const { taskId } = await context.params;
    const id = requireNonEmptyTaskId(taskId);
    const isAdmin = isAdminRequest(request);
    const task = await getTaskById(id, false);

    if (!task || (!isAdmin && task.isHidden)) {
      throw new HttpError(404, "Task nicht gefunden", "task_not_found");
    }

    const images = await listTaskImages(id);

    return Response.json({ images });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: TaskImagesRouteContext,
) {
  try {
    requireAdminRequest(request);

    const { taskId } = await context.params;
    const id = requireNonEmptyTaskId(taskId);
    const formData = await request.formData();
    const files = extractFilesFromFormData(formData);

    if (!files.length) {
      throw new HttpError(
        400,
        "Es wurden keine Dateien uebergeben. Erwartet wird files[] oder file",
        "validation_error",
      );
    }

    const images = await uploadTaskImages(id, files);
    return Response.json({ images }, { status: 201 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

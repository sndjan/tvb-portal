import type { NextRequest } from "next/server";

import { toRouteErrorResponse } from "@/lib/backend/errors";
import { requireAdminRequest } from "@/lib/backend/route-helpers";
import { deleteTaskImage } from "@/lib/backend/tasks-service";

export const runtime = "nodejs";

type TaskImageDeleteRouteContext = {
  params: Promise<{
    taskId: string;
    imageId: string;
  }>;
};

export async function DELETE(
  request: NextRequest,
  context: TaskImageDeleteRouteContext,
) {
  try {
    requireAdminRequest(request);

    const { taskId, imageId } = await context.params;

    await deleteTaskImage(taskId.trim(), imageId.trim());
    return Response.json({ ok: true });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

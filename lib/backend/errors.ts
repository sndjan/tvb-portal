import "server-only";

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(
    status: number,
    message: string,
    code = "http_error",
    details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function toRouteErrorResponse(error: unknown): Response {
  if (isHttpError(error)) {
    const body = {
      error: error.message,
      code: error.code,
      details: error.details,
    };

    return Response.json(body, {
      status: error.status,
    });
  }

  if (error instanceof Error) {
    console.error("Unhandled route error", error);
  }

  return Response.json(
    {
      error: "Interner Serverfehler",
      code: "internal_error",
    },
    { status: 500 },
  );
}

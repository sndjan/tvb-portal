export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : {
            "content-type": "application/json",
            ...(init?.headers || {}),
          },
    cache: "no-store",
  });

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: unknown }).error || "")
        : "Request fehlgeschlagen";
    throw new Error(
      errorMessage || `Request fehlgeschlagen (${response.status})`,
    );
  }

  return payload as T;
}
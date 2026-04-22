import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { HttpError } from "@/lib/backend/errors";

let cachedServiceClient: SupabaseClient | null | undefined;

function createServiceClient(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_PRIVATE_KEY?.trim();

  if (!supabaseUrl || !serviceKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseServiceClientOrNull(): SupabaseClient | null {
  if (cachedServiceClient !== undefined) {
    return cachedServiceClient;
  }

  cachedServiceClient = createServiceClient();
  return cachedServiceClient;
}

export function getSupabaseServiceClientOrThrow(): SupabaseClient {
  const client = getSupabaseServiceClientOrNull();

  if (!client) {
    throw new HttpError(
      500,
      "Supabase ist nicht korrekt konfiguriert",
      "supabase_not_configured",
    );
  }

  return client;
}

export function getTaskImagesBucketName(): string {
  return process.env.SUPABASE_TASK_IMAGES_BUCKET?.trim() || "task-images";
}

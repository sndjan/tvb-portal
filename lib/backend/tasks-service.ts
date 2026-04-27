import "server-only";

import { randomUUID } from "node:crypto";

import { Resend } from "resend";
import { z } from "zod";

import { HttpError } from "@/lib/backend/errors";
import {
  getSupabaseServiceClientOrThrow,
  getTaskImagesBucketName,
} from "@/lib/backend/supabase";
import { formatDateTime } from "../utils";

export type TaskStatus = "open" | "done";

export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  durationEstimate: string | null;
  maxParticipants: number | null;
  status: TaskStatus;
  isHidden: boolean;
  createdAt: string;
};

export type ParticipantRecord = {
  id: string;
  taskId: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

export type ImageRecord = {
  id: string;
  taskId: string;
  url: string;
  createdAt: string;
};

export type TaskWithDetails = TaskRecord & {
  participantCount: number;
  participants: ParticipantRecord[] | null;
  images: ImageRecord[];
};

export type ListTasksOptions = {
  includeHidden: boolean;
  includeParticipantNames: boolean;
};

export type TaskNotificationResult = {
  attempted: boolean;
  sent: boolean;
  recipientCount: number;
  message: string;
};

type TaskRow = {
  id: string | number;
  title: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_estimate: string | number | null;
  max_participants: number | null;
  status: string | null;
  is_hidden: boolean | null;
  created_at: string | null;
};

type ParticipantRow = {
  id: string | number;
  task_id: string | number;
  first_name: string | null;
  last_name: string | null;
  created_at: string | null;
};

type ParticipantCountRow = {
  task_id: string | number;
};

type ImageRow = {
  id: string | number;
  task_id: string | number;
  url: string | null;
  created_at: string | null;
};

const TASK_SELECT_COLUMNS =
  "id, title, description, start_date, end_date, duration_estimate, max_participants, status, is_hidden, created_at";

const optionalMaxParticipantsSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value;
}, z.number().int().min(1).max(200).nullable());

const optionalBooleanSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();

    if (lowered === "true" || lowered === "1") {
      return true;
    }

    if (lowered === "false" || lowered === "0") {
      return false;
    }
  }

  return value;
}, z.boolean());

const createTaskBodySchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4000),
  startDate: z.string().trim().max(80).nullable().optional(),
  endDate: z.string().trim().max(80).nullable().optional(),
  durationEstimate: z.string().trim().max(120).nullable().optional(),
  maxParticipants: optionalMaxParticipantsSchema.optional(),
  status: z.enum(["open", "done"]).optional(),
  isHidden: optionalBooleanSchema.optional(),
  sendEmail: optionalBooleanSchema.optional(),
});

const updateTaskBodySchema = createTaskBodySchema
  .omit({ sendEmail: true })
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Mindestens ein Feld muss aktualisiert werden",
  });

const addParticipantBodySchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
});

const removeParticipantBodySchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
});

const addEmailRecipientBodySchema = z.object({
  email: z.string().trim().email().max(320),
});

const removeEmailRecipientBodySchema = z.object({
  id: z.union([z.string(), z.number()]),
});

export type CreateTaskInput = {
  title: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  durationEstimate: string | null;
  maxParticipants: number | null;
  status: TaskStatus;
  isHidden: boolean;
  sendEmail: boolean;
};

export type UpdateTaskInput = Partial<
  Omit<CreateTaskInput, "sendEmail" | "status"> & { status: TaskStatus }
>;

export type AddParticipantInput = {
  firstName: string;
  lastName: string;
};

export type RemoveParticipantInput = {
  firstName: string;
  lastName: string;
};

export type AddEmailRecipientInput = {
  email: string;
};

export type RemoveEmailRecipientInput = {
  id: string;
};

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalDate(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null || value.trim() === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    throw new HttpError(
      400,
      `${fieldName} hat kein gueltiges Datum`,
      "validation_error",
    );
  }

  return date.toISOString();
}

function validateStartAndEndDate(
  startDate: string | null,
  endDate: string | null,
) {
  if (!startDate || !endDate) {
    return;
  }

  if (Date.parse(startDate) > Date.parse(endDate)) {
    throw new HttpError(
      400,
      "Enddatum muss nach dem Startdatum liegen",
      "validation_error",
    );
  }
}

function toValidationError(error: z.ZodError): HttpError {
  return new HttpError(
    400,
    "Ungueltige Eingabedaten",
    "validation_error",
    error.flatten(),
  );
}

export function parseCreateTaskInput(input: unknown): CreateTaskInput {
  const parsed = createTaskBodySchema.safeParse(input);

  if (!parsed.success) {
    throw toValidationError(parsed.error);
  }

  const payload = parsed.data;

  const startDate = normalizeOptionalDate(payload.startDate, "Startdatum");
  const endDate = normalizeOptionalDate(payload.endDate, "Enddatum");
  validateStartAndEndDate(startDate, endDate);

  return {
    title: normalizeWhitespace(payload.title),
    description: normalizeWhitespace(payload.description),
    startDate,
    endDate,
    durationEstimate: normalizeOptionalText(payload.durationEstimate),
    maxParticipants: payload.maxParticipants ?? null,
    status: payload.status ?? "open",
    isHidden: payload.isHidden ?? false,
    sendEmail: payload.sendEmail ?? false,
  };
}

export function parseUpdateTaskInput(input: unknown): UpdateTaskInput {
  const parsed = updateTaskBodySchema.safeParse(input);

  if (!parsed.success) {
    throw toValidationError(parsed.error);
  }

  const payload = parsed.data;
  const normalized: UpdateTaskInput = {};

  if (Object.prototype.hasOwnProperty.call(payload, "title")) {
    if (!payload.title) {
      throw new HttpError(
        400,
        "Titel darf nicht leer sein",
        "validation_error",
      );
    }

    normalized.title = normalizeWhitespace(payload.title);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "description")) {
    if (!payload.description) {
      throw new HttpError(
        400,
        "Beschreibung darf nicht leer sein",
        "validation_error",
      );
    }

    normalized.description = normalizeWhitespace(payload.description);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "startDate")) {
    normalized.startDate = normalizeOptionalDate(
      payload.startDate,
      "Startdatum",
    );
  }

  if (Object.prototype.hasOwnProperty.call(payload, "endDate")) {
    normalized.endDate = normalizeOptionalDate(payload.endDate, "Enddatum");
  }

  if (normalized.startDate !== undefined || normalized.endDate !== undefined) {
    const nextStart = normalized.startDate ?? null;
    const nextEnd = normalized.endDate ?? null;
    validateStartAndEndDate(nextStart, nextEnd);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "durationEstimate")) {
    normalized.durationEstimate = normalizeOptionalText(
      payload.durationEstimate,
    );
  }

  if (Object.prototype.hasOwnProperty.call(payload, "maxParticipants")) {
    normalized.maxParticipants = payload.maxParticipants ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    normalized.status = payload.status;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "isHidden")) {
    normalized.isHidden = payload.isHidden;
  }

  if (Object.keys(normalized).length === 0) {
    throw new HttpError(
      400,
      "Mindestens ein Feld muss aktualisiert werden",
      "validation_error",
    );
  }

  return normalized;
}

export function parseAddParticipantInput(input: unknown): AddParticipantInput {
  const parsed = addParticipantBodySchema.safeParse(input);

  if (!parsed.success) {
    throw toValidationError(parsed.error);
  }

  return {
    firstName: normalizeWhitespace(parsed.data.firstName),
    lastName: normalizeWhitespace(parsed.data.lastName),
  };
}

export function parseRemoveParticipantInput(
  input: unknown,
): RemoveParticipantInput {
  const parsed = removeParticipantBodySchema.safeParse(input);

  if (!parsed.success) {
    throw toValidationError(parsed.error);
  }

  return {
    firstName: normalizeWhitespace(parsed.data.firstName),
    lastName: normalizeWhitespace(parsed.data.lastName),
  };
}

export function parseAddEmailRecipientInput(
  input: unknown,
): AddEmailRecipientInput {
  const parsed = addEmailRecipientBodySchema.safeParse(input);

  if (!parsed.success) {
    throw toValidationError(parsed.error);
  }

  return {
    email: parsed.data.email.toLowerCase(),
  };
}

export function parseRemoveEmailRecipientInput(
  input: unknown,
): RemoveEmailRecipientInput {
  const parsed = removeEmailRecipientBodySchema.safeParse(input);

  if (!parsed.success) {
    throw toValidationError(parsed.error);
  }

  return {
    id: String(parsed.data.id),
  };
}

function mapTaskRow(row: TaskRow): TaskRecord {
  return {
    id: String(row.id),
    title: row.title?.trim() || "Unbenannter Einsatz",
    description: row.description?.trim() || "Keine Beschreibung vorhanden.",
    startDate: row.start_date,
    endDate: row.end_date,
    durationEstimate:
      typeof row.duration_estimate === "number"
        ? `${row.duration_estimate} Stunden`
        : row.duration_estimate,
    maxParticipants: row.max_participants,
    status: row.status === "done" ? "done" : "open",
    isHidden: Boolean(row.is_hidden),
    createdAt: row.created_at || new Date(0).toISOString(),
  };
}

function mapParticipantRow(row: ParticipantRow): ParticipantRecord {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    firstName: row.first_name?.trim() || "Unbekannt",
    lastName: row.last_name?.trim() || "Unbekannt",
    createdAt: row.created_at || new Date(0).toISOString(),
  };
}

function mapImageRow(row: ImageRow): ImageRecord {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    url: row.url || "",
    createdAt: row.created_at || new Date(0).toISOString(),
  };
}

function groupParticipantsByTask(
  rows: ParticipantRow[],
): Map<string, ParticipantRecord[]> {
  const grouped = new Map<string, ParticipantRecord[]>();

  for (const row of rows) {
    const mapped = mapParticipantRow(row);
    const current = grouped.get(mapped.taskId) || [];
    current.push(mapped);
    grouped.set(mapped.taskId, current);
  }

  return grouped;
}

function groupImagesByTask(rows: ImageRow[]): Map<string, ImageRecord[]> {
  const grouped = new Map<string, ImageRecord[]>();

  for (const row of rows) {
    const mapped = mapImageRow(row);

    if (!mapped.url) {
      continue;
    }

    const current = grouped.get(mapped.taskId) || [];
    current.push(mapped);
    grouped.set(mapped.taskId, current);
  }

  return grouped;
}

function groupParticipantCountsByTask(
  rows: ParticipantCountRow[],
): Map<string, number> {
  const grouped = new Map<string, number>();

  for (const row of rows) {
    const taskId = String(row.task_id);
    grouped.set(taskId, (grouped.get(taskId) || 0) + 1);
  }

  return grouped;
}

async function ensureTaskExists(taskId: string): Promise<void> {
  const supabase = getSupabaseServiceClientOrThrow();
  const { data, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .limit(1);

  if (error) {
    throw new HttpError(
      500,
      "Task konnte nicht gelesen werden",
      "tasks_fetch_failed",
    );
  }

  if (!data || data.length === 0) {
    throw new HttpError(404, "Task nicht gefunden", "task_not_found");
  }
}

export async function listTasks(
  options: ListTasksOptions,
): Promise<TaskWithDetails[]> {
  const supabase = getSupabaseServiceClientOrThrow();

  let taskQuery = supabase
    .from("tasks")
    .select(TASK_SELECT_COLUMNS)
    .order("created_at", { ascending: true });

  if (!options.includeHidden) {
    taskQuery = taskQuery.eq("is_hidden", false);
  }

  const { data: taskRows, error: taskError } = await taskQuery;

  if (taskError) {
    throw new HttpError(
      500,
      "Tasks konnten nicht geladen werden",
      "tasks_fetch_failed",
    );
  }

  const tasks = (taskRows || []).map((row) => mapTaskRow(row as TaskRow));
  const taskIds = tasks.map((task) => task.id);

  if (taskIds.length === 0) {
    return [];
  }

  const { data: imageRows, error: imageError } = await supabase
    .from("images")
    .select("id, task_id, url, created_at")
    .in("task_id", taskIds)
    .order("created_at", { ascending: true });

  if (imageError) {
    throw new HttpError(
      500,
      "Bilder konnten nicht geladen werden",
      "images_fetch_failed",
    );
  }

  let participantMap = new Map<string, ParticipantRecord[]>();
  let participantCountMap = new Map<string, number>();

  if (options.includeParticipantNames) {
    const { data: participantRows, error: participantError } = await supabase
      .from("self_registered_participants")
      .select("id, task_id,first_name, last_name, created_at")
      .in("task_id", taskIds)
      .order("created_at", { ascending: true });

    if (participantError) {
      throw new HttpError(
        500,
        "Teilnehmer konnten nicht geladen werden",
        "participants_fetch_failed",
      );
    }

    participantMap = groupParticipantsByTask(
      (participantRows || []) as ParticipantRow[],
    );

    for (const [taskId, participants] of participantMap.entries()) {
      participantCountMap.set(taskId, participants.length);
    }
  } else {
    const { data: participantCountRows, error: participantCountError } =
      await supabase
        .from("self_registered_participants")
        .select("task_id")
        .in("task_id", taskIds);

    if (participantCountError) {
      throw new HttpError(
        500,
        "Teilnehmerzahlen konnten nicht geladen werden",
        "participants_fetch_failed",
      );
    }

    participantCountMap = groupParticipantCountsByTask(
      (participantCountRows || []) as ParticipantCountRow[],
    );
  }

  const imagesMap = groupImagesByTask((imageRows || []) as ImageRow[]);

  return tasks.map((task) => ({
    ...task,
    participantCount: participantCountMap.get(task.id) || 0,
    participants: options.includeParticipantNames
      ? participantMap.get(task.id) || []
      : null,
    images: imagesMap.get(task.id) || [],
  }));
}

export async function getTaskById(
  taskId: string,
  includeParticipantNames: boolean,
): Promise<TaskWithDetails | null> {
  const supabase = getSupabaseServiceClientOrThrow();
  const { data: taskRow, error: taskError } = await supabase
    .from("tasks")
    .select(TASK_SELECT_COLUMNS)
    .eq("id", taskId)
    .single();

  if (taskError) {
    if (taskError.code === "PGRST116") {
      return null;
    }

    throw new HttpError(
      500,
      "Task konnte nicht geladen werden",
      "task_fetch_failed",
    );
  }

  const task = mapTaskRow(taskRow as TaskRow);

  const { data: imageRows, error: imageError } = await supabase
    .from("images")
    .select("id, task_id, url, created_at")
    .eq("task_id", task.id)
    .order("created_at", { ascending: true });

  if (imageError) {
    throw new HttpError(
      500,
      "Bilder konnten nicht geladen werden",
      "images_fetch_failed",
    );
  }

  if (!includeParticipantNames) {
    const { count, error: countError } = await supabase
      .from("self_registered_participants")
      .select("id", { count: "exact", head: true })
      .eq("task_id", task.id);

    if (countError) {
      throw new HttpError(
        500,
        "Teilnehmerzahlen konnten nicht geladen werden",
        "participants_fetch_failed",
      );
    }

    return {
      ...task,
      participantCount: count || 0,
      participants: null,
      images: (imageRows || []).map((row) => mapImageRow(row as ImageRow)),
    };
  }

  const { data: participantRows, error: participantError } = await supabase
    .from("self_registered_participants")
    .select("id, task_id,first_name, last_name, created_at")
    .eq("task_id", task.id)
    .order("created_at", { ascending: true });

  if (participantError) {
    throw new HttpError(
      500,
      "Teilnehmer konnten nicht geladen werden",
      "participants_fetch_failed",
    );
  }

  const participants = (participantRows || []).map((row) =>
    mapParticipantRow(row as ParticipantRow),
  );

  return {
    ...task,
    participantCount: participants.length,
    participants,
    images: (imageRows || []).map((row) => mapImageRow(row as ImageRow)),
  };
}

export async function createTask(input: CreateTaskInput): Promise<TaskRecord> {
  const supabase = getSupabaseServiceClientOrThrow();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: input.title,
      description: input.description,
      start_date: input.startDate,
      end_date: input.endDate,
      duration_estimate: input.durationEstimate,
      max_participants: input.maxParticipants,
      status: input.status,
      is_hidden: input.isHidden,
    })
    .select(TASK_SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw new HttpError(
      500,
      "Task konnte nicht erstellt werden",
      "task_create_failed",
    );
  }

  return mapTaskRow(data as TaskRow);
}

export async function updateTask(
  taskId: string,
  input: UpdateTaskInput,
): Promise<TaskRecord> {
  const supabase = getSupabaseServiceClientOrThrow();

  const { data: existingTaskRow, error: existingTaskError } = await supabase
    .from("tasks")
    .select("id, start_date, end_date")
    .eq("id", taskId)
    .single();

  if (existingTaskError) {
    if (existingTaskError.code === "PGRST116") {
      throw new HttpError(404, "Task nicht gefunden", "task_not_found");
    }

    throw new HttpError(
      500,
      "Task konnte nicht geladen werden",
      "task_fetch_failed",
    );
  }

  const mergedStartDate = Object.prototype.hasOwnProperty.call(
    input,
    "startDate",
  )
    ? (input.startDate ?? null)
    : ((existingTaskRow as { start_date: string | null }).start_date ?? null);
  const mergedEndDate = Object.prototype.hasOwnProperty.call(input, "endDate")
    ? (input.endDate ?? null)
    : ((existingTaskRow as { end_date: string | null }).end_date ?? null);

  validateStartAndEndDate(mergedStartDate, mergedEndDate);

  const updatePayload: {
    title?: string;
    description?: string;
    start_date?: string | null;
    end_date?: string | null;
    duration_estimate?: string | null;
    max_participants?: number | null;
    status?: TaskStatus;
    is_hidden?: boolean;
  } = {};

  if (Object.prototype.hasOwnProperty.call(input, "title")) {
    updatePayload.title = input.title;
  }

  if (Object.prototype.hasOwnProperty.call(input, "description")) {
    updatePayload.description = input.description;
  }

  if (Object.prototype.hasOwnProperty.call(input, "startDate")) {
    updatePayload.start_date = input.startDate ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(input, "endDate")) {
    updatePayload.end_date = input.endDate ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(input, "durationEstimate")) {
    updatePayload.duration_estimate = input.durationEstimate ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(input, "maxParticipants")) {
    updatePayload.max_participants = input.maxParticipants ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(input, "status")) {
    updatePayload.status = input.status;
  }

  if (Object.prototype.hasOwnProperty.call(input, "isHidden")) {
    updatePayload.is_hidden = input.isHidden;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new HttpError(
      400,
      "Mindestens ein Feld muss aktualisiert werden",
      "validation_error",
    );
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", taskId)
    .select(TASK_SELECT_COLUMNS)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new HttpError(404, "Task nicht gefunden", "task_not_found");
    }

    throw new HttpError(
      500,
      "Task konnte nicht aktualisiert werden",
      "task_update_failed",
    );
  }

  return mapTaskRow(data as TaskRow);
}

export async function deleteTask(taskId: string): Promise<void> {
  const supabase = getSupabaseServiceClientOrThrow();

  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .select("id")
    .limit(1);

  if (error) {
    throw new HttpError(
      500,
      "Task konnte nicht gelöscht werden",
      "task_delete_failed",
    );
  }

  if (!data || data.length === 0) {
    throw new HttpError(404, "Task nicht gefunden", "task_not_found");
  }
}

export async function listTaskParticipants(
  taskId: string,
  includeNames: boolean,
): Promise<{ count: number; participants: ParticipantRecord[] | null }> {
  await ensureTaskExists(taskId);

  const supabase = getSupabaseServiceClientOrThrow();

  if (!includeNames) {
    const { count, error } = await supabase
      .from("self_registered_participants")
      .select("id", { count: "exact", head: true })
      .eq("task_id", taskId);

    if (error) {
      throw new HttpError(
        500,
        "Teilnehmer konnten nicht geladen werden",
        "participants_fetch_failed",
      );
    }

    return {
      count: count || 0,
      participants: null,
    };
  }

  const { data, error } = await supabase
    .from("self_registered_participants")
    .select("id, task_id,first_name, last_name, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new HttpError(
      500,
      "Teilnehmer konnten nicht geladen werden",
      "participants_fetch_failed",
    );
  }

  const participants = (data || []).map((row) =>
    mapParticipantRow(row as ParticipantRow),
  );

  return {
    count: participants.length,
    participants,
  };
}

export async function addTaskParticipant(
  taskId: string,
  input: AddParticipantInput,
): Promise<ParticipantRecord> {
  const task = await getTaskById(taskId, false);

  if (!task) {
    throw new HttpError(404, "Task nicht gefunden", "task_not_found");
  }

  if (
    task.maxParticipants !== null &&
    task.participantCount >= task.maxParticipants
  ) {
    throw new HttpError(
      409,
      "Die maximale Teilnehmerzahl ist bereits erreicht",
      "participant_limit_reached",
    );
  }

  const supabase = getSupabaseServiceClientOrThrow();
  const normalizedFirstName = normalizeWhitespace(input.firstName);
  const normalizedLastName = normalizeWhitespace(input.lastName);

  const { data, error } = await supabase
    .from("self_registered_participants")
    .insert({
      task_id: taskId,
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
    })
    .select("id, task_id, first_name, last_name, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new HttpError(
        409,
        "Du bist bereits fuer diesen Einsatz eingetragen",
        "participant_already_exists",
      );
    }

    throw new HttpError(
      500,
      "Teilnehmer konnte nicht gespeichert werden",
      "participant_create_failed",
    );
  }

  return mapParticipantRow(data as ParticipantRow);
}

export async function removeTaskParticipant(
  taskId: string,
  input: RemoveParticipantInput,
): Promise<void> {
  await ensureTaskExists(taskId);

  const supabase = getSupabaseServiceClientOrThrow();
  const normalizedFirstName = normalizeWhitespace(input.firstName);
  const normalizedLastName = normalizeWhitespace(input.lastName);

  const { data, error } = await supabase
    .from("self_registered_participants")
    .delete()
    .eq("task_id", taskId)
    .ilike("first_name", normalizedFirstName)
    .ilike("last_name", normalizedLastName)
    .select("id")
    .limit(1);

  if (error) {
    throw new HttpError(
      500,
      "Teilnehmer konnte nicht gelöscht werden",
      "participant_delete_failed",
    );
  }

  if (!data || data.length === 0) {
    throw new HttpError(404, "Eintrag nicht gefunden", "participant_not_found");
  }
}

export async function hasTaskParticipant(
  taskId: string,
  input: AddParticipantInput,
): Promise<boolean> {
  await ensureTaskExists(taskId);

  const supabase = getSupabaseServiceClientOrThrow();
  const normalizedFirstName = normalizeWhitespace(input.firstName);
  const normalizedLastName = normalizeWhitespace(input.lastName);

  const { data, error } = await supabase
    .from("self_registered_participants")
    .select("id")
    .eq("task_id", taskId)
    .ilike("first_name", normalizedFirstName)
    .ilike("last_name", normalizedLastName)
    .limit(1);

  if (error) {
    throw new HttpError(
      500,
      "Teilnehmerstatus konnte nicht geladen werden",
      "participants_fetch_failed",
    );
  }

  return Boolean(data && data.length > 0);
}

function sanitizeFileName(fileName: string): string {
  const fallback = "image";
  const normalized = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 90);

  return normalized || fallback;
}

export async function listTaskImages(taskId: string): Promise<ImageRecord[]> {
  await ensureTaskExists(taskId);

  const supabase = getSupabaseServiceClientOrThrow();
  const { data, error } = await supabase
    .from("images")
    .select("id, task_id, url, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new HttpError(
      500,
      "Bilder konnten nicht geladen werden",
      "images_fetch_failed",
    );
  }

  return (data || []).map((row) => mapImageRow(row as ImageRow));
}

export async function uploadTaskImages(
  taskId: string,
  files: File[],
): Promise<ImageRecord[]> {
  if (!files.length) {
    throw new HttpError(
      400,
      "Es wurden keine Dateien uebergeben",
      "validation_error",
    );
  }

  await ensureTaskExists(taskId);

  const supabase = getSupabaseServiceClientOrThrow();
  const bucket = getTaskImagesBucketName();
  const uploadedFiles: Array<{ path: string; publicUrl: string }> = [];

  for (const file of files) {
    if (!file || file.size <= 0) {
      continue;
    }

    const safeFileName = sanitizeFileName(file.name || "image");
    const storagePath = `tasks/${taskId}/${randomUUID()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      throw new HttpError(
        500,
        "Bild konnte nicht hochgeladen werden",
        "image_upload_failed",
      );
    }

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    uploadedFiles.push({
      path: storagePath,
      publicUrl: publicData.publicUrl,
    });
  }

  if (!uploadedFiles.length) {
    throw new HttpError(
      400,
      "Es wurden keine gueltigen Bilder gefunden",
      "validation_error",
    );
  }

  const { data, error } = await supabase
    .from("images")
    .insert(
      uploadedFiles.map((item) => ({
        task_id: taskId,
        url: item.publicUrl,
      })),
    )
    .select("id, task_id, url, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    await supabase.storage
      .from(bucket)
      .remove(uploadedFiles.map((item) => item.path));

    throw new HttpError(
      500,
      "Bilddaten konnten nicht gespeichert werden",
      "image_insert_failed",
    );
  }

  return (data || []).map((row) => mapImageRow(row as ImageRow));
}

function extractStorageObjectPathFromPublicUrl(url: string): string | null {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const bucket = getTaskImagesBucketName();

  if (!supabaseUrl) {
    return null;
  }

  const marker = `${supabaseUrl}/storage/v1/object/public/${bucket}/`;
  const cleanUrl = url.split("?")[0];

  if (!cleanUrl.startsWith(marker)) {
    return null;
  }

  return decodeURIComponent(cleanUrl.slice(marker.length));
}

export async function deleteTaskImage(
  taskId: string,
  imageId: string,
): Promise<void> {
  await ensureTaskExists(taskId);

  const supabase = getSupabaseServiceClientOrThrow();

  const { data: imageRow, error: imageFetchError } = await supabase
    .from("images")
    .select("id, task_id, url, created_at")
    .eq("id", imageId)
    .eq("task_id", taskId)
    .single();

  if (imageFetchError) {
    if (imageFetchError.code === "PGRST116") {
      throw new HttpError(404, "Bild nicht gefunden", "image_not_found");
    }

    throw new HttpError(
      500,
      "Bild konnte nicht gelesen werden",
      "image_fetch_failed",
    );
  }

  const { error: deleteError } = await supabase
    .from("images")
    .delete()
    .eq("id", imageId)
    .eq("task_id", taskId);

  if (deleteError) {
    throw new HttpError(
      500,
      "Bild konnte nicht gelöscht werden",
      "image_delete_failed",
    );
  }

  const storagePath = extractStorageObjectPathFromPublicUrl(
    (imageRow as ImageRow).url || "",
  );

  if (storagePath) {
    const bucket = getTaskImagesBucketName();
    await supabase.storage.from(bucket).remove([storagePath]);
  }
}

export async function listEmailRecipients(): Promise<
  Array<{ id: string; email: string }>
> {
  const supabase = getSupabaseServiceClientOrThrow();
  const { data, error } = await supabase
    .from("email_list")
    .select("id, email")
    .order("email", { ascending: true });

  if (error) {
    throw new HttpError(
      500,
      "E-Mail Verteiler konnte nicht geladen werden",
      "email_list_fetch_failed",
    );
  }

  return (data || [])
    .map((row) => ({
      id: String((row as { id: string | number }).id),
      email: String((row as { email: string }).email || "")
        .trim()
        .toLowerCase(),
    }))
    .filter((row) => row.email.length > 0);
}

export async function addEmailRecipient(
  input: AddEmailRecipientInput,
): Promise<{ id: string; email: string }> {
  const supabase = getSupabaseServiceClientOrThrow();

  const { data, error } = await supabase
    .from("email_list")
    .insert({ email: input.email })
    .select("id, email")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new HttpError(
        409,
        "E-Mail existiert bereits",
        "email_already_exists",
      );
    }

    throw new HttpError(
      500,
      "E-Mail konnte nicht hinzugefuegt werden",
      "email_insert_failed",
    );
  }

  return {
    id: String((data as { id: string | number }).id),
    email: String((data as { email: string }).email || "")
      .trim()
      .toLowerCase(),
  };
}

export async function removeEmailRecipient(
  input: RemoveEmailRecipientInput,
): Promise<void> {
  const supabase = getSupabaseServiceClientOrThrow();

  const { data, error } = await supabase
    .from("email_list")
    .delete()
    .eq("id", input.id)
    .select("id")
    .limit(1);

  if (error) {
    throw new HttpError(
      500,
      "E-Mail konnte nicht gelöscht werden",
      "email_delete_failed",
    );
  }

  if (!data || data.length === 0) {
    throw new HttpError(404, "E-Mail nicht gefunden", "email_not_found");
  }
}

export async function notifyTaskCreated(
  task: TaskRecord,
): Promise<TaskNotificationResult> {
  const recipients = await listEmailRecipients();

  if (recipients.length === 0) {
    return {
      attempted: false,
      sent: false,
      recipientCount: 0,
      message: "Keine Empfänger in der Verteilerliste",
    };
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  if (!resendApiKey) {
    return {
      attempted: false,
      sent: false,
      recipientCount: recipients.length,
      message: "RESEND_API_KEY ist nicht konfiguriert",
    };
  }

  const siteUrl =
    process.env.MAIL_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    "";

  const resend = new Resend(resendApiKey);
  const baseUrl = siteUrl.replace(/\/$/, "");
  const taskUrl = baseUrl ? `${baseUrl}/` : null;
  const subject = `Neuer Arbeitseinsatz: ${task.title}`;

  const startDate = task.startDate ? formatDateTime(task.startDate) : "n/a";
  const endDate = task.endDate ? formatDateTime(task.endDate) : "n/a";

  const taskDetails = [
    ["Titel", task.title],
    ["Beschreibung", task.description],
    ["Start", startDate],
    ["Ende", endDate],
    ["Dauer", task.durationEstimate],
    ["Max. Teilnehmer", task.maxParticipants?.toString() ?? null],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  const htmlRows = taskDetails
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;font-weight:600;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
      <h1 style="font-size:20px;margin:0 0 16px;">Neuer Arbeitseinsatz</h1>
      <p style="margin:0 0 16px;">Ein neuer Einsatz wurde erstellt. Die Details:</p>
      <table style="border-collapse:collapse;margin:0 0 16px;">${htmlRows}</table>
      ${
        taskUrl
          ? `<p style="margin:0 0 8px;"><a href="${escapeHtml(taskUrl)}" style="color:#2563eb;">Zur Seite</a></p>`
          : ""
      }
    </div>
  `;

  const textLines = [
    "Neuer Arbeitseinsatz",
    "",
    ...taskDetails.map(([label, value]) => `${label}: ${value}`),
    ...(taskUrl ? ["", `Zur Seite: ${taskUrl}`] : []),
  ];

  try {
    await Promise.all(
      recipients.map((recipient) =>
        resend.emails.send({
          from: "onboarding@resend.dev",
          to: recipient.email,
          subject,
          html,
          text: textLines.join("\n"),
        }),
      ),
    );
  } catch {
    throw new HttpError(
      502,
      "E-Mail Versand fehlgeschlagen",
      "email_send_failed",
    );
  }

  return {
    attempted: true,
    sent: true,
    recipientCount: recipients.length,
    message: `E-Mail an ${recipients.length} Empfänger gesendet`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateOnly(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.split("T")[0] ?? value;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toIcsTimestamp(isoDate: string): string {
  return new Date(isoDate)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function buildTaskIcs(task: TaskRecord): string {
  if (!task.startDate || !task.endDate) {
    throw new HttpError(
      400,
      "Kalenderexport benoetigt Startdatum und Enddatum",
      "calendar_date_missing",
    );
  }

  const dtStamp = toIcsTimestamp(new Date().toISOString());
  const dtStart = toIcsTimestamp(task.startDate);
  const dtEnd = toIcsTimestamp(task.endDate);
  const summary = escapeIcsText(task.title);
  const description = escapeIcsText(task.description);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TV Bellenberg//Arbeitseinsätze//DE",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:task-${task.id}@tvb-portal`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

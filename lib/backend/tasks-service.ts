import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import nodemailer, { type Transporter } from "nodemailer";
import { z } from "zod";

import { HttpError } from "@/lib/backend/errors";
import {
  getSupabaseServiceClientOrThrow,
  getTaskImagesBucketName,
} from "@/lib/backend/supabase";
import { formatDateOnly, formatDateTime } from "../utils";

export type TaskStatus = "open" | "done";

export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  materials: string | null;
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
  materials: string | null;
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
  "id, title, description, materials, start_date, end_date, duration_estimate, max_participants, status, is_hidden, created_at";

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
  materials: z.string().trim().max(2000).nullable().optional(),
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
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});

const removeEmailRecipientBodySchema = z.object({
  id: z.union([z.string(), z.number()]),
});

const toggleEmailRecipientBodySchema = z.object({
  email: z.string().trim().email().max(320),
});

export type CreateTaskInput = {
  title: string;
  description: string;
  materials: string | null;
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
  firstName: string;
  lastName: string;
};

export type EmailRecipientRecord = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export type RemoveEmailRecipientInput = {
  id: string;
};

export type ToggleEmailRecipientInput = {
  email: string;
};

export type ToggleEmailRecipientResult = {
  action: "subscribed" | "unsubscribed";
  email: string;
};

export type ToggleParticipantResult =
  | { action: "registered"; participant: ParticipantRecord }
  | { action: "unregistered" };

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
    materials: normalizeOptionalText(payload.materials),
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

  if (Object.prototype.hasOwnProperty.call(payload, "materials")) {
    normalized.materials = normalizeOptionalText(payload.materials);
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
    firstName: normalizeWhitespace(parsed.data.firstName),
    lastName: normalizeWhitespace(parsed.data.lastName),
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

export function parseToggleEmailRecipientInput(
  input: unknown,
): ToggleEmailRecipientInput {
  const parsed = toggleEmailRecipientBodySchema.safeParse(input);

  if (!parsed.success) {
    throw toValidationError(parsed.error);
  }

  return {
    email: parsed.data.email.toLowerCase(),
  };
}

function mapTaskRow(row: TaskRow): TaskRecord {
  return {
    id: String(row.id),
    title: row.title?.trim() || "Unbenannter Einsatz",
    description: row.description?.trim() || "Keine Beschreibung vorhanden.",
    materials: row.materials?.trim() || null,
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
      materials: input.materials,
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
    materials?: string | null;
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

  if (Object.prototype.hasOwnProperty.call(input, "materials")) {
    updatePayload.materials = input.materials ?? null;
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

export async function listEmailRecipients(): Promise<EmailRecipientRecord[]> {
  const supabase = getSupabaseServiceClientOrThrow();
  const { data, error } = await supabase
    .from("email_list")
    .select("id, email, first_name, last_name");

  if (error) {
    throw new HttpError(
      500,
      "E-Mail Verteiler konnte nicht geladen werden",
      "email_list_fetch_failed",
    );
  }

  const recipients = (data || [])
    .map((row) => {
      const r = row as {
        id: string | number;
        email: string;
        first_name: string | null;
        last_name: string | null;
      };
      const firstName = r.first_name?.trim() || null;
      const lastName = r.last_name?.trim() || null;
      return {
        id: String(r.id),
        email: String(r.email || "")
          .trim()
          .toLowerCase(),
        firstName: firstName && firstName.length > 0 ? firstName : null,
        lastName: lastName && lastName.length > 0 ? lastName : null,
      };
    })
    .filter((row) => row.email.length > 0);

  recipients.sort((a, b) => {
    const aLast = (a.lastName ?? "").toLowerCase();
    const bLast = (b.lastName ?? "").toLowerCase();
    if (aLast !== bLast) {
      if (aLast === "") return 1;
      if (bLast === "") return -1;
      return aLast.localeCompare(bLast, "de");
    }
    const aFirst = (a.firstName ?? "").toLowerCase();
    const bFirst = (b.firstName ?? "").toLowerCase();
    if (aFirst !== bFirst) {
      return aFirst.localeCompare(bFirst, "de");
    }
    return a.email.localeCompare(b.email);
  });

  return recipients;
}

export async function addEmailRecipient(
  input: AddEmailRecipientInput,
): Promise<EmailRecipientRecord> {
  const supabase = getSupabaseServiceClientOrThrow();

  const { data, error } = await supabase
    .from("email_list")
    .insert({
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
    })
    .select("id, email, first_name, last_name")
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

  const row = data as {
    id: string | number;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };

  return {
    id: String(row.id),
    email: String(row.email || "")
      .trim()
      .toLowerCase(),
    firstName: row.first_name?.trim() || null,
    lastName: row.last_name?.trim() || null,
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

export async function toggleEmailRecipient(
  input: ToggleEmailRecipientInput,
): Promise<ToggleEmailRecipientResult> {
  const supabase = getSupabaseServiceClientOrThrow();
  const email = input.email.toLowerCase();

  const { data: existing, error: selectError } = await supabase
    .from("email_list")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (selectError) {
    throw new HttpError(
      500,
      "E-Mail Verteiler konnte nicht geprüft werden",
      "email_list_fetch_failed",
    );
  }

  if (existing && existing.length > 0) {
    const { error: deleteError } = await supabase
      .from("email_list")
      .delete()
      .eq("email", email);

    if (deleteError) {
      throw new HttpError(
        500,
        "E-Mail konnte nicht ausgetragen werden",
        "email_delete_failed",
      );
    }

    return { action: "unsubscribed", email };
  }

  const { error: insertError } = await supabase
    .from("email_list")
    .insert({ email });

  if (insertError) {
    if (insertError.code === "23505") {
      return { action: "subscribed", email };
    }

    throw new HttpError(
      500,
      "E-Mail konnte nicht eingetragen werden",
      "email_insert_failed",
    );
  }

  return { action: "subscribed", email };
}

export async function removeEmailRecipientByEmail(
  email: string,
): Promise<void> {
  const supabase = getSupabaseServiceClientOrThrow();

  const { error } = await supabase
    .from("email_list")
    .delete()
    .eq("email", email.toLowerCase());

  if (error) {
    throw new HttpError(
      500,
      "E-Mail konnte nicht gelöscht werden",
      "email_delete_failed",
    );
  }
}

export function generateUnsubscribeToken(email: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET?.trim();
  if (!secret) return "";
  return createHmac("sha256", secret).update(email.toLowerCase()).digest("hex");
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const secret = process.env.UNSUBSCRIBE_SECRET?.trim();
  if (!secret || !token) return false;
  const expected = createHmac("sha256", secret)
    .update(email.toLowerCase())
    .digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(token, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

const BREVO_SENDER_EMAIL = "info@tv-bellenberg.de";
const BREVO_SENDER_NAME = "TV Bellenberg";
const BREVO_SMTP_HOST = "smtp-relay.brevo.com";
const BREVO_SMTP_PORT = 587;

type BrevoEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

let cachedTransporter: Transporter | null = null;

function getBrevoTransporter(user: string, pass: string): Transporter {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: BREVO_SMTP_HOST,
      port: BREVO_SMTP_PORT,
      secure: false,
      auth: { user, pass },
    });
  }
  return cachedTransporter;
}

async function sendBrevoEmail(
  user: string,
  pass: string,
  email: BrevoEmail,
): Promise<void> {
  const transporter = getBrevoTransporter(user, pass);
  await transporter.sendMail({
    from: { name: BREVO_SENDER_NAME, address: BREVO_SENDER_EMAIL },
    to: email.to,
    replyTo: { name: BREVO_SENDER_NAME, address: BREVO_SENDER_EMAIL },
    subject: email.subject,
    html: email.html,
    text: email.text,
    ...(email.headers ? { headers: email.headers } : {}),
  });
}

export async function notifyParticipantRegistered(
  task: TaskRecord,
  participant: ParticipantRecord,
): Promise<void> {
  const contactEmail = process.env.NEXT_PUBLIC_TECHNICAL_CONTACT_EMAIL?.trim();
  const smtpUser = process.env.BREVO_SMTP_USER?.trim();
  const smtpPassword = process.env.BREVO_SMTP_PASSWORD?.trim();

  if (!contactEmail || !smtpUser || !smtpPassword) {
    return;
  }

  const registeredAt = formatDateTime(participant.createdAt);
  const subject = `Neue Anmeldung: ${task.title}`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
      <h1 style="font-size:20px;margin:0 0 16px;">Neue Anmeldung</h1>
      <table style="border-collapse:collapse;margin:0 0 16px;">
        <tr><td style="padding:4px 12px 4px 0;font-weight:600;vertical-align:top;">Einsatz</td><td style="padding:4px 0;">${escapeHtml(task.title)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600;vertical-align:top;">Angemeldet am</td><td style="padding:4px 0;">${escapeHtml(registeredAt)}</td></tr>
      </table>
    </div>
  `;

  const text = `Neue Anmeldung\n\nEinsatz: ${task.title}\nAngemeldet am: ${registeredAt}`;

  try {
    await sendBrevoEmail(smtpUser, smtpPassword, {
      to: contactEmail,
      subject,
      html,
      text,
    });
  } catch {
    // non-fatal: registration already succeeded
  }
}

export async function notifyParticipantUnregistered(
  task: TaskRecord,
): Promise<void> {
  const contactEmail = process.env.NEXT_PUBLIC_TECHNICAL_CONTACT_EMAIL?.trim();
  const smtpUser = process.env.BREVO_SMTP_USER?.trim();
  const smtpPassword = process.env.BREVO_SMTP_PASSWORD?.trim();

  if (!contactEmail || !smtpUser || !smtpPassword) {
    return;
  }

  const unregisteredAt = formatDateTime(new Date().toISOString());
  const subject = `Abmeldung: ${task.title}`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
      <h1 style="font-size:20px;margin:0 0 16px;">Abmeldung</h1>
      <table style="border-collapse:collapse;margin:0 0 16px;">
        <tr><td style="padding:4px 12px 4px 0;font-weight:600;vertical-align:top;">Einsatz</td><td style="padding:4px 0;">${escapeHtml(task.title)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600;vertical-align:top;">Abgemeldet am</td><td style="padding:4px 0;">${escapeHtml(unregisteredAt)}</td></tr>
      </table>
    </div>
  `;

  const text = `Abmeldung\n\nEinsatz: ${task.title}\nAbgemeldet am: ${unregisteredAt}`;

  try {
    await sendBrevoEmail(smtpUser, smtpPassword, {
      to: contactEmail,
      subject,
      html,
      text,
    });
  } catch {
    // non-fatal: unregistration already succeeded
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

  const smtpUser = process.env.BREVO_SMTP_USER?.trim();
  const smtpPassword = process.env.BREVO_SMTP_PASSWORD?.trim();

  if (!smtpUser || !smtpPassword) {
    return {
      attempted: false,
      sent: false,
      recipientCount: recipients.length,
      message: "BREVO_SMTP_USER/BREVO_SMTP_PASSWORD ist nicht konfiguriert",
    };
  }

  const subject = `Neuer Arbeitseinsatz: ${task.title}`;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  const taskUrl = baseUrl ? `${baseUrl}/` : null;

  let startDate = null;
  let endDate = null;
  let isTimeframe = false;
  if (task.startDate && task.endDate) {
    console.log(task.endDate);
    startDate = formatDateOnly(task.startDate);
    endDate = formatDateOnly(task.endDate);
    isTimeframe = true;
  } else if (task.startDate) {
    startDate = formatDateTime(task.startDate);
  }

  const taskDetails = [
    ["Titel", task.title],
    ["Beschreibung", task.description],
    ["Zeitraum", isTimeframe ? `${startDate} bis ${endDate}` : null],
    ["Start", !isTimeframe ? startDate : null],
    [
      "Dauer",
      task.durationEstimate
        ? `${task.durationEstimate} ${task.durationEstimate === "1" ? "Stunde" : "Stunden"}`
        : null,
    ],
    ["Max. Teilnehmer", task.maxParticipants?.toString() ?? null],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  const textLines = [
    "Neuer Arbeitseinsatz",
    "",
    ...taskDetails.map(([label, value]) => `${label}: ${value}`),
    ...(taskUrl ? ["", `Zur Seite: ${taskUrl}`] : []),
  ];

  const dateDisplay = isTimeframe ? `${startDate} bis ${endDate}` : startDate;

  const durationDisplay = task.durationEstimate
    ? `${task.durationEstimate} ${task.durationEstimate === "1" ? "Stunde" : "Stunden"}`
    : null;

  const allInfoItems = [
    task.materials ? `Werkzeug: ${escapeHtml(task.materials)}` : null,
    dateDisplay && endDate
      ? `Zeitraum: ${escapeHtml(dateDisplay)}`
      : dateDisplay
        ? `Start: ${escapeHtml(dateDisplay)}`
        : null,
    durationDisplay ? `Dauer: ${escapeHtml(durationDisplay)}` : null,
  ].filter((x): x is string => x !== null);

  const infoHtml =
    allInfoItems.length > 0
      ? `<div style="margin-top:12px;">${allInfoItems.map((item) => `<p style="margin:0 0 4px;font-size:13px;color:#374151;">${item}</p>`).join("")}</div>`
      : "";

  try {
    await Promise.all(
      recipients.map((recipient) => {
        const token = generateUnsubscribeToken(recipient.email);
        const unsubscribeUrl =
          baseUrl && token
            ? `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(recipient.email)}&token=${token}`
            : null;

        const html = `<div style="font-family:Arial,sans-serif;margin:0;padding:0;">
  <div style="padding:32px 24px;max-width:560px;">
    <h1 style="font-size:24px;font-weight:700;margin:0 0 8px;color:#111827;">Neuer Arbeitseinsatz</h1>
    <p style="color:#6b7280;margin:0 0 24px;font-size:15px;">Hallo, es wurde ein neuer Arbeitseinsatz eingetragen. Hier sind die Details:</p>
    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin:0 0 24px;">
      <table style="border-collapse:collapse;width:100%;"><tr>
        <td style="padding:0;vertical-align:top;">
          <span style="font-weight:700;font-size:16px;color:#111827;">${escapeHtml(task.title)}</span>
        </td>
      </tr></table>
      <p style="font-size:14px;margin:8px 0 0;">${escapeHtml(task.description)}</p>
      ${infoHtml}
    </div>
    ${taskUrl ? `<div style="margin:0 0 12px;"><a href="${escapeHtml(taskUrl)}" style="display:inline-block;background:#1a4d2e;color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">Jetzt eintragen &#8594;</a></div>` : ""}
  </div>
</div>`;

        const headers: Record<string, string> | undefined = unsubscribeUrl
          ? {
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
          : undefined;

        return sendBrevoEmail(smtpUser, smtpPassword, {
          to: recipient.email,
          subject,
          html,
          text: textLines.join("\n"),
          headers,
        });
      }),
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

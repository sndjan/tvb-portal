import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { TaskFormState, TaskWithDetails } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const baseFieldClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-tight";

export function getDefaultTaskForm(): TaskFormState {
  return {
    title: "",
    description: "",
    scheduleType: "range",
    rangeStartDate: "",
    rangeEndDate: "",
    startDateTime: "",
    durationEstimate: "",
    maxParticipants: "",
    status: "open",
    isHidden: false,
    sendEmail: false,
  };
}

export function toDateTimeLocalValue(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return "";
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function fromDateTimeLocalValue(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);

  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  return date.toISOString();
}

export function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return "Ungueltiges Datum";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateOnly(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return "Ungueltiges Datum";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateRange(task: TaskWithDetails) {
  if (task.startDate && task.endDate) {
    return `${formatDateOnly(task.startDate)} bis ${formatDateOnly(task.endDate)}`;
  }

  if (task.startDate) {
    return `Start: ${formatDateTime(task.startDate)}`;
  }

  if (task.endDate) {
    return `Ende: ${formatDateTime(task.endDate)}`;
  }

  return "Kein Zeitraum gesetzt";
}

const GENERAL_BACKEND_ERROR =
  "Backend nicht erreichbar. Bitte spaeter erneut versuchen.";

export function toMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return GENERAL_BACKEND_ERROR;
}

import "server-only";

import { createClient } from "@supabase/supabase-js";

export type TaskStatus = "open" | "done";

export type Task = {
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

export type TaskFeedResult = {
  tasks: Task[];
  source: "supabase" | "mock";
  error: string | null;
};

type SupabaseTaskRow = {
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

const GENERAL_BACKEND_ERROR =
  "Backend nicht erreichbar. Es werden Demo-Daten angezeigt.";

const MOCK_TASKS: Task[] = [
  {
    id: "demo-open-1",
    title: "Fruehjahrsputz auf den Plaetzen",
    description:
      "Netze aufhaengen, Linien kontrollieren und die Plaetze fuer die Saison vorbereiten.",
    startDate: "2026-04-28T08:00:00.000Z",
    endDate: "2026-04-28T12:00:00.000Z",
    durationEstimate: "4 Stunden",
    maxParticipants: 8,
    status: "open",
    isHidden: false,
    createdAt: "2026-04-10T08:00:00.000Z",
  },
  {
    id: "demo-open-2",
    title: "Beete rund ums Clubhaus pflegen",
    description:
      "Unkraut entfernen, neue Erde verteilen und die Randbereiche fuer den Sommer aufbereiten.",
    startDate: null,
    endDate: null,
    durationEstimate: "2 Stunden",
    maxParticipants: 4,
    status: "open",
    isHidden: false,
    createdAt: "2026-04-12T10:30:00.000Z",
  },
  {
    id: "demo-done-1",
    title: "Zuschauerbaenke reparieren",
    description:
      "Schrauben nachziehen und Holzleisten an den zwei vorderen Baenken erneuern.",
    startDate: "2026-03-08T09:00:00.000Z",
    endDate: "2026-03-08T11:30:00.000Z",
    durationEstimate: "2.5 Stunden",
    maxParticipants: 3,
    status: "done",
    isHidden: false,
    createdAt: "2026-03-01T13:45:00.000Z",
  },
];

function mapTaskRow(row: SupabaseTaskRow): Task {
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

function sortByCreatedAtAsc(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aTs = Date.parse(a.createdAt);
    const bTs = Date.parse(b.createdAt);
    return aTs - bTs;
  });
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PRIVATE_KEY || process.env.SUPABASE_PUBLIC_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getTaskFeed(): Promise<TaskFeedResult> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      tasks: sortByCreatedAtAsc(MOCK_TASKS),
      source: "mock",
      error: GENERAL_BACKEND_ERROR,
    };
  }

  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, description, start_date, end_date, duration_estimate, max_participants, status, is_hidden, created_at",
    )
    .order("created_at", { ascending: true });

  if (error) {
    return {
      tasks: sortByCreatedAtAsc(MOCK_TASKS),
      source: "mock",
      error: GENERAL_BACKEND_ERROR,
    };
  }

  return {
    tasks: (data ?? []).map((task) => mapTaskRow(task as SupabaseTaskRow)),
    source: "supabase",
    error: null,
  };
}

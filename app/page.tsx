import { connection } from "next/server";
import { Clock3, EyeOff, Plus, TriangleAlert, Users } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isAdminSessionActive } from "@/lib/backend/admin-session";
import { Task, getTaskFeed } from "@/lib/tasks";

type HomePageProps = {
  searchParams: Promise<{
    admin?: string;
  }>;
};

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return "Ungueltiges Datum";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDateRange(task: Task) {
  if (task.startDate && task.endDate) {
    return `${formatDateTime(task.startDate)} bis ${formatDateTime(task.endDate)}`;
  }

  if (task.startDate) {
    return `Start: ${formatDateTime(task.startDate)}`;
  }

  if (task.endDate) {
    return `Ende: ${formatDateTime(task.endDate)}`;
  }

  return "Kein Zeitraum gesetzt";
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed bg-card px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">
        Aktuell keine Arbeitseinsaetze
      </p>
    </div>
  );
}

function TaskList({ isAdmin, tasks }: { isAdmin: boolean; tasks: Task[] }) {
  if (tasks.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-4">
      {tasks.map((task) => (
        <Card key={task.id} className="border-l-4 border-l-primary/60">
          <CardHeader className="gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-base sm:text-lg">
                  {task.title}
                </CardTitle>
                <CardDescription>{task.description}</CardDescription>
              </div>
              <Badge variant={task.status === "done" ? "secondary" : "default"}>
                {task.status === "done" ? "Erledigt" : "Offen"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p className="text-muted-foreground">{formatDateRange(task)}</p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Clock3 className="size-4" aria-hidden="true" />
              {task.durationEstimate || "Keine Dauer angegeben"}
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-4" aria-hidden="true" />
              {task.requiredPeople !== null
                ? `${task.requiredPeople} benötigte Personen`
                : "Benötigte Personen offen"}
            </p>
          </CardContent>

          {isAdmin && task.isHidden ? (
            <CardFooter>
              <Badge variant="outline" className="gap-1">
                <EyeOff className="size-3" aria-hidden="true" />
                Versteckt (nur Admin)
              </Badge>
            </CardFooter>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

export default async function Home({ searchParams }: HomePageProps) {
  await connection();

  const params = await searchParams;
  const hasAdminSession = await isAdminSessionActive();
  const isAdmin = hasAdminSession || params.admin === "1";

  const feed = await getTaskFeed();
  const visibleTasks = isAdmin
    ? feed.tasks
    : feed.tasks.filter((task) => !task.isHidden);
  const openTasks = visibleTasks.filter((task) => task.status === "open");
  const doneTasks = visibleTasks.filter((task) => task.status === "done");

  return (
    <main className="min-h-screen bg-linear-to-b from-background via-background to-muted/40 pb-14">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-2xl border bg-card/70 p-5 backdrop-blur-sm ">
          <div className="flex flex-row gap-3 sm:items-center justify-between">
            <div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                TV Bellenberg
              </h1>
              <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Arbeitseinsätze
              </p>
            </div>

            {isAdmin ? (
              <Button disabled>
                <Plus className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </header>

        {feed.error ? (
          <Alert variant="destructive">
            <TriangleAlert className="size-4" aria-hidden="true" />
            <AlertTitle>Hinweis</AlertTitle>
            <AlertDescription>{feed.error}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs defaultValue="open" className="w-full gap-4">
          <TabsList>
            <TabsTrigger value="open">Offen ({openTasks.length})</TabsTrigger>
            <TabsTrigger value="done">
              Erledigt ({doneTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="mt-0">
            <TaskList isAdmin={isAdmin} tasks={openTasks} />
          </TabsContent>

          <TabsContent value="done" className="mt-0">
            <TaskList isAdmin={isAdmin} tasks={doneTasks} />
          </TabsContent>
        </Tabs>

        <footer className="text-xs text-muted-foreground">
          Datenquelle: {feed.source === "supabase" ? "Supabase" : "Demo-Daten"}
        </footer>
      </section>
    </main>
  );
}

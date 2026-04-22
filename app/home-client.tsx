"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  EyeOff,
  ImagePlus,
  ListChecks,
  LogIn,
  LogOut,
  Mail,
  Plus,
  Save,
  Send,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TaskStatus = "open" | "done";

type ParticipantRecord = {
  id: string;
  taskId: string;
  name: string;
  createdAt: string;
};

type ImageRecord = {
  id: string;
  taskId: string;
  url: string;
  createdAt: string;
};

type TaskWithDetails = {
  id: string;
  title: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  durationEstimate: string | null;
  requiredPeople: number | null;
  status: TaskStatus;
  isHidden: boolean;
  createdAt: string;
  participantCount: number;
  participants: ParticipantRecord[] | null;
  images: ImageRecord[];
};

type TasksResponse = {
  tasks: TaskWithDetails[];
  isAdmin: boolean;
};

type EmailRecipient = {
  id: string;
  email: string;
};

type CreateTaskFormState = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  durationEstimate: string;
  requiredPeople: string;
  status: TaskStatus;
  isHidden: boolean;
  sendEmail: boolean;
};

type EditTaskFormState = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  durationEstimate: string;
  requiredPeople: string;
  status: TaskStatus;
  isHidden: boolean;
};

type PendingUpload = {
  files: File[];
  previews: string[];
};

const GENERAL_BACKEND_ERROR =
  "Backend nicht erreichbar. Bitte spaeter erneut versuchen.";

const baseFieldClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-tight";

function getDefaultCreateForm(): CreateTaskFormState {
  return {
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    durationEstimate: "",
    requiredPeople: "",
    status: "open",
    isHidden: false,
    sendEmail: false,
  };
}

function toDateTimeLocalValue(value: string | null): string {
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

function fromDateTimeLocalValue(value: string): string | null {
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

function formatDateRange(task: TaskWithDetails) {
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

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return GENERAL_BACKEND_ERROR;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
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

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed bg-card px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">
        Aktuell keine Arbeitseinsätze
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

export function HomeClient() {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [activeTab, setActiveTab] = useState<TaskStatus>("open");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [createForm, setCreateForm] = useState<CreateTaskFormState>(
    getDefaultCreateForm(),
  );
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditTaskFormState | null>(null);
  const [busyTaskIds, setBusyTaskIds] = useState<Record<string, boolean>>({});

  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[]>([]);
  const [isLoadingEmailRecipients, setIsLoadingEmailRecipients] =
    useState(false);
  const [emailInput, setEmailInput] = useState("");

  const [pendingUploads, setPendingUploads] = useState<
    Record<string, PendingUpload>
  >({});

  useEffect(() => {
    return () => {
      for (const upload of Object.values(pendingUploads)) {
        upload.previews.forEach((url) => URL.revokeObjectURL(url));
      }
    };
  }, [pendingUploads]);

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status === "open"),
    [tasks],
  );
  const doneTasks = useMemo(
    () => tasks.filter((task) => task.status === "done"),
    [tasks],
  );

  async function refreshTasks(options?: { keepLoadingState?: boolean }) {
    const keepLoadingState = options?.keepLoadingState ?? false;

    if (!keepLoadingState) {
      setIsLoadingTasks(true);
    }

    try {
      const data = await requestJson<TasksResponse>("/api/tasks", {
        method: "GET",
      });

      setTasks(data.tasks);
      setIsAdmin(data.isAdmin);
      setErrorMessage(null);

      if (data.isAdmin) {
        await refreshEmailRecipients();
      } else {
        setEmailRecipients([]);
      }
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsLoadingTasks(false);
    }
  }

  async function refreshEmailRecipients() {
    setIsLoadingEmailRecipients(true);

    try {
      const data = await requestJson<{ recipients: EmailRecipient[] }>(
        "/api/admin/email-list",
        { method: "GET" },
      );
      setEmailRecipients(data.recipients);
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsLoadingEmailRecipients(false);
    }
  }

  function setTaskBusy(taskId: string, isBusy: boolean) {
    setBusyTaskIds((prev) => ({
      ...prev,
      [taskId]: isBusy,
    }));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!loginPassword.trim()) {
      setErrorMessage("Bitte Passwort eingeben.");
      return;
    }

    setIsLoggingIn(true);

    try {
      await requestJson<{ ok: true }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password: loginPassword }),
      });

      setLoginPassword("");
      setSuccessMessage("Als Admin angemeldet.");
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await requestJson<{ ok: true }>("/api/admin/logout", { method: "POST" });
      setSuccessMessage("Admin-Session beendet.");
      setEditingTaskId(null);
      setEditForm(null);
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleCreateTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingTask(true);

    try {
      const requiredPeopleValue = createForm.requiredPeople.trim();

      const payload = {
        title: createForm.title,
        description: createForm.description,
        startDate: fromDateTimeLocalValue(createForm.startDate),
        endDate: fromDateTimeLocalValue(createForm.endDate),
        durationEstimate: createForm.durationEstimate.trim() || null,
        requiredPeople: requiredPeopleValue
          ? Number(requiredPeopleValue)
          : null,
        status: createForm.status,
        isHidden: createForm.isHidden,
        sendEmail: createForm.sendEmail,
      };

      const response = await requestJson<{
        task: TaskWithDetails;
        notification?: { message: string } | null;
      }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setCreateForm(getDefaultCreateForm());

      if (response.notification?.message) {
        setSuccessMessage(response.notification.message);
      } else {
        setSuccessMessage("Arbeitseinsatz erstellt.");
      }

      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsCreatingTask(false);
    }
  }

  function startEditTask(task: TaskWithDetails) {
    setEditingTaskId(task.id);
    setEditForm({
      title: task.title,
      description: task.description,
      startDate: toDateTimeLocalValue(task.startDate),
      endDate: toDateTimeLocalValue(task.endDate),
      durationEstimate: task.durationEstimate || "",
      requiredPeople:
        task.requiredPeople === null ? "" : String(task.requiredPeople),
      status: task.status,
      isHidden: task.isHidden,
    });
  }

  async function handleSaveEdit(taskId: string) {
    if (!editForm) {
      return;
    }

    setTaskBusy(taskId, true);

    try {
      const requiredPeopleValue = editForm.requiredPeople.trim();

      await requestJson<{ task: TaskWithDetails }>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          startDate: fromDateTimeLocalValue(editForm.startDate),
          endDate: fromDateTimeLocalValue(editForm.endDate),
          durationEstimate: editForm.durationEstimate.trim() || null,
          requiredPeople: requiredPeopleValue
            ? Number(requiredPeopleValue)
            : null,
          status: editForm.status,
          isHidden: editForm.isHidden,
        }),
      });

      setSuccessMessage("Einsatz aktualisiert.");
      setEditingTaskId(null);
      setEditForm(null);
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setTaskBusy(taskId, false);
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!window.confirm("Diesen Arbeitseinsatz wirklich löschen?")) {
      return;
    }

    setTaskBusy(taskId, true);

    try {
      await requestJson<{ ok: true }>(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      setSuccessMessage("Einsatz gelöscht.");
      if (editingTaskId === taskId) {
        setEditingTaskId(null);
        setEditForm(null);
      }
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setTaskBusy(taskId, false);
    }
  }

  async function toggleTaskStatus(task: TaskWithDetails) {
    setTaskBusy(task.id, true);

    try {
      await requestJson<{ task: TaskWithDetails }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: task.status === "open" ? "done" : "open",
        }),
      });

      setSuccessMessage("Status aktualisiert.");
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setTaskBusy(task.id, false);
    }
  }

  async function toggleTaskVisibility(task: TaskWithDetails) {
    setTaskBusy(task.id, true);

    try {
      await requestJson<{ task: TaskWithDetails }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isHidden: !task.isHidden,
        }),
      });

      setSuccessMessage("Sichtbarkeit aktualisiert.");
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setTaskBusy(task.id, false);
    }
  }

  function updateUploadSelection(taskId: string, files: FileList | null) {
    setPendingUploads((prev) => {
      const current = prev[taskId];

      if (current) {
        current.previews.forEach((url) => URL.revokeObjectURL(url));
      }

      if (!files || files.length === 0) {
        const next = { ...prev };
        delete next[taskId];
        return next;
      }

      const nextFiles = Array.from(files);
      const previews = nextFiles.map((file) => URL.createObjectURL(file));

      return {
        ...prev,
        [taskId]: {
          files: nextFiles,
          previews,
        },
      };
    });
  }

  async function handleUploadImages(taskId: string) {
    const selection = pendingUploads[taskId];

    if (!selection || selection.files.length === 0) {
      setErrorMessage("Bitte zuerst Bilder auswählen.");
      return;
    }

    setTaskBusy(taskId, true);

    try {
      const formData = new FormData();

      for (const file of selection.files) {
        formData.append("files", file);
      }

      await requestJson<{ images: ImageRecord[] }>(
        `/api/tasks/${taskId}/images`,
        {
          method: "POST",
          body: formData,
        },
      );

      selection.previews.forEach((url) => URL.revokeObjectURL(url));
      setPendingUploads((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });

      setSuccessMessage("Bilder hochgeladen.");
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setTaskBusy(taskId, false);
    }
  }

  async function handleDeleteImage(taskId: string, imageId: string) {
    setTaskBusy(taskId, true);

    try {
      await requestJson<{ ok: true }>(
        `/api/tasks/${taskId}/images/${imageId}`,
        {
          method: "DELETE",
        },
      );

      setSuccessMessage("Bild gelöscht.");
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setTaskBusy(taskId, false);
    }
  }

  async function handleAddEmailRecipient(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalized = emailInput.trim().toLowerCase();

    if (!normalized) {
      setErrorMessage("Bitte eine E-Mail eingeben.");
      return;
    }

    setIsLoadingEmailRecipients(true);

    try {
      await requestJson<{ recipient: EmailRecipient }>(
        "/api/admin/email-list",
        {
          method: "POST",
          body: JSON.stringify({ email: normalized }),
        },
      );

      setEmailInput("");
      setSuccessMessage("E-Mail hinzugefuegt.");
      await refreshEmailRecipients();
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsLoadingEmailRecipients(false);
    }
  }

  async function handleRemoveEmailRecipient(id: string) {
    setIsLoadingEmailRecipients(true);

    try {
      await requestJson<{ ok: true }>("/api/admin/email-list", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });

      setSuccessMessage("E-Mail entfernt.");
      await refreshEmailRecipients();
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsLoadingEmailRecipients(false);
    }
  }

  const listedTasks = activeTab === "open" ? openTasks : doneTasks;

  return (
    <main className="min-h-screen bg-linear-to-b from-background via-background to-muted/40 pb-14">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-2xl border bg-card/70 p-5 backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                TV Bellenberg
              </h1>
              <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Arbeitseinsätze
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin ? (
                <Badge variant="secondary" className="gap-1">
                  <ListChecks className="size-3.5" aria-hidden="true" />
                  Admin aktiv
                </Badge>
              ) : (
                <Badge variant="outline">Öffentliche Ansicht</Badge>
              )}
              {isAdmin ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Logout
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        {errorMessage ? (
          <Alert variant="destructive">
            <TriangleAlert className="size-4" aria-hidden="true" />
            <AlertTitle>Fehler</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {successMessage ? (
          <Alert>
            <Send className="size-4" aria-hidden="true" />
            <AlertTitle>Info</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        ) : null}

        {!isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>Admin Login</CardTitle>
              <CardDescription>
                Mit globalem Passwort anmelden, um Einsätze zu verwalten.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleLoginSubmit}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <Input
                  type="password"
                  autoComplete="current-password"
                  className={baseFieldClass}
                  placeholder="Admin Passwort"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  required
                />
                <Button type="submit" disabled={isLoggingIn}>
                  <LogIn className="size-4" aria-hidden="true" />
                  Einloggen
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {isAdmin ? (
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Neuen Einsatz erstellen</CardTitle>
                <CardDescription>
                  Titel und Beschreibung sind Pflichtfelder. E-Mail Versand ist
                  optional.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3" onSubmit={handleCreateTask}>
                  <Input
                    className={baseFieldClass}
                    placeholder="Titel"
                    value={createForm.title}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    required
                  />
                  <Textarea
                    className={`${baseFieldClass} min-h-24`}
                    placeholder="Beschreibung"
                    value={createForm.description}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    required
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs text-muted-foreground">
                      Startdatum
                      <Input
                        type="datetime-local"
                        className={baseFieldClass}
                        value={createForm.startDate}
                        onChange={(event) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            startDate: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1 text-xs text-muted-foreground">
                      Enddatum
                      <Input
                        type="datetime-local"
                        className={baseFieldClass}
                        value={createForm.endDate}
                        onChange={(event) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            endDate: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      className={baseFieldClass}
                      placeholder="Dauer (z.B. 3 Stunden)"
                      value={createForm.durationEstimate}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          durationEstimate: event.target.value,
                        }))
                      }
                    />
                    <Input
                      type="number"
                      min={1}
                      className={baseFieldClass}
                      placeholder="Benötigte Personen"
                      value={createForm.requiredPeople}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          requiredPeople: event.target.value,
                        }))
                      }
                    />
                    <Select
                      value={createForm.status}
                      onValueChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          status: event as TaskStatus,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Status auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Offen</SelectItem>
                        <SelectItem value="done">Erledigt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={createForm.isHidden}
                        onChange={(event) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            isHidden: event.target.checked,
                          }))
                        }
                      />
                      Versteckt (nur Admin)
                    </label>

                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={createForm.sendEmail}
                        onChange={(event) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            sendEmail: event.target.checked,
                          }))
                        }
                      />
                      E-Mail senden
                    </label>
                  </div>

                  <div>
                    <Button type="submit" disabled={isCreatingTask}>
                      <Plus className="size-4" aria-hidden="true" />
                      Einsatz erstellen
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="size-4" aria-hidden="true" />
                  Verteilerliste
                </CardTitle>
                <CardDescription>
                  Empfänger für den optionalen E-Mail Versand.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <form onSubmit={handleAddEmailRecipient} className="flex gap-2">
                  <Input
                    type="email"
                    className={baseFieldClass}
                    placeholder="email@beispiel.de"
                    value={emailInput}
                    onChange={(event) => setEmailInput(event.target.value)}
                    required
                  />
                  <Button type="submit" disabled={isLoadingEmailRecipients}>
                    <Plus className="size-4" aria-hidden="true" />
                  </Button>
                </form>

                <div className="max-h-48 space-y-2 overflow-auto pr-1">
                  {emailRecipients.length === 0 && !isLoadingEmailRecipients ? (
                    <p className="text-sm text-muted-foreground">
                      Noch keine Empfänger hinterlegt.
                    </p>
                  ) : null}

                  {emailRecipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                    >
                      <span className="truncate">{recipient.email}</span>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleRemoveEmailRecipient(recipient.id)}
                        disabled={isLoadingEmailRecipients}
                        aria-label="E-Mail entfernen"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TaskStatus)}
          className="w-full gap-4"
        >
          <TabsList>
            <TabsTrigger value="open">Offen ({openTasks.length})</TabsTrigger>
            <TabsTrigger value="done">
              Erledigt ({doneTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="mt-0">
            {isLoadingTasks ? (
              <LoadingState />
            ) : listedTasks.length === 0 ? (
              <EmptyState />
            ) : (
              <TaskCards
                tasks={listedTasks}
                isAdmin={isAdmin}
                editingTaskId={editingTaskId}
                editForm={editForm}
                busyTaskIds={busyTaskIds}
                pendingUploads={pendingUploads}
                onStartEdit={startEditTask}
                onCancelEdit={() => {
                  setEditingTaskId(null);
                  setEditForm(null);
                }}
                onChangeEditForm={setEditForm}
                onSaveEdit={handleSaveEdit}
                onDeleteTask={handleDeleteTask}
                onToggleStatus={toggleTaskStatus}
                onToggleVisibility={toggleTaskVisibility}
                onSelectUpload={updateUploadSelection}
                onUploadImages={handleUploadImages}
                onDeleteImage={handleDeleteImage}
              />
            )}
          </TabsContent>

          <TabsContent value="done" className="mt-0">
            {isLoadingTasks ? (
              <LoadingState />
            ) : listedTasks.length === 0 ? (
              <EmptyState />
            ) : (
              <TaskCards
                tasks={listedTasks}
                isAdmin={isAdmin}
                editingTaskId={editingTaskId}
                editForm={editForm}
                busyTaskIds={busyTaskIds}
                pendingUploads={pendingUploads}
                onStartEdit={startEditTask}
                onCancelEdit={() => {
                  setEditingTaskId(null);
                  setEditForm(null);
                }}
                onChangeEditForm={setEditForm}
                onSaveEdit={handleSaveEdit}
                onDeleteTask={handleDeleteTask}
                onToggleStatus={toggleTaskStatus}
                onToggleVisibility={toggleTaskVisibility}
                onSelectUpload={updateUploadSelection}
                onUploadImages={handleUploadImages}
                onDeleteImage={handleDeleteImage}
              />
            )}
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}

type TaskCardsProps = {
  tasks: TaskWithDetails[];
  isAdmin: boolean;
  editingTaskId: string | null;
  editForm: EditTaskFormState | null;
  busyTaskIds: Record<string, boolean>;
  pendingUploads: Record<string, PendingUpload>;
  onStartEdit: (task: TaskWithDetails) => void;
  onCancelEdit: () => void;
  onChangeEditForm: (value: EditTaskFormState | null) => void;
  onSaveEdit: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleStatus: (task: TaskWithDetails) => void;
  onToggleVisibility: (task: TaskWithDetails) => void;
  onSelectUpload: (taskId: string, files: FileList | null) => void;
  onUploadImages: (taskId: string) => void;
  onDeleteImage: (taskId: string, imageId: string) => void;
};

function TaskCards({
  tasks,
  isAdmin,
  editingTaskId,
  editForm,
  busyTaskIds,
  pendingUploads,
  onStartEdit,
  onCancelEdit,
  onChangeEditForm,
  onSaveEdit,
  onDeleteTask,
  onToggleStatus,
  onToggleVisibility,
  onSelectUpload,
  onUploadImages,
  onDeleteImage,
}: TaskCardsProps) {
  return (
    <div className="grid gap-4">
      {tasks.map((task) => {
        const isBusy = Boolean(busyTaskIds[task.id]);
        const isEditing = editingTaskId === task.id && Boolean(editForm);
        const upload = pendingUploads[task.id];
        const img = task.images.length > 0 ? task.images[0] : null;

        return (
          <Card key={task.id} className="border-l-4 border-l-primary/60">
            <CardHeader className="gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base sm:text-lg">
                    {task.title}
                  </CardTitle>
                  <CardDescription>{task.description}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <Badge
                    variant={task.status === "done" ? "secondary" : "default"}
                  >
                    {task.status === "done" ? "Erledigt" : "Offen"}
                  </Badge>
                  {task.isHidden ? (
                    <Badge variant="outline" className="gap-1">
                      <EyeOff className="size-3" aria-hidden="true" />
                      Versteckt
                    </Badge>
                  ) : null}
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  {formatDateRange(task)}
                </p>
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
                <p className="flex items-center gap-2 text-muted-foreground">
                  <ListChecks className="size-4" aria-hidden="true" />
                  {task.participantCount} Teilnehmer
                </p>
              </div>

              {/* {task.startDate && task.endDate ? (
                <div>
                <a
                className="text-sm text-primary underline-offset-4 hover:underline"
                href={`/api/tasks/${task.id}/ics`}
                >
                ICS herunterladen
                </a>
                </div>
                ) : null} */}

              {isAdmin ? (
                <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
                  <div>
                    <h3 className="mb-2 text-sm font-medium">
                      Teilnehmer (Namen)
                    </h3>
                    {task.participants && task.participants.length > 0 ? (
                      <ul className="grid gap-1 text-sm">
                        {task.participants.map((participant) => (
                          <li
                            key={participant.id}
                            className="rounded-md border px-2 py-1"
                          >
                            {participant.name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Keine Teilnehmer vorhanden.
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-medium">Bilder</h3>
                    {task.images.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {task.images.map((image) => (
                          <div
                            key={image.id}
                            className="relative overflow-hidden rounded-md border"
                          >
                            <img
                              src={image.url}
                              alt="Task Bild"
                              className="h-24 w-full object-cover"
                            />
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="destructive"
                              className="absolute top-1 right-1"
                              onClick={() => onDeleteImage(task.id, image.id)}
                              disabled={isBusy}
                              aria-label="Bild löschen"
                            >
                              <Trash2 className="size-3" aria-hidden="true" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Noch keine Bilder.
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <label className="text-xs text-muted-foreground">
                      Bilder auswählen (mit Vorschau)
                    </label>
                    <Input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(event) =>
                        onSelectUpload(task.id, event.currentTarget.files)
                      }
                    />

                    {upload && upload.previews.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {upload.previews.map((previewUrl, index) => (
                          <img
                            key={`${task.id}-preview-${index}`}
                            src={previewUrl}
                            alt="Neue Bildvorschau"
                            className="h-24 w-full rounded-md border object-cover"
                          />
                        ))}
                      </div>
                    ) : null}

                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onUploadImages(task.id)}
                        disabled={
                          isBusy || !upload || upload.files.length === 0
                        }
                      >
                        <ImagePlus className="size-4" aria-hidden="true" />
                        Bilder hochladen
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {isAdmin && isEditing && editForm ? (
                <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
                  <h3 className="text-sm font-medium">Einsatz bearbeiten</h3>
                  <Input
                    className={baseFieldClass}
                    value={editForm.title}
                    onChange={(event) =>
                      onChangeEditForm({
                        ...editForm,
                        title: event.target.value,
                      })
                    }
                  />
                  <Textarea
                    className={`${baseFieldClass} min-h-24`}
                    value={editForm.description}
                    onChange={(event) =>
                      onChangeEditForm({
                        ...editForm,
                        description: event.target.value,
                      })
                    }
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs text-muted-foreground">
                      Startdatum
                      <Input
                        type="datetime-local"
                        className={baseFieldClass}
                        value={editForm.startDate}
                        onChange={(event) =>
                          onChangeEditForm({
                            ...editForm,
                            startDate: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="grid gap-1 text-xs text-muted-foreground">
                      Enddatum
                      <Input
                        type="datetime-local"
                        className={baseFieldClass}
                        value={editForm.endDate}
                        onChange={(event) =>
                          onChangeEditForm({
                            ...editForm,
                            endDate: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      className={baseFieldClass}
                      placeholder="Dauer"
                      value={editForm.durationEstimate}
                      onChange={(event) =>
                        onChangeEditForm({
                          ...editForm,
                          durationEstimate: event.target.value,
                        })
                      }
                    />
                    <Input
                      type="number"
                      min={1}
                      className={baseFieldClass}
                      placeholder="Benötigte Personen"
                      value={editForm.requiredPeople}
                      onChange={(event) =>
                        onChangeEditForm({
                          ...editForm,
                          requiredPeople: event.target.value,
                        })
                      }
                    />
                    <Select
                      value={editForm.status}
                      onValueChange={(event) =>
                        onChangeEditForm({
                          ...editForm,
                          status: event as TaskStatus,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Status auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Offen</SelectItem>
                        <SelectItem value="done">Erledigt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.isHidden}
                      onChange={(event) =>
                        onChangeEditForm({
                          ...editForm,
                          isHidden: event.target.checked,
                        })
                      }
                    />
                    Versteckt (nur Admin)
                  </label>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => onSaveEdit(task.id)}
                      disabled={isBusy}
                    >
                      <Save className="size-4" aria-hidden="true" />
                      Speichern
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={onCancelEdit}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>

            {isAdmin ? (
              <CardFooter className="flex flex-wrap gap-2 border-t">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onToggleStatus(task)}
                  disabled={isBusy}
                >
                  Status:{" "}
                  {task.status === "open" ? "Auf erledigt" : "Auf offen"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onToggleVisibility(task)}
                  disabled={isBusy}
                >
                  {task.isHidden ? "Sichtbar schalten" : "Verstecken"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onStartEdit(task)}
                  disabled={isBusy}
                >
                  Bearbeiten
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => onDeleteTask(task.id)}
                  disabled={isBusy}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Löschen
                </Button>
              </CardFooter>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

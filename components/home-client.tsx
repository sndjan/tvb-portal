"use client";

import { LogOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LoginForm } from "@/components/LoginForm";
import { MailingList } from "@/components/MailingList";
import { NewEntryForm } from "@/components/NewEntryForm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requestJson } from "@/lib/api";
import {
  Action,
  BusyTask,
  CreateTaskFormState,
  EditTaskFormState,
  EmailRecipient,
  ImageRecord,
  PendingUpload,
  TasksResponse,
  TaskStatus,
  TaskWithDetails,
} from "@/lib/types";
import {
  fromDateTimeLocalValue,
  getDefaultCreateForm,
  toDateTimeLocalValue,
  toMessage,
} from "@/lib/utils";
import { toast } from "sonner";
import { TaskCards } from "./TaskCards";
import { Spinner } from "./ui/spinner";

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
  const [busyTaskIds, setBusyTaskIds] = useState<BusyTask[]>([]);

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
      toast.error(toMessage(error));
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
      toast.error(toMessage(error));
    } finally {
      setIsLoadingEmailRecipients(false);
    }
  }

  function setTaskBusy(taskId: string, isBusy: boolean, busyAction: Action) {
    setBusyTaskIds((prev) => {
      const next = prev.filter((task) => task.id !== taskId);

      if (!isBusy) {
        return next;
      }

      return [...next, { id: taskId, busy: true, busyAction }];
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!loginPassword.trim()) {
      toast.error("Bitte Passwort eingeben.");
      return;
    }

    setIsLoggingIn(true);

    try {
      await requestJson<{ ok: true }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password: loginPassword }),
      });

      setLoginPassword("");
      toast.success("Als Admin angemeldet.");
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await requestJson<{ ok: true }>("/api/admin/logout", { method: "POST" });
      setEditingTaskId(null);
      setEditForm(null);
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      toast(toMessage(error));
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleCreateTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingTask(true);

    try {
      const maxParticipantsValue = createForm.maxParticipants.trim();

      const payload = {
        title: createForm.title,
        description: createForm.description,
        startDate: fromDateTimeLocalValue(createForm.startDate),
        endDate: fromDateTimeLocalValue(createForm.endDate),
        durationEstimate: createForm.durationEstimate.trim() || null,
        maxParticipants: maxParticipantsValue
          ? Number(maxParticipantsValue)
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
        toast.success(response.notification.message);
      } else {
        toast.success("Arbeitseinsatz erstellt.");
      }

      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      toast.error(toMessage(error));
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
      maxParticipants:
        task.maxParticipants === null ? "" : String(task.maxParticipants),
      status: task.status,
      isHidden: task.isHidden,
    });
  }

  async function handleSaveEdit(taskId: string) {
    if (!editForm) {
      return;
    }

    setTaskBusy(taskId, true, Action.SaveEdit);

    try {
      const maxParticipantsValue = editForm.maxParticipants.trim();

      await requestJson<{ task: TaskWithDetails }>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          startDate: fromDateTimeLocalValue(editForm.startDate),
          endDate: fromDateTimeLocalValue(editForm.endDate),
          durationEstimate: editForm.durationEstimate.trim() || null,
          maxParticipants: maxParticipantsValue
            ? Number(maxParticipantsValue)
            : null,
          status: editForm.status,
          isHidden: editForm.isHidden,
        }),
      });

      toast.success("Einsatz aktualisiert.");
      setEditingTaskId(null);
      setEditForm(null);
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setTaskBusy(taskId, false, Action.SaveEdit);
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!window.confirm("Diesen Arbeitseinsatz wirklich löschen?")) {
      return;
    }

    setTaskBusy(taskId, true, Action.DeleteTask);

    try {
      await requestJson<{ ok: true }>(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      toast.success("Einsatz gelöscht.");
      if (editingTaskId === taskId) {
        setEditingTaskId(null);
        setEditForm(null);
      }
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setTaskBusy(taskId, false, Action.DeleteTask);
    }
  }

  async function toggleTaskStatus(task: TaskWithDetails) {
    setTaskBusy(task.id, true, Action.ToggleStatus);

    try {
      await requestJson<{ task: TaskWithDetails }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: task.status === "open" ? "done" : "open",
        }),
      });

      toast.success("Status aktualisiert.");
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setTaskBusy(task.id, false, Action.ToggleStatus);
    }
  }

  async function toggleTaskVisibility(task: TaskWithDetails) {
    setTaskBusy(task.id, true, Action.ToggleVisibility);

    try {
      await requestJson<{ task: TaskWithDetails }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isHidden: !task.isHidden,
        }),
      });

      toast.success("Sichtbarkeit aktualisiert.");
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setTaskBusy(task.id, false, Action.ToggleVisibility);
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
      toast.error("Bitte zuerst Bilder auswählen.");
      return;
    }

    setTaskBusy(taskId, true, Action.UploadImages);

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

      toast.success("Bilder hochgeladen.");
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setTaskBusy(taskId, false, Action.UploadImages);
    }
  }

  async function handleDeleteImage(taskId: string, imageId: string) {
    setTaskBusy(taskId, true, Action.DeleteImage);

    try {
      await requestJson<{ ok: true }>(
        `/api/tasks/${taskId}/images/${imageId}`,
        {
          method: "DELETE",
        },
      );

      toast.success("Bild gelöscht.");
      await refreshTasks({ keepLoadingState: true });
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setTaskBusy(taskId, false, Action.DeleteImage);
    }
  }

  async function handleAddEmailRecipient(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalized = emailInput.trim().toLowerCase();

    if (!normalized) {
      toast.error("Bitte eine E-Mail eingeben.");
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
      toast.success("E-Mail hinzugefuegt.");
      await refreshEmailRecipients();
    } catch (error) {
      toast.error(toMessage(error));
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

      toast.success("E-Mail entfernt.");
      await refreshEmailRecipients();
    } catch (error) {
      toast.error(toMessage(error));
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

            {isAdmin ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? <Spinner /> : <LogOut className="size-4" aria-hidden="true" />}
                Logout
              </Button>
            ) : null}

            {!isAdmin ? (
              <LoginForm
                loginPassword={loginPassword}
                setLoginPassword={setLoginPassword}
                isLoggingIn={isLoggingIn}
                handleLoginSubmit={handleLoginSubmit}
              />
            ) : null}
          </div>
        </header>

        {isAdmin ? (
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <NewEntryForm
              handleCreateTask={handleCreateTask}
              createForm={createForm}
              setCreateForm={setCreateForm}
              isCreatingTask={isCreatingTask}
            />

            <MailingList
              emailInput={emailInput}
              setEmailInput={setEmailInput}
              emailRecipients={emailRecipients}
              isLoadingEmailRecipients={isLoadingEmailRecipients}
              handleAddEmailRecipient={handleAddEmailRecipient}
              handleRemoveEmailRecipient={handleRemoveEmailRecipient}
            />
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
                onParticipantsChanged={() => refreshTasks({ keepLoadingState: true })}
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
                onParticipantsChanged={() => refreshTasks({ keepLoadingState: true })}
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

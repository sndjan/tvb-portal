"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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

export function useHomeClient() {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [activeTab, setActiveTab] = useState<TaskStatus>("open");

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
      const isRangeMode = createForm.scheduleType === "range";
      const startDateInput = isRangeMode
        ? createForm.rangeStartDate.trim()
        : createForm.startDateTime.trim();
      const endDateInput = isRangeMode ? createForm.rangeEndDate.trim() : "";

      const payload = {
        title: createForm.title,
        description: createForm.description,
        startDate: isRangeMode
          ? startDateInput || null
          : fromDateTimeLocalValue(startDateInput),
        endDate: isRangeMode ? endDateInput || null : null,
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
    event: React.SubmitEvent<HTMLFormElement>,
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

  return {
    activeTab,
    setActiveTab,
    isAdmin,
    isLoadingTasks,
    loginPassword,
    setLoginPassword,
    isLoggingIn,
    isLoggingOut,
    createForm,
    setCreateForm,
    isCreatingTask,
    editingTaskId,
    editForm,
    setEditForm,
    busyTaskIds,
    emailRecipients,
    isLoadingEmailRecipients,
    emailInput,
    setEmailInput,
    pendingUploads,
    openTasks,
    doneTasks,
    listedTasks,
    refreshTasks,
    handleLoginSubmit,
    handleLogout,
    handleCreateTask,
    startEditTask,
    handleSaveEdit,
    handleDeleteTask,
    toggleTaskStatus,
    toggleTaskVisibility,
    updateUploadSelection,
    handleUploadImages,
    handleDeleteImage,
    handleAddEmailRecipient,
    handleRemoveEmailRecipient,
    onCancelEdit: () => {
      setEditingTaskId(null);
      setEditForm(null);
    },
  };
}

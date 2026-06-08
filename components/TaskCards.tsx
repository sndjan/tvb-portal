"use client";

import { useEffect, useMemo, useState } from "react";

import { requestJson } from "@/lib/api";
import {
  Action,
  BusyTask,
  ParticipantHistoryRecord,
  PendingUpload,
  TaskFormState,
  TaskWithDetails,
} from "@/lib/types";
import {
  baseFieldClass,
  cn,
  formatDateRange,
  formatDateTime,
  toMessage,
} from "@/lib/utils";
import {
  CalendarDays,
  CalendarPlus,
  Clock3,
  Eye,
  EyeOff,
  History,
  ImagePlus,
  Info,
  ListChecks,
  Mail,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { TaskForm } from "./NewEntryForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Button, buttonVariants } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Spinner } from "./ui/spinner";

const TECHNICAL_CONTACT_NAME = process.env.NEXT_PUBLIC_TECHNICAL_CONTACT_NAME;
const TECHNICAL_CONTACT_EMAIL = process.env.NEXT_PUBLIC_TECHNICAL_CONTACT_EMAIL;

function AdminAddParticipantForm({
  taskId,
  onAdded,
}: {
  taskId: string;
  onAdded: () => void | Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAdd() {
    const fn = firstName.trim();
    const ln = lastName.trim();

    if (!fn || !ln) {
      toast.error("Bitte Vor- und Nachname eingeben.");
      return;
    }

    setIsSubmitting(true);

    try {
      await requestJson(`/api/tasks/${taskId}/participants`, {
        method: "POST",
        body: JSON.stringify({ firstName: fn, lastName: ln }),
      });
      setFirstName("");
      setLastName("");
      toast.success("Teilnehmer hinzugefügt.");
      await onAdded();
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-3 flex gap-2">
      <Input
        className={baseFieldClass}
        placeholder="Vorname"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        disabled={isSubmitting}
      />
      <Input
        className={baseFieldClass}
        placeholder="Nachname"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        disabled={isSubmitting}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void handleAdd()}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <Spinner />
        ) : (
          <UserPlus className="size-4" aria-hidden="true" />
        )}
        Hinzufügen
      </Button>
    </div>
  );
}

type TaskCardsProps = {
  tasks: TaskWithDetails[];
  isAdmin: boolean;
  editingTaskId: string | null;
  editForm: TaskFormState | null;
  busyTaskIds: BusyTask[];
  pendingUploads: Record<string, PendingUpload>;
  onStartEdit: (task: TaskWithDetails) => void;
  onCancelEdit: () => void;
  onChangeEditForm: (value: TaskFormState) => void;
  onSaveEdit: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleStatus: (task: TaskWithDetails) => void;
  onToggleVisibility: (task: TaskWithDetails) => void;
  onSelectUpload: (taskId: string, files: FileList | null) => void;
  onUploadImages: (taskId: string) => void;
  onDeleteImage: (taskId: string, imageId: string) => void;
  onSendEmail: (taskId: string) => void;
  onParticipantsChanged?: () => void | Promise<void>;
};

export const TaskCards = ({
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
  onSendEmail,
  onParticipantsChanged,
}: TaskCardsProps) => {
  const [dialogTaskId, setDialogTaskId] = useState<string | null>(null);
  const [mailConfirmTaskId, setMailConfirmTaskId] = useState<string | null>(
    null,
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [removingParticipantId, setRemovingParticipantId] = useState<
    string | null
  >(null);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);
  const [isRegistrationSubmitting, setIsRegistrationSubmitting] =
    useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);
  const [historyByTaskId, setHistoryByTaskId] = useState<
    Record<string, ParticipantHistoryRecord[]>
  >({});
  const [historyDialogTaskId, setHistoryDialogTaskId] = useState<string | null>(
    null,
  );

  async function fetchHistory(taskId: string) {
    try {
      const data = await requestJson<{ history: ParticipantHistoryRecord[] }>(
        `/api/tasks/${taskId}/history`,
        { method: "GET" },
      );
      setHistoryByTaskId((prev) => ({ ...prev, [taskId]: data.history }));
    } catch {
      // non-critical
    }
  }

  function openHistoryDialog(taskId: string) {
    setHistoryDialogTaskId(taskId);
    void fetchHistory(taskId);
  }

  const dialogTask = useMemo(
    () => tasks.find((task) => task.id === dialogTaskId) ?? null,
    [tasks, dialogTaskId],
  );

  async function checkRegistration(taskId: string, fn: string, ln: string) {
    const normalizedFirstName = fn.trim();
    const normalizedLastName = ln.trim();

    if (!normalizedFirstName || !normalizedLastName) {
      setIsRegistered(false);
      return;
    }

    setIsCheckingRegistration(true);

    try {
      const params = new URLSearchParams({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
      });

      const data = await requestJson<{ isRegistered?: boolean }>(
        `/api/tasks/${taskId}/participants?${params.toString()}`,
        { method: "GET" },
      );

      setIsRegistered(Boolean(data.isRegistered));
    } catch (error) {
      toast.error(toMessage(error));
      setIsRegistered(false);
    } finally {
      setIsCheckingRegistration(false);
    }
  }

  async function handleRegister(taskId: string) {
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();

    if (!normalizedFirstName || !normalizedLastName) {
      toast.error("Bitte Vor- und Nachname eingeben.");
      return;
    }

    setIsRegistrationSubmitting(true);

    try {
      await requestJson<{ ok?: true }>(`/api/tasks/${taskId}/participants`, {
        method: "POST",
        body: JSON.stringify({
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
        }),
      });

      setIsRegistered(true);
      setShowRegistrationSuccess(true);
      toast.success("Erfolgreich angemeldet.");
      await onParticipantsChanged?.();
      void fetchHistory(taskId);
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setIsRegistrationSubmitting(false);
    }
  }

  async function handleUnregister(taskId: string) {
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();

    if (!normalizedFirstName || !normalizedLastName) {
      toast.error("Bitte Vor- und Nachname eingeben.");
      return;
    }

    setIsRegistrationSubmitting(true);

    try {
      await requestJson<{ ok: true }>(`/api/tasks/${taskId}/participants`, {
        method: "DELETE",
        body: JSON.stringify({
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
        }),
      });

      setIsRegistered(false);
      setShowRegistrationSuccess(false);
      toast.success("Abmeldung erfolgreich.");
      await onParticipantsChanged?.();
      void fetchHistory(taskId);
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setIsRegistrationSubmitting(false);
    }
  }

  async function handleAdminRemoveParticipant(
    taskId: string,
    participant: { id: string; firstName: string; lastName: string },
  ) {
    setRemovingParticipantId(participant.id);

    try {
      await requestJson<{ ok: true }>(`/api/tasks/${taskId}/participants`, {
        method: "DELETE",
        body: JSON.stringify({
          firstName: participant.firstName,
          lastName: participant.lastName,
        }),
      });

      toast.success("Teilnehmer abgemeldet.");
      await onParticipantsChanged?.();
      void fetchHistory(taskId);
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setRemovingParticipantId(null);
    }
  }

  useEffect(() => {
    if (!dialogTaskId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void checkRegistration(dialogTaskId, firstName, lastName);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dialogTaskId, firstName, lastName]);

  function closeDialog() {
    setDialogTaskId(null);
    setIsRegistered(false);
    setShowRegistrationSuccess(false);
  }

  return (
    <>
      <div className="grid gap-4">
        {tasks
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .map((task) => {
            const taskBusy = busyTaskIds.find((busy) => busy.id === task.id);
            const isBusy = Boolean(taskBusy?.busy);
            const isOpen = task.status === "open";
            const firstImage = task.images[0];

            const isSendingEmail =
              isBusy && taskBusy?.busyAction === Action.SendEmail;
            const isDeleting =
              isBusy && taskBusy?.busyAction === Action.DeleteTask;
            const isUploading =
              isBusy && taskBusy?.busyAction === Action.UploadImages;
            const isDeletingImage =
              isBusy && taskBusy?.busyAction === Action.DeleteImage;
            const isTogglingStatus =
              isBusy && taskBusy?.busyAction === Action.ToggleStatus;
            const isTogglingVisibility =
              isBusy && taskBusy?.busyAction === Action.ToggleVisibility;
            const isSavingEdit =
              isBusy && taskBusy?.busyAction === Action.SaveEdit;

            const isEditing = editingTaskId === task.id && Boolean(editForm);
            const upload = pendingUploads[task.id];

            return (
              <Card
                key={task.id}
                className={`relative bg-transparent text-black border-l-4 ${isOpen ? "border-l-primary/80" : ""}`}
              >
                <div className="absolute inset-0">
                  {firstImage ? (
                    <Image
                      src={firstImage.url}
                      alt=""
                      aria-hidden="true"
                      fill
                      className="object-cover object-center"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-background/85" />
                </div>
                <CardHeader className="relative gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base sm:text-lg font-bold">
                        {task.title}
                      </CardTitle>
                      <CardDescription className="text-black">
                        {task.description}
                      </CardDescription>
                    </div>
                    {/* <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {task.status === "open" ? (
                        <Badge
                          variant={"default"}
                          className="bg-[#eaf4d4] text-primary tracking-wider font-bold"
                        >
                          Offen
                        </Badge>
                      ) : (
                        <Badge
                          variant={"secondary"}
                          className="tracking-wider text-[#666666] font-bold"
                        >
                          <Check strokeWidth={3} />
                          Erledigt
                        </Badge>
                      )}
                      {task.isHidden ? (
                        <Badge
                          variant="outline"
                          className="gap-1 tracking-wider font-bold"
                        >
                          <EyeOff className="size-3" aria-hidden="true" />
                          Versteckt
                        </Badge>
                      ) : null}
                    </div> */}
                  </div>
                </CardHeader>

                <CardContent className="relative grid gap-3 text-sm">
                  {/* {firstImage ? (
                  <div className="overflow-hidden rounded-lg border bg-muted/10">
                    <img
                      src={firstImage.url}
                      alt={`Vorschaubild zu ${task.title}`}
                      className="h-44 w-full object-cover sm:h-56"
                    />
                  </div>
                ) : null}*/}

                  {task.materials ? (
                    <p className="flex items-start gap-2 text-black">
                      <Wrench
                        className="size-4 shrink-0 mt-1"
                        color="#000000"
                        aria-hidden="true"
                      />
                      {task.materials}
                    </p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 pb-4">
                    <p className="flex items-center gap-2 text-black">
                      <CalendarDays
                        className="size-4"
                        color="#000000"
                        aria-hidden="true"
                      />
                      {formatDateRange(task)}
                    </p>
                    {task.durationEstimate !== null &&
                      task.durationEstimate !== "" && (
                        <p className="flex items-center gap-2 text-black">
                          <Clock3
                            className="size-4"
                            color="#000000"
                            aria-hidden="true"
                          />
                          {task.durationEstimate === "1"
                            ? "1 Stunde"
                            : `${task.durationEstimate} Stunden`}
                        </p>
                      )}
                    <p className="flex items-center gap-2 text-black">
                      <Users
                        className="size-4"
                        color="#000000"
                        aria-hidden="true"
                      />
                      {task.participantCount}
                      {task.maxParticipants !== null
                        ? ` von max. ${task.maxParticipants}`
                        : ""}{" "}
                      Teilnehmer
                      {task.maxParticipants !== null && task.maxParticipants > 1
                        ? "n"
                        : ""}
                    </p>
                  </div>

                  {isAdmin ? (
                    <div className="grid gap-3">
                      {/* Participants box */}
                      <div className="grid gap-3 rounded-lg border bg-white p-3">
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-sm font-medium">
                              Eingetragene Teilnehmer
                            </h3>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => openHistoryDialog(task.id)}
                              aria-label="Verlauf anzeigen"
                            >
                              <History className="size-3" aria-hidden="true" />
                            </Button>
                          </div>
                          {task.participants && task.participants.length > 0 ? (
                            <ol className="grid list-decimal gap-1 pl-6 text-sm">
                              {task.participants.map((participant) => (
                                <li key={participant.id} className=" py-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span>
                                      {participant.firstName}{" "}
                                      {participant.lastName}
                                    </span>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          type="button"
                                          size="icon-xs"
                                          variant="ghost"
                                          className="text-destructive hover:text-destructive"
                                          disabled={
                                            removingParticipantId ===
                                            participant.id
                                          }
                                          aria-label={`${participant.firstName} ${participant.lastName} austragen`}
                                        >
                                          {removingParticipantId ===
                                          participant.id ? (
                                            <Spinner />
                                          ) : (
                                            <Trash2
                                              className="size-3"
                                              aria-hidden="true"
                                            />
                                          )}
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>
                                            Teilnehmer austragen?
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            {participant.firstName}{" "}
                                            {participant.lastName}&nbsp;wird von
                                            &quot;
                                            {task.title}&quot; ausgetragen.
                                            Diese Aktion kann nicht rückgängig
                                            gemacht werden.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>
                                            Abbrechen
                                          </AlertDialogCancel>
                                          <AlertDialogAction
                                            className={buttonVariants({
                                              variant: "destructive",
                                            })}
                                            onClick={() =>
                                              void handleAdminRemoveParticipant(
                                                task.id,
                                                participant,
                                              )
                                            }
                                          >
                                            Austragen
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Keine Teilnehmer vorhanden.
                            </p>
                          )}
                        </div>

                        <AdminAddParticipantForm
                          taskId={task.id}
                          onAdded={async () => {
                            await onParticipantsChanged?.();
                            void fetchHistory(task.id);
                          }}
                        />
                      </div>

                      {/* Image box */}
                      {/* <div className="rounded-lg border bg-white p-3">
                        <h3 className="mb-2 text-sm font-medium">
                          Hintergrundbild
                        </h3>
                        {firstImage ? (
                          <div className="relative inline-block overflow-hidden rounded-md border">
                            <Image
                              src={firstImage.url}
                              alt="Hintergrundbild"
                              width={160}
                              height={96}
                              className="h-24 w-auto object-cover"
                            />
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="destructive"
                              className="absolute top-1 right-1 bg-white hover:bg-white/90"
                              onClick={() =>
                                onDeleteImage(task.id, firstImage.id)
                              }
                              disabled={isBusy}
                              aria-label="Bild löschen"
                            >
                              {isDeletingImage ? (
                                <Spinner />
                              ) : (
                                <Trash2 className="size-3" aria-hidden="true" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <div className="grid gap-2">
                            <Input
                              type="file"
                              accept="image/*"
                              className={baseFieldClass}
                              onChange={(e) =>
                                onSelectUpload(task.id, e.currentTarget.files)
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onUploadImages(task.id)}
                              disabled={
                                isBusy || !upload || upload.files.length === 0
                              }
                            >
                              {isUploading ? (
                                <Spinner />
                              ) : (
                                <ImagePlus
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              )}
                              Bild hochladen
                            </Button>
                          </div>
                        )}
                      </div> */}
                    </div>
                  ) : null}

                  {!isAdmin && !task.isHidden && task.status !== "done" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        setDialogTaskId(task.id);
                        await checkRegistration(task.id, firstName, lastName);
                      }}
                    >
                      <UserPlus className="size-4" aria-hidden="true" />
                      Ein- / Austragen
                    </Button>
                  ) : null}

                  {!isAdmin && task.startDate ? (
                    <a
                      href={`/api/tasks/${task.id}/ics`}
                      download
                      className={cn(
                        buttonVariants({
                          variant: "outline",
                          size: "sm",
                        }),
                      )}
                    >
                      <CalendarPlus className="size-4" aria-hidden="true" />
                      Zum Kalender hinzufügen
                    </a>
                  ) : null}

                  {isAdmin && isEditing && editForm ? (
                    <div className="grid gap-3 rounded-lg border bg-white p-3">
                      <h3 className="text-sm font-medium">
                        Einsatz bearbeiten
                      </h3>
                      <TaskForm
                        mode="edit"
                        form={editForm}
                        setForm={(v) => onChangeEditForm(v)}
                        isPending={isSavingEdit}
                        onSubmit={(e) => {
                          e.preventDefault();
                          void onSaveEdit(task.id);
                        }}
                        onCancel={onCancelEdit}
                      />
                    </div>
                  ) : null}
                </CardContent>

                {isAdmin ? (
                  <CardFooter className="relative flex flex-wrap gap-2 border-t">
                    {task.startDate ? (
                      <a
                        href={`/api/tasks/${task.id}/ics`}
                        download
                        className={cn(
                          buttonVariants({
                            variant: "outline",
                            size: "sm",
                            className: "border",
                          }),
                        )}
                      >
                        <CalendarPlus className="size-4" aria-hidden="true" />
                        Zum Kalender hinzufügen
                      </a>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onToggleStatus(task)}
                      disabled={isBusy}
                    >
                      {isTogglingStatus ? (
                        <Spinner />
                      ) : (
                        <ListChecks className="size-4" aria-hidden="true" />
                      )}
                      Status:{" "}
                      {task.status === "open" ? "Auf Erledigt" : "Auf Offen"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onToggleVisibility(task)}
                      disabled={isBusy}
                    >
                      {task.isHidden ? (
                        <>
                          {isTogglingVisibility ? (
                            <Spinner />
                          ) : (
                            <Eye className="size-4" aria-hidden="true" />
                          )}
                          Sichtbar machen
                        </>
                      ) : (
                        <>
                          {isTogglingVisibility ? (
                            <Spinner />
                          ) : (
                            <EyeOff className="size-4" aria-hidden="true" />
                          )}
                          Verstecken
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onStartEdit(task)}
                      disabled={isBusy || isEditing}
                    >
                      {isSavingEdit ? (
                        <Spinner />
                      ) : (
                        <Pencil className="size-4" aria-hidden="true" />
                      )}
                      Bearbeiten
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setMailConfirmTaskId(task.id)}
                      disabled={isBusy}
                    >
                      {isSendingEmail ? (
                        <Spinner />
                      ) : (
                        <Mail className="size-4" aria-hidden="true" />
                      )}
                      Mail senden
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={isBusy}
                        >
                          {isDeleting ? (
                            <Spinner />
                          ) : (
                            <Trash2 className="size-4" aria-hidden="true" />
                          )}
                          Löschen
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Arbeitseinsatz löschen?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            &quot;{task.title}&quot; wird dauerhaft gelöscht.
                            Diese Aktion kann nicht rückgängig gemacht werden.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction
                            className={buttonVariants({
                              variant: "destructive",
                            })}
                            onClick={() => onDeleteTask(task.id)}
                          >
                            Löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                ) : null}
              </Card>
            );
          })}
      </div>

      <Dialog
        open={Boolean(dialogTaskId)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
          }
        }}
      >
        {dialogTask ? (
          showRegistrationSuccess ? (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Anmeldung erfolgreich</DialogTitle>
                <DialogDescription>
                  Du hast dich für &quot;{dialogTask.title}&quot; angemeldet.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2 text-primary font-medium">
                    <Info size={16} />
                    <p className="font-medium text-foreground">Infos</p>
                  </div>
                  <ul className="grid gap-2">
                    <li>Du kannst dich jederzeit wieder abmelden.</li>
                    <li className="font-medium text-foreground">
                      Melde dich bitte danach bei {TECHNICAL_CONTACT_NAME} oder{" "}
                      {TECHNICAL_CONTACT_EMAIL}, um die Stunden zu
                      dokumentieren.
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Kontakt für Rückfragen
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    Technische Leitung - {TECHNICAL_CONTACT_NAME}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Wenn du weitere Infos brauchst, wende dich bitte an{" "}
                    {TECHNICAL_CONTACT_NAME} oder per E-Mail an{" "}
                    <a
                      href={`mailto:${TECHNICAL_CONTACT_EMAIL}`}
                      className="underline underline-offset-4"
                    >
                      {TECHNICAL_CONTACT_EMAIL}
                    </a>
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" onClick={closeDialog}>
                  Fertig
                </Button>
              </DialogFooter>
            </DialogContent>
          ) : (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ein- / Austragen</DialogTitle>
                <DialogDescription>
                  {dialogTask
                    ? `Gib deinen Namen ein, um dich für "${dialogTask.title}" einzutragen, oder falls bereits eingetragen, auszutragen.`
                    : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                {/* <p className="text-sm text-muted-foreground">
                  Aktuelle Anmeldungen: {dialogTask.participantCount}
                  {dialogTask.maxParticipants !== null
                    ? ` / ${dialogTask.maxParticipants}`
                    : ""}
                </p> */}

                <Input
                  className={baseFieldClass}
                  placeholder="Vorname"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
                <Input
                  className={baseFieldClass}
                  placeholder="Nachname"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />

                {/* <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => {
                      const nextRemember = event.target.checked;
                      setRememberMe(nextRemember);

                      if (!nextRemember) {
                        localStorage.removeItem(STORAGE_KEY);
                      } else {
                        persistProfile(firstName, lastName, true);
                      }
                    }}
                  />
                  Namen merken
                </label> */}

                {isCheckingRegistration ? (
                  <p className="text-sm text-muted-foreground">
                    Status wird geprüft...
                  </p>
                ) : isRegistered ? (
                  <p className="text-sm text-muted-foreground">
                    Du bist bereits eingetragen.
                  </p>
                ) : dialogTask.maxParticipants !== null &&
                  dialogTask.participantCount >= dialogTask.maxParticipants ? (
                  <p className="text-sm text-muted-foreground">
                    Leider ist die maximale Teilnehmerzahl bereits erreicht.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Du bist aktuell nicht eingetragen.
                  </p>
                )}
              </div>
              <DialogFooter>
                <>
                  {isRegistered ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => void handleUnregister(dialogTask.id)}
                      disabled={isRegistrationSubmitting}
                    >
                      {isRegistrationSubmitting ? <Spinner /> : null}
                      Austragen
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => void handleRegister(dialogTask.id)}
                      disabled={
                        isRegistrationSubmitting ||
                        (dialogTask.maxParticipants !== null &&
                          dialogTask.participantCount >=
                            dialogTask.maxParticipants) ||
                        isCheckingRegistration
                      }
                    >
                      {isRegistrationSubmitting || isCheckingRegistration ? (
                        <Spinner />
                      ) : null}
                      {isCheckingRegistration ? "Prüfe..." : "Eintragen"}
                    </Button>
                  )}
                </>
              </DialogFooter>
            </DialogContent>
          )
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(historyDialogTaskId)}
        onOpenChange={(open) => {
          if (!open) setHistoryDialogTaskId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verlauf</DialogTitle>
            <DialogDescription>
              An- und Abmeldungen für diesen Einsatz
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {historyDialogTaskId ? (
              !historyByTaskId[historyDialogTaskId] ? (
                <p className="text-sm text-muted-foreground">Lade Verlauf…</p>
              ) : historyByTaskId[historyDialogTaskId].length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Kein Verlauf vorhanden.
                </p>
              ) : (
                <ol className="grid gap-1">
                  {historyByTaskId[historyDialogTaskId].map((entry) => (
                    <li
                      key={entry.id}
                      className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 rounded px-2 py-1.5 text-xs odd:bg-muted/30"
                    >
                      <span className="font-medium">
                        {entry.firstName} {entry.lastName}
                      </span>
                      <span className="text-right text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </span>
                      <span
                        className={
                          entry.action === "registered"
                            ? "text-primary"
                            : "text-destructive"
                        }
                      >
                        {entry.action === "registered"
                          ? "Angemeldet"
                          : "Abgemeldet"}
                      </span>
                      <span className="text-right text-muted-foreground">
                        {entry.performedBy === "admin"
                          ? "durch Admin"
                          : "selbst"}
                      </span>
                    </li>
                  ))}
                </ol>
              )
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setHistoryDialogTaskId(null)}
            >
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(mailConfirmTaskId)}
        onOpenChange={(open) => {
          if (!open) setMailConfirmTaskId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>E-Mail an Verteilerliste senden?</DialogTitle>
            <DialogDescription>
              Möchtest du wirklich eine Benachrichtigung zu diesem
              Arbeitseinsatz an alle Personen in der Verteilerliste senden?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMailConfirmTaskId(null)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (mailConfirmTaskId) onSendEmail(mailConfirmTaskId);
                setMailConfirmTaskId(null);
              }}
            >
              Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

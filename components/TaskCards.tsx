"use client";

import { useEffect, useMemo, useState } from "react";

import { requestJson } from "@/lib/api";
import {
  Action,
  BusyTask,
  PendingUpload,
  TaskFormState,
  TaskWithDetails,
} from "@/lib/types";
import { baseFieldClass, formatDateRange, toMessage } from "@/lib/utils";
import { TaskForm } from "./NewEntryForm";
import {
  CalendarDays,
  Check,
  Clock3,
  Eye,
  EyeOff,
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
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
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

const STORAGE_KEY = "tvb-registration-profile";
const TECHNICAL_CONTACT_NAME = process.env.NEXT_PUBLIC_TECHNICAL_CONTACT_NAME;
const TECHNICAL_CONTACT_EMAIL = process.env.NEXT_PUBLIC_TECHNICAL_CONTACT_EMAIL;

function getStoredProfile(): { firstName: string; lastName: string } | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as {
      firstName?: string;
      lastName?: string;
    };

    if (!parsed.firstName || !parsed.lastName) {
      return null;
    }

    return {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
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
  // pendingUploads,
  onStartEdit,
  onCancelEdit,
  onChangeEditForm,
  onSaveEdit,
  onDeleteTask,
  onToggleStatus,
  onToggleVisibility,
  // onSelectUpload,
  // onUploadImages,
  // onDeleteImage,
  onSendEmail,
  onParticipantsChanged,
}: TaskCardsProps) => {
  const [storedProfile] = useState(getStoredProfile);
  const [dialogTaskId, setDialogTaskId] = useState<string | null>(null);
  const [mailConfirmTaskId, setMailConfirmTaskId] = useState<string | null>(
    null,
  );
  const [firstName, setFirstName] = useState(storedProfile?.firstName ?? "");
  const [lastName, setLastName] = useState(storedProfile?.lastName ?? "");
  const [rememberMe, setRememberMe] = useState(Boolean(storedProfile));
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);
  const [isRegistrationSubmitting, setIsRegistrationSubmitting] =
    useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);

  const dialogTask = useMemo(
    () => tasks.find((task) => task.id === dialogTaskId) ?? null,
    [tasks, dialogTaskId],
  );

  function persistProfile(
    nextFirstName: string,
    nextLastName: string,
    shouldRemember = rememberMe,
  ) {
    if (!shouldRemember) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        firstName: nextFirstName.trim(),
        lastName: nextLastName.trim(),
      }),
    );
  }

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

      persistProfile(normalizedFirstName, normalizedLastName);
      setIsRegistered(true);
      setShowRegistrationSuccess(true);
      toast.success("Erfolgreich angemeldet.");
      await onParticipantsChanged?.();
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

      persistProfile(normalizedFirstName, normalizedLastName);
      setIsRegistered(false);
      setShowRegistrationSuccess(false);
      toast.success("Abmeldung erfolgreich.");
      await onParticipantsChanged?.();
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setIsRegistrationSubmitting(false);
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
            // const firstImage = task.images[0];

            const isSendingEmail =
              isBusy && taskBusy?.busyAction === Action.SendEmail;
            const isDeleting =
              isBusy && taskBusy?.busyAction === Action.DeleteTask;
            // const isUploading =
            //   isBusy && taskBusy?.busyAction === Action.UploadImages;
            const isTogglingStatus =
              isBusy && taskBusy?.busyAction === Action.ToggleStatus;
            const isTogglingVisibility =
              isBusy && taskBusy?.busyAction === Action.ToggleVisibility;
            const isSavingEdit =
              isBusy && taskBusy?.busyAction === Action.SaveEdit;

            const isEditing = editingTaskId === task.id && Boolean(editForm);
            // const upload = pendingUploads[task.id];

            return (
              <Card
                key={task.id}
                className={`border-l-4 ${isOpen ? "border-l-primary/80" : ""}`}
              >
                <CardHeader className="gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base sm:text-lg">
                        {task.title}
                      </CardTitle>
                      <CardDescription>{task.description}</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
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
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="grid gap-3 text-sm">
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
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Wrench className="size-4" aria-hidden="true" />
                      {task.materials}
                    </p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 pb-4">
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="size-4" aria-hidden="true" />
                      {formatDateRange(task)}
                    </p>
                    {task.durationEstimate !== null &&
                      task.durationEstimate !== "" && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <Clock3 className="size-4" aria-hidden="true" />
                          {task.durationEstimate === "1"
                            ? "1 Stunde"
                            : `${task.durationEstimate} Stunden`}
                        </p>
                      )}
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Users className="size-4" aria-hidden="true" />
                      {task.participantCount}
                      {task.maxParticipants !== null
                        ? ` von ${task.maxParticipants}`
                        : ""}{" "}
                      Anmeldung{task.maxParticipants === 1 ? "" : "en"}
                    </p>
                  </div>

                  {isAdmin ? (
                    <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
                      <div>
                        <h3 className="mb-2 text-sm font-medium">
                          Angemeldete Teilnehmer
                        </h3>
                        {task.participants && task.participants.length > 0 ? (
                          <ul className="grid gap-1 text-sm">
                            {task.participants.map((participant) => (
                              <li
                                key={participant.id}
                                className="rounded-md border px-2 py-1"
                              >
                                {participant.firstName} {participant.lastName}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Keine Teilnehmer vorhanden.
                          </p>
                        )}
                      </div>

                      {/* <div>
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
                          {isUploading ? (
                            <Spinner />
                          ) : (
                            <ImagePlus className="size-4" aria-hidden="true" />
                          )}
                          Bilder hochladen
                        </Button>
                      </div>
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
                      An- / Abmelden
                    </Button>
                  ) : null}

                  {isAdmin && isEditing && editForm ? (
                    <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
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
                  <CardFooter className="flex flex-wrap gap-2 border-t">
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
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => onDeleteTask(task.id)}
                      disabled={isBusy}
                    >
                      {isDeleting ? (
                        <Spinner />
                      ) : (
                        <Trash2 className="size-4" aria-hidden="true" />
                      )}
                      Löschen
                    </Button>
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
                  Deine Anmeldung für &quot;{dialogTask.title}&quot; wurde
                  gespeichert.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2 text-primary font-medium">
                    <Info size={16} />
                    <p className="font-medium text-foreground">Infos</p>
                  </div>
                  <ul className="grid gap-2">
                    <li>Du kannst diese Anmeldung jederzeit wieder ändern.</li>
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
                <DialogTitle>An- / Abmeldung</DialogTitle>
                <DialogDescription>
                  {dialogTask
                    ? `Melde dich für "${dialogTask.title}" an oder wieder ab.`
                    : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <p className="text-sm text-muted-foreground">
                  Aktuelle Anmeldungen: {dialogTask.participantCount}
                  {dialogTask.maxParticipants !== null
                    ? ` / ${dialogTask.maxParticipants}`
                    : ""}
                </p>

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
                    Du bist bereits angemeldet.
                  </p>
                ) : dialogTask.maxParticipants !== null &&
                  dialogTask.participantCount >= dialogTask.maxParticipants ? (
                  <p className="text-sm text-muted-foreground">
                    Leider ist die maximale Teilnehmerzahl bereits erreicht.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Du bist aktuell nicht angemeldet.
                  </p>
                )}
              </div>
              <DialogFooter>
                <>
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Schließen
                  </Button>

                  {isRegistered ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => void handleUnregister(dialogTask.id)}
                      disabled={isRegistrationSubmitting}
                    >
                      {isRegistrationSubmitting ? <Spinner /> : null}
                      Abmelden
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => void handleRegister(dialogTask.id)}
                      disabled={
                        isRegistrationSubmitting ||
                        (dialogTask.maxParticipants !== null &&
                          dialogTask.participantCount >=
                            dialogTask.maxParticipants)
                      }
                    >
                      {isRegistrationSubmitting ? <Spinner /> : null}
                      Anmelden
                    </Button>
                  )}
                </>
              </DialogFooter>
            </DialogContent>
          )
        ) : null}
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

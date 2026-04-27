"use client";

import { useEffect, useMemo, useState } from "react";

import { requestJson } from "@/lib/api";
import { TaskStatus } from "@/lib/tasks";
import {
  Action,
  BusyTask,
  EditTaskFormState,
  PendingUpload,
  TaskWithDetails,
} from "@/lib/types";
import { baseFieldClass, formatDateRange, toMessage } from "@/lib/utils";
import {
  CalendarDays,
  Clock3,
  Eye,
  EyeOff,
  ImagePlus,
  ListChecks,
  Pencil,
  Save,
  Trash2,
  UserPlus,
  Users,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Spinner } from "./ui/spinner";
import { Textarea } from "./ui/textarea";

const STORAGE_KEY = "tvb-registration-profile";

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
  editForm: EditTaskFormState | null;
  busyTaskIds: BusyTask[];
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
  onParticipantsChanged,
}: TaskCardsProps) => {
  const [storedProfile] = useState(getStoredProfile);
  const [dialogTaskId, setDialogTaskId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState(storedProfile?.firstName ?? "");
  const [lastName, setLastName] = useState(storedProfile?.lastName ?? "");
  const [rememberMe, setRememberMe] = useState(Boolean(storedProfile));
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);
  const [isRegistrationSubmitting, setIsRegistrationSubmitting] =
    useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

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

  return (
    <>
      <div className="grid gap-4">
        {tasks.map((task) => {
          const taskBusy = busyTaskIds.find((busy) => busy.id === task.id);
          const isBusy = Boolean(taskBusy?.busy);

          const isDeleting =
            isBusy && taskBusy?.busyAction === Action.DeleteTask;
          const isUploading =
            isBusy && taskBusy?.busyAction === Action.UploadImages;
          const isTogglingStatus =
            isBusy && taskBusy?.busyAction === Action.ToggleStatus;
          const isTogglingVisibility =
            isBusy && taskBusy?.busyAction === Action.ToggleVisibility;
          const isSavingEdit =
            isBusy && taskBusy?.busyAction === Action.SaveEdit;

          const isEditing = editingTaskId === task.id && Boolean(editForm);
          const upload = pendingUploads[task.id];

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
                          {isUploading ? (
                            <Spinner />
                          ) : (
                            <ImagePlus className="size-4" aria-hidden="true" />
                          )}
                          Bilder hochladen
                        </Button>
                      </div>
                    </div>
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
                        placeholder="Maximale Teilnehmer"
                        value={editForm.maxParticipants}
                        onChange={(event) =>
                          onChangeEditForm({
                            ...editForm,
                            maxParticipants: event.target.value,
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
                        {isSavingEdit ? (
                          <Spinner />
                        ) : (
                          <Save className="size-4" aria-hidden="true" />
                        )}
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
                    disabled={isBusy}
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
            setDialogTaskId(null);
            setIsRegistered(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anmeldung</DialogTitle>
            <DialogDescription>
              {dialogTask
                ? `Melde dich für "${dialogTask.title}" an oder wieder ab.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {dialogTask ? (
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

              <label className="inline-flex items-center gap-2 text-sm">
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
              </label>

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
          ) : null}

          <DialogFooter>
            {dialogTask ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogTaskId(null)}
                >
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
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

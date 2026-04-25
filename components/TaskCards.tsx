import { TaskStatus } from "@/lib/tasks";
import {
    Action,
    BusyTask,
    EditTaskFormState,
    PendingUpload,
    TaskWithDetails,
} from "@/lib/types";
import { baseFieldClass, formatDateRange } from "@/lib/utils";
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
    Users,
} from "lucide-react";
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
}: TaskCardsProps) => {
  return (
    <div className="grid gap-4">
      {tasks.map((task) => {
        const taskBusy = busyTaskIds.find((busy) => busy.id === task.id);
        const isBusy = Boolean(taskBusy?.busy);

        const isDeleting = isBusy && taskBusy?.busyAction === Action.DeleteTask;
        const isUploading = isBusy && taskBusy?.busyAction === Action.UploadImages;
        const isTogglingStatus =
          isBusy && taskBusy?.busyAction === Action.ToggleStatus;
        const isTogglingVisibility =
          isBusy && taskBusy?.busyAction === Action.ToggleVisibility;
        const isSavingEdit = isBusy && taskBusy?.busyAction === Action.SaveEdit;

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
                        </>)}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onStartEdit(task)}
                  disabled={isEditing}
                >
                    <Pencil className="size-4" aria-hidden="true" />
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
  );
};

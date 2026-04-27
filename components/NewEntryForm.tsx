import { CreateTaskFormState } from "@/lib/types";
import { baseFieldClass } from "@/lib/utils";
import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Checkbox } from "./ui/checkbox";

type NewEntryFormProps = {
  handleCreateTask: (event: React.SubmitEvent<HTMLFormElement>) => void;
  createForm: CreateTaskFormState;
  setCreateForm: React.Dispatch<React.SetStateAction<CreateTaskFormState>>;
  isCreatingTask: boolean;
};

export const NewEntryForm = ({
  handleCreateTask,
  createForm,
  setCreateForm,
  isCreatingTask,
}: NewEntryFormProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Neuen Einsatz erstellen</CardTitle>
        <CardDescription>
          Titel und Beschreibung sind Pflichtfelder. Datum und Uhrzeit sind
          optional. E-Mail Versand ist optional.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={handleCreateTask}>
          <Input
            className={baseFieldClass}
            placeholder="Titel *"
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
            placeholder="Beschreibung *"
            value={createForm.description}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
            required
          />

          <div className="grid gap-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Terminmodus
              <Select
                value={createForm.scheduleType}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    scheduleType: value as CreateTaskFormState["scheduleType"],
                    rangeStartDate:
                      value === "range" ? prev.rangeStartDate : "",
                    rangeEndDate: value === "range" ? prev.rangeEndDate : "",
                    startDateTime: value === "start" ? prev.startDateTime : "",
                  }))
                }
              >
                <SelectTrigger className={baseFieldClass}>
                  <SelectValue placeholder="Terminmodus wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="range">Zeitraum</SelectItem>
                  <SelectItem value="start">Startdatum mit Uhrzeit</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          {createForm.scheduleType === "range" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-muted-foreground">
                Startdatum (optional)
                <Input
                  type="date"
                  className={baseFieldClass}
                  value={createForm.rangeStartDate}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      rangeStartDate: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Enddatum (optional)
                <Input
                  type="date"
                  className={baseFieldClass}
                  value={createForm.rangeEndDate}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      rangeEndDate: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          ) : (
            <label className="grid gap-1 text-xs text-muted-foreground">
              Startdatum mit Uhrzeit (optional)
              <Input
                type="datetime-local"
                className={baseFieldClass}
                value={createForm.startDateTime}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    startDateTime: event.target.value,
                  }))
                }
              />
            </label>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              type="number"
              step="0.5"
              className={baseFieldClass}
              placeholder="Dauer in Stunden"
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
              placeholder="Max. benötigte Personen"
              value={createForm.maxParticipants}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  maxParticipants: event.target.value,
                }))
              }
            />
          </div>

          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center">
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={createForm.isHidden}
                onCheckedChange={(checked) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    isHidden: checked === true,
                  }))
                }
              />
              Versteckt (nur Admin)
            </label>

            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={createForm.sendEmail}
                onCheckedChange={(checked) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    sendEmail: checked === true,
                  }))
                }
              />
              E-Mail senden
            </label>
          </div>

          <div>
            <Button type="submit" disabled={isCreatingTask}>
              {isCreatingTask ? (
                <Spinner />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              Einsatz erstellen
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

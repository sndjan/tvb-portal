import { TaskFormState, TaskStatus } from "@/lib/types";
import { baseFieldClass } from "@/lib/utils";
import { Plus, Save } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
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

type TaskFormProps = {
  mode: "create" | "edit";
  form: TaskFormState;
  setForm: (value: TaskFormState) => void;
  isPending: boolean;
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
};

export const TaskForm = ({
  mode,
  form,
  setForm,
  isPending,
  onSubmit,
  onCancel,
}: TaskFormProps) => {
  const formContent = (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Titel *
        <Input
          className={baseFieldClass}
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          required
        />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Beschreibung *
        <Textarea
          className={`${baseFieldClass} min-h-24`}
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
          required
        />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Werkzeuge (optional)
        <Textarea
          className={`${baseFieldClass} min-h-20`}
          placeholder="z. B. Rasenmäher, Heckenschere – für Zugangscodes bitte beim Technischen Leiter melden"
          value={form.materials}
          onChange={(event) =>
            setForm({ ...form, materials: event.target.value })
          }
        />
      </label>

      <div className="grid gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Terminmodus
          <Select
            value={form.scheduleType}
            onValueChange={(value) =>
              setForm({
                ...form,
                scheduleType: value as TaskFormState["scheduleType"],
                rangeStartDate: value === "range" ? form.rangeStartDate : "",
                rangeEndDate: value === "range" ? form.rangeEndDate : "",
                startDateTime: value === "start" ? form.startDateTime : "",
              })
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

      {form.scheduleType === "range" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Startdatum (optional)
            <Input
              type="date"
              className={baseFieldClass}
              value={form.rangeStartDate}
              onChange={(event) =>
                setForm({ ...form, rangeStartDate: event.target.value })
              }
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Enddatum (optional)
            <Input
              type="date"
              className={baseFieldClass}
              value={form.rangeEndDate}
              onChange={(event) =>
                setForm({ ...form, rangeEndDate: event.target.value })
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
            value={form.startDateTime}
            onChange={(event) =>
              setForm({ ...form, startDateTime: event.target.value })
            }
          />
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Geschätzte Dauer (optional)
          <Input
            type="number"
            step="0.5"
            className={baseFieldClass}
            value={form.durationEstimate}
            onChange={(event) =>
              setForm({ ...form, durationEstimate: event.target.value })
            }
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Max. benötigte Personen (optional)
          <Input
            type="number"
            min={1}
            className={baseFieldClass}
            value={form.maxParticipants}
            onChange={(event) =>
              setForm({ ...form, maxParticipants: event.target.value })
            }
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center">
        <label className="inline-flex items-center gap-2">
          <Checkbox
            checked={form.isHidden}
            onCheckedChange={(checked) =>
              setForm({ ...form, isHidden: checked === true })
            }
          />
          Versteckt (nur für Admin sichtbar)
        </label>

        {mode === "create" ? (
          <label className="inline-flex items-center gap-2">
            <Checkbox
              checked={form.sendEmail}
              onCheckedChange={(checked) =>
                setForm({ ...form, sendEmail: checked === true })
              }
            />
            E-Mail an Verteilerliste senden
          </label>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Spinner />
          ) : mode === "create" ? (
            <Plus className="size-4" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {mode === "create" ? "Einsatz erstellen" : "Speichern"}
        </Button>
        {mode === "edit" && onCancel ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isPending}
          >
            Abbrechen
          </Button>
        ) : null}
      </div>
    </form>
  );

  if (mode === "edit") {
    return formContent;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Neuen Einsatz erstellen</CardTitle>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
};

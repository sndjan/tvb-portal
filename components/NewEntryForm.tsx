import { TaskStatus } from "@/lib/tasks";
import { baseFieldClass } from "@/lib/utils";
import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Spinner } from "./ui/spinner";
import { Textarea } from "./ui/textarea";

type NewEntryFormProps = {
    handleCreateTask: (event: React.SubmitEvent<HTMLFormElement>) => void;
    createForm: {
        title: string;
        description: string;
        startDate: string;
        endDate: string;
        durationEstimate: string;
        maxParticipants: string;
        status: TaskStatus;
        isHidden: boolean;
        sendEmail: boolean;
    };
    setCreateForm: React.Dispatch<
      React.SetStateAction<{
        title: string;
        description: string;
        startDate: string;
        endDate: string;
        durationEstimate: string;
        maxParticipants: string;
        status: TaskStatus;
        isHidden: boolean;
        sendEmail: boolean;
      }>
    >;
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
                    value={createForm.maxParticipants}
                    onChange={(event) =>
                    setCreateForm((prev) => ({
                        ...prev,
                        maxParticipants: event.target.value,
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
                    {isCreatingTask ? <Spinner /> : <Plus className="size-4" aria-hidden="true" />}
                    Einsatz erstellen
                </Button>
                </div>
            </form>
            </CardContent>
        </Card>
    );
};
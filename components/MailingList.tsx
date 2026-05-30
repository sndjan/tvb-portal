import { baseFieldClass } from "@/lib/utils";
import { Mail, Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";

type Recipient = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

type MailingListProps = {
  emailInput: string;
  setEmailInput: (email: string) => void;
  nameInput: string;
  setNameInput: (name: string) => void;
  emailRecipients: Recipient[];
  isLoadingEmailRecipients: boolean;
  handleAddEmailRecipient: (event: React.SubmitEvent<HTMLFormElement>) => void;
  handleRemoveEmailRecipient: (id: string) => void;
};

function formatRecipient(recipient: Recipient): string {
  const parts: string[] = [];
  if (recipient.lastName) parts.push(recipient.lastName);
  if (recipient.firstName) parts.push(recipient.firstName);
  const name = parts.join(" ");
  return name ? `${name} (${recipient.email})` : recipient.email;
}

export const MailingList = ({
  emailInput,
  setEmailInput,
  nameInput,
  setNameInput,
  emailRecipients,
  isLoadingEmailRecipients,
  handleAddEmailRecipient,
  handleRemoveEmailRecipient,
}: MailingListProps) => {
  return (
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
        <form onSubmit={handleAddEmailRecipient} className="grid gap-2">
          <Input
            type="text"
            className={baseFieldClass}
            placeholder="Nachname und Vorname"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            required
          />
          <div className="flex gap-2">
            <Input
              type="email"
              className={baseFieldClass}
              placeholder="email@beispiel.de"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              required
            />
            <Button
              type="submit"
              variant={"outline"}
              disabled={isLoadingEmailRecipients}
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </form>

        <div className="max-h-110 space-y-2 overflow-auto pr-1">
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
              <span className="min-w-0 flex-1 break-all">
                {formatRecipient(recipient)}
              </span>
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
  );
};

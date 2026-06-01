"use client";

import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { requestJson } from "@/lib/api";
import { MailListVariant } from "@/lib/types";
import { toMessage } from "@/lib/utils";
import { ManualMailList } from "./ManualMailList";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Spinner } from "./ui/spinner";

type ExternalMailContact = {
  id: number;
  email: string;
  vorname: string | null;
  nachname: string | null;
};

type ExternalMailListProps = {
  variant: MailListVariant;
  onVariantChange: (variant: MailListVariant) => void;
};

function getDisplayName(contact: ExternalMailContact): string | null {
  const parts = [contact.nachname, contact.vorname].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  return parts.length === 0 ? null : parts.join(" ");
}

export const ExternalMailList = ({
  variant,
  onVariantChange,
}: ExternalMailListProps) => {
  const [contacts, setContacts] = useState<ExternalMailContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (variant === "manual") return;

    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setIsLoading(true);
      }
      try {
        const data = await requestJson<{ contacts: ExternalMailContact[] }>(
          `/api/admin/external-mail-list?list=${variant}`,
          { method: "GET" },
        );
        if (!cancelled) {
          setContacts(data.contacts);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(toMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [variant]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" aria-hidden="true" />
          Verteilerliste
        </CardTitle>
        <CardDescription>
          {variant === "manual"
            ? "Manuell gepflegte E-Mail-Adressen."
            : "Kontakte aus der Brevo-Liste."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Select
          value={variant}
          onValueChange={(value) => onVariantChange(value as MailListVariant)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">TVB-Arbeit</SelectItem>
            <SelectItem value="testing">TVB-Arbeit TEST</SelectItem>
            <SelectItem value="manual">Manuelle Liste</SelectItem>
          </SelectContent>
        </Select>

        {variant === "manual" ? (
          <ManualMailList />
        ) : (
          <div className="max-h-125 space-y-2 overflow-auto pr-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Spinner />
              </div>
            ) : contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Kontakte in der Liste.
              </p>
            ) : (
              contacts.map((contact) => {
                const name = getDisplayName(contact);
                return (
                  <div
                    key={contact.id}
                    className="rounded-md border px-2 py-1.5 break-all"
                  >
                    {name ? (
                      <>
                        <div className="text-sm font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">
                          {contact.email}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm">{contact.email}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

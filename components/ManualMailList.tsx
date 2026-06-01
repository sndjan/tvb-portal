"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { requestJson } from "@/lib/api";
import { EmailRecipient } from "@/lib/types";
import { toMessage } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Spinner } from "./ui/spinner";

export const ManualMailList = () => {
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      const data = await requestJson<{ recipients: EmailRecipient[] }>(
        "/api/admin/manual-email-list",
        { method: "GET" },
      );
      setRecipients(data.recipients);
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    setIsAdding(true);
    try {
      const data = await requestJson<{ recipient: EmailRecipient }>(
        "/api/admin/manual-email-list",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );
      setRecipients((prev) => [...prev, data.recipient]);
      setEmailInput("");
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await requestJson<{ ok: true }>("/api/admin/manual-email-list", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      setRecipients((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid gap-3">
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          type="email"
          placeholder="E-Mail-Adresse"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          disabled={isAdding}
        />
        <Button type="submit" disabled={isAdding || !emailInput.trim()}>
          {isAdding ? <Spinner className="size-4" /> : "Hinzufügen"}
        </Button>
      </form>

      <div className="max-h-125 space-y-2 overflow-auto pr-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner />
          </div>
        ) : recipients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Einträge in der manuellen Liste.
          </p>
        ) : (
          recipients.map((recipient) => (
            <div
              key={recipient.id}
              className="flex items-center justify-between rounded-md border px-2 py-1.5"
            >
              <div className="text-sm break-all">{recipient.email}</div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(recipient.id)}
                disabled={deletingId === recipient.id}
                aria-label="Entfernen"
              >
                {deletingId === recipient.id ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

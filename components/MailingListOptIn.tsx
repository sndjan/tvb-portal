"use client";

import { Mail } from "lucide-react";
import { useState } from "react";

import { baseFieldClass } from "@/lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Spinner } from "./ui/spinner";

type MailingListOptInProps = {
  emailInput: string;
  setEmailInput: (email: string) => void;
  isPending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
};

export const MailingListOptIn = ({
  emailInput,
  setEmailInput,
  isPending,
  onSubmit,
}: MailingListOptInProps) => {
  const [open, setOpen] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(event);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Mail
            className="mt-0.5 size-5 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="grid gap-0.5">
            <CardTitle className="text-base">
              E-Mail-Benachrichtigungen
            </CardTitle>
            <CardDescription>
              Trage dich ein, um bei neuen Arbeitseinsätzen per E-Mail
              informiert zu werden.
            </CardDescription>
          </div>
        </div>

        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setEmailInput("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" className="sm:w-auto">
              Verwalten
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>E-Mail-Benachrichtigungen</DialogTitle>
              <DialogDescription>
                Trage deine E-Mail-Adresse ein, um bei neuen Arbeitseinsätzen
                benachrichtigt zu werden. Ist die Adresse bereits eingetragen,
                wird sie ausgetragen.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={async (event) => {
                await handleSubmit(event);
                if (!isPending) {
                  setOpen(false);
                }
              }}
              className="grid gap-3"
            >
              <Input
                type="email"
                className={baseFieldClass}
                placeholder="email@beispiel.de"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                required
                autoFocus
              />

              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Spinner /> : null}
                  Bestätigen
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

import { baseFieldClass } from "@/lib/utils";
import { LogIn } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Spinner } from "./ui/spinner";

type LoginFormProps = {
  loginPassword: string;
  setLoginPassword: (password: string) => void;
  isLoggingIn: boolean;
  handleLoginSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
};

export const LoginForm = ({
  loginPassword,
  setLoginPassword,
  isLoggingIn,
  handleLoginSubmit,
}: LoginFormProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <LogIn className="size-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleLoginSubmit} className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Admin Login</DialogTitle>
            <DialogDescription>
              Bitte gebe das Admin-Passwort ein.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            autoComplete="current-password"
            className={baseFieldClass}
            placeholder="Admin Passwort"
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
            required
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Abbrechen</Button>
            </DialogClose>
            <Button type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? (
                <Spinner />
              ) : (
                <LogIn className="size-4" aria-hidden="true" />
              )}
              Einloggen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

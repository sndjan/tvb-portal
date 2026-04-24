import { LogIn } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { baseFieldClass } from "@/lib/utils";

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
        <Card>
            <CardHeader>    
              <CardTitle>Admin Login</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleLoginSubmit}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <Input
                  type="password"
                  autoComplete="current-password"
                  className={baseFieldClass}
                  placeholder="Admin Passwort"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  required
                />
                <Button type="submit" disabled={isLoggingIn}>
                  <LogIn className="size-4" aria-hidden="true" />
                  Einloggen
                </Button>
              </form>
            </CardContent>
        </Card>
    );
};
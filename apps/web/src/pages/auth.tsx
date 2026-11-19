import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Wordmark } from "@/components/brand";
import { Button, Card, Field, Input } from "@/components/ui";
import { useLogin, useRegister } from "@/lib/queries";

type Mode = "login" | "register";

const emptyLogin = { email: "", password: "" };
const emptyRegister = { email: "", password: "", displayName: "", organizationName: "" };

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [loginForm, setLoginForm] = useState(emptyLogin);
  const [registerForm, setRegisterForm] = useState(emptyRegister);
  const login = useLogin();
  const register = useRegister();
  const pending = login.isPending || register.isPending;
  const error = login.error ?? register.error;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "login") {
      await login.mutateAsync(loginForm);
    } else {
      await register.mutateAsync(registerForm);
    }
    navigate("/app/overview", { replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ivory px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center"><Wordmark /></div>
        <Card className="p-6">
          <div className="flex rounded-xl border border-line bg-paper p-1">
            {(["login", "register"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  mode === option ? "bg-forest text-ivory" : "text-muted hover:text-forest"
                }`}
              >
                {option === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            {mode === "register" ? (
              <>
                <Field label="Your name" htmlFor="displayName">
                  <Input
                    id="displayName"
                    autoComplete="name"
                    value={registerForm.displayName}
                    onChange={(event) => setRegisterForm({ ...registerForm, displayName: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Organization" htmlFor="organizationName">
                  <Input
                    id="organizationName"
                    autoComplete="organization"
                    value={registerForm.organizationName}
                    onChange={(event) => setRegisterForm({ ...registerForm, organizationName: event.target.value })}
                    required
                  />
                </Field>
              </>
            ) : null}

            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={mode === "login" ? loginForm.email : registerForm.email}
                onChange={(event) =>
                  mode === "login"
                    ? setLoginForm({ ...loginForm, email: event.target.value })
                    : setRegisterForm({ ...registerForm, email: event.target.value })
                }
                required
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              hint={mode === "register" ? "At least 10 characters." : undefined}
            >
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={mode === "login" ? loginForm.password : registerForm.password}
                onChange={(event) =>
                  mode === "login"
                    ? setLoginForm({ ...loginForm, password: event.target.value })
                    : setRegisterForm({ ...registerForm, password: event.target.value })
                }
                required
              />
            </Field>

            {error ? <p className="text-sm text-clay">{error.message}</p> : null}

            <Button type="submit" className="w-full" loading={pending}>
              {mode === "login" ? "Sign in" : "Create workspace"}
            </Button>
          </form>
        </Card>
        <p className="text-center text-xs text-muted">
          <Link to="/" className="font-semibold text-forest hover:underline">Back to home</Link>
        </p>
      </div>
    </div>
  );
}

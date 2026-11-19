import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Wordmark } from "@/components/brand";
import { Button, Card, Field, Input } from "@/components/ui";
import { useConfig, useLogin, useRegister } from "@/lib/queries";
import { apiUrl } from "@/lib/api";

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
  const config = useConfig();
  const pending = login.isPending || register.isPending;
  const error = login.error ?? register.error;
  const googleEnabled = Boolean(config.data?.config?.googleAuthEnabled);

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

            {googleEnabled ? (
              <a
                href={apiUrl("/api/auth/google")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-ivory"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2045c0-.6382-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0782-1.7955 2.7164v2.2582h2.9087c1.7018-1.5668 2.6832-3.874 2.6832-6.6155z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2582c-.8059.54-1.8368.8591-3.0477.8591-2.344 0-4.3282-1.5836-5.0364-3.7105H.9573v2.3318C2.4382 16.173 5.4818 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.9636 10.71c-.18-.54-.2827-1.1168-.2827-1.71s.1027-1.17.2827-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9636 10.71z"/>
                  <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4545 3.4405 1.346l2.5814-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 1.827.9573 4.9582L3.9636 7.29C4.6718 5.163 6.6559 3.5795 9 3.5795z"/>
                </svg>
                Continue with Google
              </a>
            ) : null}
          </form>
        </Card>
        <p className="text-center text-xs text-muted">
          <Link to="/" className="font-semibold text-forest hover:underline">Back to home</Link>
        </p>
      </div>
    </div>
  );
}

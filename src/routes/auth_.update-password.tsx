import { createFileRoute, ClientOnly, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import gfLockup from "@/assets/gf-lockup.png";

export const Route = createFileRoute("/auth_/update-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Definir senha — GF Tattoo Studio" }] }),
  component: () => (
    <ClientOnly fallback={null}>
      <UpdatePasswordPage />
    </ClientOnly>
  ),
});

type BootstrapState =
  | { kind: "bootstrapping" }
  | { kind: "ready" }
  | { kind: "invalid"; message: string }
  | { kind: "no_link" };

function cleanUrl() {
  try {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    window.history.replaceState({}, "", url.toString());
  } catch {
    /* noop */
  }
}

async function bootstrapSession(): Promise<BootstrapState> {
  const href = window.location.href;
  const url = new URL(href);
  const qp = url.searchParams;
  const errorDesc = qp.get("error_description") ?? qp.get("error");
  if (errorDesc) {
    return { kind: "invalid", message: decodeURIComponent(errorDesc) };
  }

  // 1) PKCE ?code=...
  const code = qp.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { kind: "invalid", message: error.message };
    cleanUrl();
    return { kind: "ready" };
  }

  // 2) OTP verify ?token_hash=...&type=invite|recovery|magiclink
  const tokenHash = qp.get("token_hash");
  const type = qp.get("type");
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "invite" | "recovery" | "magiclink" | "email" | "signup",
    });
    if (error) return { kind: "invalid", message: error.message };
    cleanUrl();
    return { kind: "ready" };
  }

  // 3) Legacy hash #access_token=...&refresh_token=...
  if (url.hash.includes("access_token")) {
    const hp = new URLSearchParams(url.hash.replace(/^#/, ""));
    const access_token = hp.get("access_token");
    const refresh_token = hp.get("refresh_token");
    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) return { kind: "invalid", message: error.message };
      cleanUrl();
      return { kind: "ready" };
    }
  }

  // 4) Sessão já ativa
  const { data } = await supabase.auth.getSession();
  if (data.session) return { kind: "ready" };

  return { kind: "no_link" };
}

function UpdatePasswordPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<BootstrapState>({ kind: "bootstrapping" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    bootstrapSession().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSuccess(true);
    navigate({ to: "/agenda", replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      <img src={gfLockup} alt="GF Tattoo Studio" className="mb-4 h-20 w-auto object-contain" />
      <p className="mb-6 text-xs uppercase tracking-wider text-muted-foreground">
        Definir nova senha
      </p>

      {state.kind === "bootstrapping" ? (
        <p className="text-xs text-muted-foreground">Validando link…</p>
      ) : state.kind === "no_link" ? (
        <div className="w-full max-w-sm space-y-3 text-center">
          <p className="text-sm">Abra este link a partir do email que você recebeu.</p>
          <Link to="/auth_/recover" className="text-xs underline">
            Solicitar novo link
          </Link>
        </div>
      ) : state.kind === "invalid" ? (
        <div className="w-full max-w-sm space-y-3 text-center">
          <p className="text-sm text-destructive">
            O link é inválido ou expirou.
          </p>
          <p className="text-[11px] text-muted-foreground">{state.message}</p>
          <Link to="/auth_/recover" className="text-xs underline">
            Solicitar novo link
          </Link>
        </div>
      ) : success ? (
        <p className="text-sm">Senha atualizada. Entrando…</p>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
          <div className="space-y-1">
            <Label htmlFor="password">Nova senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm">Confirmar</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </form>
      )}
    </div>
  );
}
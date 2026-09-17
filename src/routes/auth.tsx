import { createFileRoute, useNavigate, useRouter, ClientOnly, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { AuthFrame } from "@/components/auth/auth-frame";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => {
    const redirect = typeof s.redirect === "string" ? s.redirect : undefined;
    return redirect ? { redirect } : {};
  },
  head: () => ({
    meta: [
      { title: "Entrar — GF Tattoo Studio" },
      { name: "description", content: "Acesse sua conta no GF Tattoo Studio." },
      { property: "og:title", content: "Entrar — GF Tattoo Studio" },
      { property: "og:description", content: "Acesse sua conta no GF Tattoo Studio." },
      { property: "og:url", content: "https://gftattoocalendar.com/auth" },
    ],
    links: [{ rel: "canonical", href: "https://gftattoocalendar.com/auth" }],
  }),
  component: AuthRoute,
});

function AuthRoute() {
  return <ClientOnly fallback={null}><AuthPage /></ClientOnly>;
}

/** Só aceita caminhos relativos do próprio domínio (evita open redirect). */
function safeRelative(path: string | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect } = Route.useSearch();

  // Destinos com query string (ex.: /.lovable/oauth/consent?authorization_id=…)
  // não passam pelo router tipado — usa navegação nativa nesse caso.
  const goAfterAuth = () => {
    const target = safeRelative(redirect);
    if (target && target.includes("?")) {
      window.location.href = target;
      return;
    }
    navigate({ to: target ?? "/agenda", replace: true });
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) {
        goAfterAuth();
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirect]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    await router.invalidate();
    goAfterAuth();
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const safeRedirect = safeRelative(redirect);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: safeRedirect
        ? `${window.location.origin}/auth?redirect=${encodeURIComponent(safeRedirect)}`
        : window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      setError(result.error.message ?? "Falha ao entrar com Google");
      return;
    }
    if (result.redirected) return;
    await router.invalidate();
    goAfterAuth();
  }

  return (
    <AuthFrame title="Acesso ao estúdio" description="Entre para acompanhar a agenda e a operação do dia.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs uppercase text-muted-foreground">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="nome@email.com"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password" className="text-xs uppercase text-muted-foreground">Senha</Label>
            <Link
              to="/auth/recover"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Esqueci a senha
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Entrar
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogle}
        disabled={googleLoading}
      >
        {googleLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full border border-border font-display text-xs">G</span>
        )}
        Entrar com Google
      </Button>
    </AuthFrame>
  );
}
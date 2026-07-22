import { createFileRoute, useNavigate, useRouter, ClientOnly, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import gfLockup from "@/assets/gf-lockup.png";

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

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) {
        navigate({ to: redirect ?? "/agenda", replace: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate, redirect]);

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
    navigate({ to: redirect ?? "/agenda", replace: true });
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      setError(result.error.message ?? "Falha ao entrar com Google");
      return;
    }
    if (result.redirected) return;
    await router.invalidate();
    navigate({ to: redirect ?? "/agenda", replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      <img
        src={gfLockup}
        alt="GF Tattoo Studio"
        className="mb-4 h-20 w-auto object-contain"
      />
      <p className="mb-6 text-xs uppercase tracking-wider text-muted-foreground">Entrar</p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Entrar
        </Button>
        <div className="text-center">
          <Link
            to="/auth/recover"
            className="text-xs text-muted-foreground underline underline-offset-2"
          >
            Esqueci minha senha
          </Link>
        </div>
      </form>

      <div className="my-4 flex w-full max-w-sm items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full max-w-sm"
        onClick={handleGoogle}
        disabled={googleLoading}
      >
        {googleLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.2 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.2 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.9l-6.5 5C9.6 39.7 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C41.6 35.7 44 30.3 44 24c0-1.3-.1-2.3-.4-3.5z"/>
          </svg>
        )}
        Entrar com Google
      </Button>
    </div>
  );
}
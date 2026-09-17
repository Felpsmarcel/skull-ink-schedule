import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { AuthFrame } from "@/components/auth/auth-frame";

export const Route = createFileRoute("/auth_/recover")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Recuperar senha — GF Tattoo Studio" },
      { name: "description", content: "Recupere o acesso à sua conta GF Tattoo Studio." },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Recuperar senha — GF Tattoo Studio" },
      { property: "og:url", content: "https://gftattoocalendar.com/auth/recover" },
    ],
    links: [{ rel: "canonical", href: "https://gftattoocalendar.com/auth/recover" }],
  }),
  component: () => (
    <ClientOnly fallback={null}>
      <ResetPage />
    </ClientOnly>
  ),
});

function ResetPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthFrame title="Recuperar senha" description="Enviaremos um link seguro para o seu email.">
      {sent ? (
        <div className="space-y-5 text-center">
          <p className="text-sm leading-6 text-muted-foreground">
            Se este email existe, enviamos um link para redefinir a senha. Verifique sua caixa
            de entrada.
          </p>
          <Link to="/auth" search={{ redirect: undefined }} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            Voltar para o login
          </Link>
        </div>
      ) : (
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
            />
          </div>
          {error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enviar link
          </Button>
          <div className="text-center">
            <Link to="/auth" search={{ redirect: undefined }} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Voltar
            </Link>
          </div>
        </form>
      )}
    </AuthFrame>
  );
}
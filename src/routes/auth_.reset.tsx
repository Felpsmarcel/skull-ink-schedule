import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import gfLockup from "@/assets/gf-lockup.png";

export const Route = createFileRoute("/auth_/reset")({
  ssr: false,
  head: () => ({ meta: [{ title: "Recuperar senha — GF Tattoo Studio" }] }),
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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      <img src={gfLockup} alt="GF Tattoo Studio" className="mb-4 h-20 w-auto object-contain" />
      <p className="mb-6 text-xs uppercase tracking-wider text-muted-foreground">
        Recuperar senha
      </p>

      {sent ? (
        <div className="w-full max-w-sm space-y-3 text-center">
          <p className="text-sm">
            Se este email existe, enviamos um link para redefinir a senha. Verifique sua caixa
            de entrada.
          </p>
          <Link to="/auth" className="text-xs underline">
            Voltar para o login
          </Link>
        </div>
      ) : (
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
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enviar link
          </Button>
          <div className="text-center">
            <Link to="/auth" className="text-xs underline text-muted-foreground">
              Voltar
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
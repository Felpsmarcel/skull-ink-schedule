import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { PaymentLinkCard } from "@/components/movimentacao/payment-link-card";
import { AccountView } from "@/components/account/account-view";

export const Route = createFileRoute("/_authenticated/menu")({
  head: () => ({
    meta: [
      { title: "Conta e gestão — GF Tattoo Studio" },
      { name: "description", content: "Sua conta e as ferramentas do GF Tattoo Studio." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const profile = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      await qc.cancelQueries();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      qc.clear();
      await navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
    } catch {
      setSignOutError("Não foi possível sair. Tente novamente.");
    } finally {
      setIsSigningOut(false);
    }
  }
  return (
    <>
      <Toaster position="top-center" />
      <AccountView
        profile={profile.data ?? null}
        isLoading={profile.isLoading}
        error={profile.isError}
        onRetry={() => void profile.refetch()}
        onSignOut={() => void handleSignOut()}
        isSigningOut={isSigningOut}
        signOutError={signOutError}
        receiptLink={<PaymentLinkCard />}
      />
    </>
  );
}

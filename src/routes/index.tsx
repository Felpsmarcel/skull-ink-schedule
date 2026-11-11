import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GF Tattoo — Acesso à agenda" },
      {
        name: "description",
        content: "Acesso à agenda e à gestão de atendimentos do GF Tattoo Studio.",
      },
      { property: "og:title", content: "GF Tattoo — Acesso à agenda" },
      {
        property: "og:description",
        content: "Acesso à agenda e à gestão de atendimentos do GF Tattoo Studio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/agenda" });
    throw redirect({ to: "/auth", search: { redirect: undefined } });
  },
  component: () => null,
});

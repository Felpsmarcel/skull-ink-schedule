import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import "@/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GF Tattoo Studio" },
      { name: "description", content: "Estúdio de tatuagem — agendamento online" },
      { property: "og:title", content: "GF Tattoo Studio" },
      { property: "og:description", content: "Estúdio de tatuagem — agendamento online" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

function Index() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="flex flex-col items-center gap-6">
        <div
          aria-hidden
          className="h-px w-12 bg-primary"
        />
        <h1
          className="text-5xl tracking-[0.18em] text-foreground"
          style={{ fontFamily: "var(--font-display)" }}
        >
          GF TATTOO
          <br />
          STUDIO
        </h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          {t("app.tagline")}
        </p>
        <button
          type="button"
          disabled
          className="mt-4 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold uppercase tracking-widest text-primary-foreground opacity-60"
        >
          {t("actions.comingSoon")}
        </button>
      </div>
    </main>
  );
}

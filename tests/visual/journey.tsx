/* eslint-disable react-refresh/only-export-components -- Standalone visual harness with an HMR-disposed root. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CalendarPlus, Images, ScanLine } from "lucide-react";
import { BookingDemo } from "./booking-demo";
import { CheckinDemo } from "./checkin-demo";
import { PhotosDemo } from "./photos-demo";
import "../../src/i18n";
import "./visual.css";

const tabs = [
  { id: "booking", title: "Novo agendamento", Icon: CalendarPlus },
  { id: "checkin", title: "Check-in", Icon: ScanLine },
  { id: "photos", title: "Fotos", Icon: Images },
] as const;
function JourneyPreview() {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("booking");
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-card px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-primary">
              GF Tattoo Studio
            </p>
            <h1 className="mt-1 font-editorial text-2xl">A jornada no estúdio</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Revisão visual · dados fictícios · nenhuma gravação real
            </p>
          </div>
          <nav aria-label="Telas em revisão" className="flex flex-wrap gap-2">
            {tabs.map(({ id, title, Icon }) => (
              <button
                type="button"
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${tab === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {title}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main>
        {tab === "booking" ? <BookingDemo /> : tab === "checkin" ? <CheckinDemo /> : <PhotosDemo />}
      </main>
    </div>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(<JourneyPreview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());

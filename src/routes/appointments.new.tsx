import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

import "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { LOCATION_ID } from "@/config/staff";
import { useArtists } from "@/hooks/use-artists";
import {
  brusselsDayStartMs,
  brusselsDayEndMs,
  brusselsDayKey,
  extractFreeSlotStarts,
  formatHHmm,
} from "@/lib/agenda-grid";
import {
  createAppointment,
  createContact,
  getFreeSlots,
  searchContacts,
  type GhlContact,
} from "@/lib/ghl";
import { formatPrice, modalityLabel } from "@/lib/services";
import {
  useAppointmentDraft,
  totalDurationMin,
  totalFinalEur,
} from "@/stores/appointment-draft";

export const Route = createFileRoute("/appointments/new")({
  head: () => ({
    meta: [{ title: "Novo agendamento — GF Tattoo Studio" }],
  }),
  component: AppointmentNewPage,
});

function AppointmentNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const draft = useAppointmentDraft();
  const [dateObj, setDateObj] = useState<Date>(() =>
    draft.startISO ? new Date(draft.startISO) : new Date(),
  );
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const dayKey = brusselsDayKey(dateObj);
  const dayStartMs = brusselsDayStartMs(dateObj);
  const dayEndMs = brusselsDayEndMs(dateObj);

  const slotsQuery = useQuery({
    enabled: Boolean(draft.calendarId),
    queryKey: ["appt-free-slots", draft.calendarId, dayKey],
    queryFn: async () => {
      const res = await getFreeSlots(draft.calendarId!, dayStartMs, dayEndMs);
      if (!res.ok) throw new Error(`free-slots ${res.status}: ${JSON.stringify(res.data)}`);
      return extractFreeSlotStarts(res.data).sort((a, b) => a - b);
    },
    staleTime: 30_000,
  });

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-PT", {
        timeZone: "Europe/Brussels",
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(dateObj),
    [dateObj],
  );

  async function handleSave() {
    if (!draft.contact) return toast.error(t("appt.errors.noContact"));
    if (!draft.calendarId) return toast.error(t("appt.errors.noCalendar"));
    if (!draft.startISO) return toast.error(t("appt.errors.noStart"));

    setSaving(true);
    try {
      // Re-validate slot freshness against GHL right before saving.
      const startMs = new Date(draft.startISO).getTime();
      const fresh = await getFreeSlots(draft.calendarId, dayStartMs, dayEndMs);
      if (!fresh.ok) throw new Error(`free-slots ${fresh.status}`);
      const free = extractFreeSlotStarts(fresh.data);
      if (!free.some((m) => Math.abs(m - startMs) < 60_000)) {
        toast.error(t("appt.errors.slotTaken"));
        slotsQuery.refetch();
        return;
      }

      const durationMin = Math.max(15, totalDurationMin(draft) || 60);
      const endMs = startMs + durationMin * 60_000;
      const title =
        draft.services.length > 0
          ? draft.services.map((l) => l.service.name).join(" + ")
          : draft.contact.contactName || draft.contact.firstName || "Agendamento";

      const res = await createAppointment({
        calendarId: draft.calendarId,
        locationId: LOCATION_ID,
        contactId: draft.contact.id,
        startTime: new Date(startMs).toISOString(),
        endTime: new Date(endMs).toISOString(),
        title,
        notes: draft.notes || undefined,
        appointmentStatus: "confirmed",
      });
      if (!res.ok) {
        toast.error(`${res.status}: ${(res.data as { message?: string })?.message ?? "Erro GHL"}`);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["agenda"] });
      toast.success(t("appt.created"));
      draft.reset();
      navigate({ to: "/agenda" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <Link to="/agenda" className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold">{t("appt.title")}</h1>
      </header>

      <main className="flex-1 space-y-4 p-4">
        {/* Cliente */}
        <section className="rounded-lg border border-border bg-card p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("appt.client")}
          </h2>
          <ContactPicker
            selected={draft.contact}
            onSelect={(c) => draft.setContact(c)}
            onClear={() => draft.setContact(null)}
          />
        </section>

        {/* Tatuador */}
        <section className="rounded-lg border border-border bg-card p-3">
          <Label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("appt.staff")}
          </Label>
          <Select
            value={draft.calendarId ?? undefined}
            onValueChange={(v) => {
              draft.setCalendar(v);
              draft.setStart(null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("appt.staffPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {STAFF.map((s) => (
                <SelectItem key={s.id} value={s.calendarId}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Data e hora */}
        <section className="rounded-lg border border-border bg-card p-3">
          <Label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("appt.dateTime")}
          </Label>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateObj}
                onSelect={(d) => {
                  if (d) {
                    setDateObj(d);
                    draft.setStart(null);
                    setDatePickerOpen(false);
                  }
                }}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <div className="mt-3">
            {!draft.calendarId ? (
              <p className="text-xs text-muted-foreground">{t("appt.pickStaffFirst")}</p>
            ) : slotsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> {t("appt.loadingSlots")}
              </div>
            ) : slotsQuery.error ? (
              <p className="text-xs text-destructive">{(slotsQuery.error as Error).message}</p>
            ) : (slotsQuery.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("appt.noSlots")}</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {(slotsQuery.data ?? []).map((ms) => {
                  const iso = new Date(ms).toISOString();
                  const active = draft.startISO === iso;
                  return (
                    <button
                      type="button"
                      key={ms}
                      onClick={() => draft.setStart(iso)}
                      className={cn(
                        "rounded border px-2 py-1.5 text-xs",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary/60",
                      )}
                    >
                      {formatHHmm(ms)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Recurrence */}
        <section className="rounded-lg border border-border bg-card p-3">
          <Label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("appt.recurrence")}
          </Label>
          <Select value="none" disabled>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("appt.noRepeat")}</SelectItem>
            </SelectContent>
          </Select>
        </section>

        {/* Servicos */}
        <section className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("appt.services")}
            </h2>
          </div>
          <div className="space-y-1">
            {draft.services.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("appt.noServices")}</p>
            ) : (
              draft.services.map((l) => (
                <div
                  key={l.service.id}
                  className="flex items-center justify-between rounded border border-border/70 bg-background px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm">{l.service.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {l.service.duration_min} min · {l.service.modality}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {formatPrice(l.service.price_cents, l.service.currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => draft.removeService(l.service.id)}
                      className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t("appt.removeService")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <Button
            variant="outline"
            className="mt-2 w-full"
            onClick={() => navigate({ to: "/appointments/new/services" })}
          >
            <Plus className="mr-2 h-4 w-4" /> {t("appt.addService")}
          </Button>
        </section>
      </main>

      {/* Footer */}
      <footer className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center gap-2 border-t border-border bg-background/95 px-3 pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button variant="ghost" size="sm" disabled>
          ⋯
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => navigate({ to: "/appointments/new/checkout" })}
        >
          {t("appt.checkout")}
          {totalFinalCents(draft) > 0 ? (
            <span className="ml-2 text-xs text-muted-foreground">
              {formatPrice(totalFinalCents(draft))}
            </span>
          ) : null}
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("appt.save")}
        </Button>
      </footer>
    </div>
  );
}

/* ----------------- Contact picker ----------------- */

function ContactPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: GhlContact | null;
  onSelect: (c: GhlContact) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded border border-border bg-background p-2">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
          {(selected.contactName ?? selected.firstName ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {selected.contactName ??
              [selected.firstName, selected.lastName].filter(Boolean).join(" ")}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {selected.phone ?? selected.email ?? ""}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Trocar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <UserIcon className="mr-2 h-4 w-4" />
          {t("appt.addClient")}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85dvh] overflow-y-auto p-0">
        <SheetHeader className="border-b border-border p-3">
          <SheetTitle>{t("appt.addClient")}</SheetTitle>
        </SheetHeader>
        <Tabs defaultValue="search" className="p-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">{t("appt.searchTab")}</TabsTrigger>
            <TabsTrigger value="create">{t("appt.createTab")}</TabsTrigger>
          </TabsList>
          <TabsContent value="search" className="mt-3">
            <SearchContactsPanel
              onPick={(c) => {
                onSelect(c);
                setOpen(false);
              }}
            />
          </TabsContent>
          <TabsContent value="create" className="mt-3">
            <CreateContactPanel
              onCreated={(c) => {
                onSelect(c);
                setOpen(false);
              }}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function SearchContactsPanel({ onPick }: { onPick: (c: GhlContact) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const debounced = useDebounce(q, 300);
  const query = useQuery({
    enabled: debounced.trim().length >= 2,
    queryKey: ["contacts-search", debounced],
    queryFn: async () => {
      const res = await searchContacts(LOCATION_ID, debounced.trim());
      if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(res.data)}`);
      return res.data.contacts ?? [];
    },
  });

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("appt.searchPlaceholder")}
          className="pl-8"
        />
      </div>
      {query.isLoading ? (
        <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> …
        </div>
      ) : query.error ? (
        <p className="p-3 text-xs text-destructive">{(query.error as Error).message}</p>
      ) : debounced.length < 2 ? (
        <p className="p-3 text-xs text-muted-foreground">{t("appt.searchHint")}</p>
      ) : (query.data ?? []).length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">{t("appt.noContacts")}</p>
      ) : (
        <ul className="divide-y divide-border rounded border border-border">
          {(query.data ?? []).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="flex w-full items-center gap-3 p-2 text-left hover:bg-muted"
              >
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                  {(c.contactName ?? c.firstName ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    {c.contactName ?? [c.firstName, c.lastName].filter(Boolean).join(" ")}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.phone ?? c.email ?? ""}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const createContactSchema = z.object({
  firstName: z.string().trim().min(1, "Nome obrigatório").max(60),
  lastName: z.string().trim().max(60).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .min(5, "Telefone obrigatório")
    .max(30),
  email: z.string().trim().email("E-mail inválido").max(120).optional().or(z.literal("")),
});
type CreateContactForm = z.infer<typeof createContactSchema>;

function CreateContactPanel({ onCreated }: { onCreated: (c: GhlContact) => void }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const form = useForm<CreateContactForm>({
    defaultValues: { firstName: "", lastName: "", phone: "", email: "" },
  });

  async function onSubmit(values: CreateContactForm) {
    const parsed = createContactSchema.safeParse(values);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? "Erro de validação");
      return;
    }
    setSaving(true);
    try {
      const res = await createContact({
        locationId: LOCATION_ID,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName || undefined,
        phone: parsed.data.phone,
        email: parsed.data.email || undefined,
      });
      if (!res.ok) {
        toast.error(`${res.status}: ${JSON.stringify(res.data)}`);
        return;
      }
      const c = res.data.contact;
      if (!c?.id) {
        toast.error("GHL não retornou o contato.");
        return;
      }
      toast.success(t("appt.contactCreated"));
      onCreated(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <Label htmlFor="firstName">{t("appt.firstName")} *</Label>
        <Input id="firstName" {...form.register("firstName")} />
      </div>
      <div>
        <Label htmlFor="lastName">{t("appt.lastName")}</Label>
        <Input id="lastName" {...form.register("lastName")} />
      </div>
      <div>
        <Label htmlFor="phone">{t("appt.phone")} *</Label>
        <Input id="phone" type="tel" {...form.register("phone")} />
      </div>
      <div>
        <Label htmlFor="email">{t("appt.email")}</Label>
        <Input id="email" type="email" {...form.register("email")} />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t("appt.createContact")}
      </Button>
    </form>
  );
}

function useDebounce<T>(value: T, delayMs: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return v;
}
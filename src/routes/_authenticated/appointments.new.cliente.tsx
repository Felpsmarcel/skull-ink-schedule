import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ChevronRight, Loader2, Search, User as UserIcon, X } from "lucide-react";
import { toast } from "sonner";

import "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { LOCATION_ID } from "@/config/staff";
import { createContact, searchContacts, type GhlContact } from "@/lib/ghl";
import { useAppointmentDraft } from "@/stores/appointment-draft";
import { WizardFooter } from "@/components/appointment-wizard/wizard-footer";

export const Route = createFileRoute("/_authenticated/appointments/new/cliente")({
  head: () => ({
    meta: [
      { title: "Cliente — Novo agendamento" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ClienteStep,
});

function ClienteStep() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const draft = useAppointmentDraft();
  const canContinue = Boolean(draft.contact);

  return (
    <>
      <main className="flex-1 space-y-4 p-4 pb-0">
        <section className="rounded-lg border border-border bg-card p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("appt.client")}
          </h2>
          {draft.contact ? (
            <SelectedContactCard
              contact={draft.contact}
              onClear={() => draft.setContact(null)}
            />
          ) : (
            <ContactPickerInline onSelect={(c) => draft.setContact(c)} />
          )}
        </section>
      </main>
      <WizardFooter
        primary={canContinue ? t("appt.wizard.next") : t("appt.cta.selectClient")}
        primaryDisabled={!canContinue}
        onPrimary={() => navigate({ to: "/appointments/new/agenda" })}
      />
    </>
  );
}

function SelectedContactCard({
  contact,
  onClear,
}: {
  contact: GhlContact;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded border border-border bg-background p-2">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-foreground">
        {(contact.contactName ?? contact.firstName ?? "?").slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {contact.contactName ??
            [contact.firstName, contact.lastName].filter(Boolean).join(" ")}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {contact.phone ?? contact.email ?? ""}
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="grid h-11 w-11 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Trocar cliente"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ContactPickerInline({ onSelect }: { onSelect: (c: GhlContact) => void }) {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="search" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="search">
          <UserIcon className="mr-1.5 h-3.5 w-3.5" />
          {t("appt.searchTab")}
        </TabsTrigger>
        <TabsTrigger value="create">{t("appt.createTab")}</TabsTrigger>
      </TabsList>
      <TabsContent value="search" className="mt-3">
        <SearchContactsPanel onPick={onSelect} />
      </TabsContent>
      <TabsContent value="create" className="mt-3">
        <CreateContactPanel onCreated={onSelect} />
      </TabsContent>
    </Tabs>
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
        <div className="p-3">
          <LoadingState inline size="sm" />
        </div>
      ) : query.error ? (
        <div className="p-3">
          <ErrorState
            description="Não foi possível carregar os contactos."
            details={(query.error as Error).message}
            onRetry={() => query.refetch()}
          />
        </div>
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
                className="flex min-h-14 w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-muted"
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
  phone: z.string().trim().min(5, "Telefone obrigatório").max(30),
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
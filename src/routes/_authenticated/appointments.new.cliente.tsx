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
import { createContact, sanitizePhone, searchContacts, type GhlContact } from "@/lib/ghl";
import { useAppointmentDraft } from "@/stores/appointment-draft";
import { WizardStepMain, WizardSection } from "@/components/appointment-wizard/wizard-layout";
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
      <WizardStepMain
        title="Quem vamos receber?"
        description="Encontre um cliente existente ou cadastre um novo contacto para começar."
      >
        <WizardSection title={t("appt.client")}>
          {draft.contact ? (
            <SelectedContactCard contact={draft.contact} onClear={() => draft.setContact(null)} />
          ) : (
            <ContactPickerInline onSelect={(c) => draft.setContact(c)} />
          )}
        </WizardSection>
      </WizardStepMain>
      <WizardFooter
        primary={canContinue ? t("appt.wizard.next") : t("appt.cta.selectClient")}
        primaryDisabled={!canContinue}
        onPrimary={() => navigate({ to: "/appointments/new/projeto" })}
      />
    </>
  );
}

function SelectedContactCard({ contact, onClear }: { contact: GhlContact; onClear: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-foreground">
        {(contact.contactName ?? contact.firstName ?? "?").slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="break-words text-sm font-semibold">
          {contact.contactName ?? [contact.firstName, contact.lastName].filter(Boolean).join(" ")}
        </div>
        <div className="break-all text-xs text-muted-foreground">
          {contact.phone ?? contact.email ?? ""}
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1">
        <TabsTrigger value="search" className="min-h-11 rounded-lg">
          <UserIcon className="mr-1.5 h-3.5 w-3.5" />
          {t("appt.searchTab")}
        </TabsTrigger>
        <TabsTrigger value="create" className="min-h-11 rounded-lg">
          {t("appt.createTab")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="search" className="mt-4">
        <SearchContactsPanel onPick={onSelect} />
      </TabsContent>
      <TabsContent value="create" className="mt-4">
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
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("appt.searchPlaceholder")}
          aria-label={t("appt.searchPlaceholder")}
          className="h-12 rounded-xl pl-9"
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
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {(query.data ?? []).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="flex min-h-18 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                  {(c.contactName ?? c.firstName ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="break-words text-sm">
                    {c.contactName ?? [c.firstName, c.lastName].filter(Boolean).join(" ")}
                  </div>
                  <div className="break-all text-xs text-muted-foreground">
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
    const cleaned = {
      firstName: values.firstName.trim(),
      lastName: values.lastName?.trim() ?? "",
      phone: values.phone ? sanitizePhone(values.phone) : "",
      email: values.email?.trim() ?? "",
    };
    const parsed = createContactSchema.safeParse(cleaned);
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
        const message =
          typeof (res.data as { message?: unknown })?.message === "string"
            ? (res.data as { message: string }).message
            : "";
        if (/invalid country calling code/i.test(message)) {
          toast.error("Número de telefone inválido. Verifique o código do país (ex: +32...).");
        } else {
          toast.error(message || `Erro ${res.status} ao criar contato.`);
        }
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="firstName">{t("appt.firstName")} *</Label>
        <Input
          className="h-12 rounded-xl"
          autoComplete="given-name"
          id="firstName"
          {...form.register("firstName")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lastName">{t("appt.lastName")}</Label>
        <Input
          className="h-12 rounded-xl"
          autoComplete="family-name"
          id="lastName"
          {...form.register("lastName")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">{t("appt.phone")} *</Label>
        <Input
          className="h-12 rounded-xl"
          autoComplete="tel"
          id="phone"
          type="tel"
          {...form.register("phone")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t("appt.email")}</Label>
        <Input
          className="h-12 rounded-xl"
          autoComplete="email"
          id="email"
          type="email"
          {...form.register("email")}
        />
      </div>
      <Button
        type="submit"
        className="min-h-12 w-full rounded-xl sm:col-span-2"
        disabled={saving}
        aria-busy={saving || undefined}
      >
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

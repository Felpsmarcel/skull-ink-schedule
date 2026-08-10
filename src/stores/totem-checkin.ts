import { create } from "zustand";
import type { TotemSession } from "@/lib/checkin.functions";

export interface TotemDraft {
  /** "agendado" = cliente com agendamento; "novo" = primeira visita. */
  modo: "agendado" | "novo" | null;
  session: TotemSession | null;
  /** Dados digitados quando é um cliente novo. */
  novoNome: string;
  novoTelefone: string;
  consentimento: boolean;
}

interface State extends TotemDraft {
  setModo: (m: TotemDraft["modo"]) => void;
  setSession: (s: TotemSession | null) => void;
  setNovo: (nome: string, telefone: string) => void;
  setConsentimento: (v: boolean) => void;
  reset: () => void;
}

const initial: TotemDraft = {
  modo: null,
  session: null,
  novoNome: "",
  novoTelefone: "",
  consentimento: false,
};

export const useTotemDraft = create<State>((set) => ({
  ...initial,
  setModo: (modo) => set({ modo }),
  setSession: (session) => set({ session }),
  setNovo: (novoNome, novoTelefone) => set({ novoNome, novoTelefone }),
  setConsentimento: (consentimento) => set({ consentimento }),
  reset: () => set({ ...initial }),
}));

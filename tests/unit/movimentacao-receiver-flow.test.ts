import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { MovimentacaoForm } from "@/components/movimentacao/movimentacao-form";
import type { SlugContext } from "@/lib/movimentacao.functions";
import { MOVIMENTACAO_SLUGS, STAFF_RECEBEDORES } from "@/config/movimentacao-slugs";

const fake = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  mutation: undefined as
    | { mutationFn: () => Promise<unknown>; onSuccess: (result: unknown) => void }
    | undefined,
  submitManual: vi.fn(),
  submitLink: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = fake.cursor++;
    if (!(index in fake.states))
      fake.states[index] = typeof initial === "function" ? initial() : initial;
    return [
      fake.states[index],
      (value: unknown) => {
        fake.states[index] = typeof value === "function" ? value(fake.states[index]) : value;
      },
    ];
  },
  useMemo: (calculate: () => unknown) => calculate(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [] }),
  useQueryClient: () => ({ invalidateQueries: fake.invalidate }),
  useMutation: (options: typeof fake.mutation) => {
    fake.mutation = options;
    return { mutate: vi.fn(), isPending: false };
  },
}));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: string) => (fn === "manual" ? fake.submitManual : fake.submitLink),
}));
vi.mock("@/lib/movimentacao.functions", () => ({
  createMovimentacao: "link",
  createMovimentacaoManual: "manual",
  listRecentClients: "recent",
}));
vi.mock("@/components/movimentacao/vinculo-projeto", () => ({ VinculoProjeto: () => null }));
vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

interface StepProps {
  form: { recebido_por_id: string };
  set: (key: string, value: string) => void;
}
interface FooterProps {
  step: number;
  canNext: boolean;
  canSubmit: boolean;
  onNext: () => void;
}
function find<P>(node: ReactNode, name: string): P {
  const nodes: ReactNode[] = [node];
  while (nodes.length) {
    const current = nodes.shift();
    if (Array.isArray(current)) {
      nodes.push(...current);
      continue;
    }
    if (!current || typeof current !== "object" || !("props" in current)) continue;
    const element = current as ReactElement<{ children?: ReactNode }>;
    if (typeof element.type === "function" && element.type.name === name) return element.props as P;
    nodes.push(element.props.children);
  }
  throw new Error(`Missing component ${name}`);
}
function render(mode: "manual" | "link" = "manual", context?: SlugContext) {
  fake.cursor = 0;
  return MovimentacaoForm({
    mode,
    context,
    artists: [{ id: "artist-fixture", name: "Artista fictício" }],
  });
}
function fillOtherFields(tree: ReactNode) {
  const step = find<StepProps>(tree, "StepOne");
  step.set("nome_cliente", "Cliente fictício");
  step.set("artist_id", "artist-fixture");
  step.set("tipo_movimento", "saldo");
  step.set("valor_dinheiro", "100");
  return step;
}
function advanceToReview() {
  find<FooterProps>(render(), "WizardFooter").onNext();
  find<FooterProps>(render(), "WizardFooter").onNext();
  return render();
}
beforeEach(() => {
  fake.states = [];
  fake.cursor = 0;
  fake.mutation = undefined;
  vi.clearAllMocks();
  fake.submitManual.mockResolvedValue({ id: "fixture-receipt", ghl_sync_status: "pending" });
});

describe("explicit receipt receiver", () => {
  it("starts manual entry empty and blocks progression even when all other fields are valid", () => {
    const step = fillOtherFields(render());
    expect(step.form.recebido_por_id).toBe("");
    const footer = find<FooterProps>(render(), "WizardFooter");
    expect(footer.canNext).toBe(false);
    footer.onNext();
    expect(find<FooterProps>(render(), "WizardFooter").step).toBe(1);
  });
  it.each(["", "not-a-staff-member"])(
    "rejects recipient %s before any submit function can run",
    async (receiver) => {
      const step = fillOtherFields(render());
      step.set("recebido_por_id", "andre");
      expect(find<FooterProps>(advanceToReview(), "WizardFooter").canSubmit).toBe(true);
      step.set("recebido_por_id", receiver);
      expect(find<FooterProps>(render(), "WizardFooter").canSubmit).toBe(false);
      await expect(fake.mutation!.mutationFn()).rejects.toThrow("Selecione quem recebeu.");
      expect(fake.submitManual).not.toHaveBeenCalled();
      expect(fake.submitLink).not.toHaveBeenCalled();
    },
  );
  it("submits only the selected staff ID and clears it for a new manual entry", async () => {
    const step = fillOtherFields(render());
    step.set("recebido_por_id", "andre");
    expect(find<FooterProps>(advanceToReview(), "WizardFooter").canSubmit).toBe(true);
    const result = await fake.mutation!.mutationFn();
    expect(fake.submitManual).toHaveBeenCalledExactlyOnceWith({
      data: expect.objectContaining({ recebido_por_id: "andre", valor_dinheiro: 100 }),
    });
    expect(fake.submitLink).not.toHaveBeenCalled();
    fake.mutation!.onSuccess(result);
    find<{ onNew: () => void }>(render(), "ConfirmationScreen").onNew();
    expect(find<StepProps>(render(), "StepOne").form.recebido_por_id).toBe("");
  });
  it("preserves the explicit receiver belonging to a personal link", () => {
    const context: SlugContext = {
      slug: "andre",
      target: MOVIMENTACAO_SLUGS.andre,
      recebidoPorAppUserId: "fixture-user",
      recebidoPorNome: "André",
      defaultArtistId: "artist-fixture",
      recebedores: STAFF_RECEBEDORES,
      defaultRecebedorId: "andre",
    };
    expect(find<StepProps>(render("link", context), "StepOne").form.recebido_por_id).toBe("andre");
  });
  it("does not substitute Gabriel when a personal-link context is missing", () => {
    expect(find<StepProps>(render("link"), "StepOne").form.recebido_por_id).toBe("");
  });
});

import { fromZonedTime } from "date-fns-tz";
import { addDays, format, parseISO } from "date-fns";
import { z } from "zod";

export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = parseISO(value);
  return Number.isFinite(parsed.getTime()) && format(parsed, "yyyy-MM-dd") === value;
}, "Data inválida");
export function dashboardPeriod(from: string, to: string) {
  localDateSchema.parse(from); localDateSchema.parse(to);
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
  if (days < 1 || days > 93) throw new Error("Período deve ter entre 1 e 93 dias");
  const nextDay = format(addDays(parseISO(to), 1), "yyyy-MM-dd");
  return {
    from, to, timezone: "Europe/Brussels" as const,
    startUtc: fromZonedTime(`${from}T00:00:00`, "Europe/Brussels").toISOString(),
    endExclusiveUtc: fromZonedTime(`${nextDay}T00:00:00`, "Europe/Brussels").toISOString(),
    endExclusive: true,
  };
}
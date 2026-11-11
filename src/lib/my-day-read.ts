/** Read each page completely; failures never return misleading partial totals. */
export async function readMyDayPages<T>(fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>, pageSize = 250, maxPages = 40): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const response = await fetchPage(page * pageSize, page * pageSize + pageSize - 1);
    if (response.error || !response.data) throw new Error("Fonte indisponível");
    rows.push(...response.data);
    if (response.data.length < pageSize) return rows;
  }
  throw new Error("Cobertura incompleta");
}

export function requireMyDayAdmin(role: unknown): void {
  if (role !== "admin") throw new Response("Forbidden", { status: 403 });
}
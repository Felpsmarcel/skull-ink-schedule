// Never connects to Supabase/GHL. Only the explicit fixture path is usable.
export async function getAllocationDraft() {
  throw new Error("Real reads disabled in visual harness");
}
export async function saveAllocationDraft() {
  throw new Error("Real writes disabled in visual harness");
}
export async function getProjectOpportunityLinks() {
  throw new Error("Real reads disabled in visual harness");
}
export async function linkProjectOpportunity() {
  throw new Error("Real writes disabled in visual harness");
}

export function agendaScope(me: { role: string | null; artistId: string | null; sellerId?: string | null } | undefined) {
  if (me?.role === "admin") return { allowed: true, artistId: null };
  if (me?.role === "artist" && me.artistId?.trim()) return { allowed: true, artistId: me.artistId };
  // Seller agenda access is not a proven artist/calendar scope.
  return { allowed: false, artistId: "unlinked" };
}

export function scopedAgendaStaff<T extends { id: string }>(staff: T[], artistId: string | null | undefined, enabled: boolean) {
  if (!enabled) return [];
  return staff.filter(s => artistId ? s.id === artistId : true);
}
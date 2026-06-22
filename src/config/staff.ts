/**
 * Static GHL location ID for the studio. This identifies the GHL
 * sub-account that owns all calendars/contacts/appointments.
 */
export const LOCATION_ID = "9iqrKUVPDddINb9S4Iwd";

/**
 * View-model shape consumed by the UI. The `STAFF` array used to live
 * here as a hardcoded list — it now comes from `useArtists()` reading
 * the `artists` table in Supabase.
 */
export interface StaffMember {
  id: string;
  name: string;
  shortName: string;
  calendarId: string;
  initials: string;
  color: string; // tailwind bg utility
  userId?: string;
  avatarUrl?: string | null;
}
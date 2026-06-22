export interface StaffMember {
  id: string;
  name: string;
  shortName: string;
  calendarId: string;
  initials: string;
  color: string; // tailwind bg utility
}

export const LOCATION_ID = "9iqrKUVPDddINb9S4Iwd";

export const STAFF: StaffMember[] = [
  {
    id: "gabriel",
    name: "Gabriel Fernandes",
    shortName: "Gabriel",
    calendarId: "9PS3KanirlXnDSO63ZYY",
    initials: "GF",
    color: "bg-red-700",
  },
  {
    id: "joyce",
    name: "Joyce Cavalcante",
    shortName: "Joyce",
    calendarId: "Ojt1BSSdALIUFZD0Avne",
    initials: "JC",
    color: "bg-purple-700",
  },
  {
    id: "andre",
    name: "Andre Pareyn",
    shortName: "Andre",
    calendarId: "suBooHKzS7WTsdHOIiHJ",
    initials: "AP",
    color: "bg-blue-700",
  },
  {
    id: "augusto",
    name: "Augusto Araújo",
    shortName: "Augusto",
    calendarId: "jmY0k5TETg6ti3FRpHMn",
    initials: "AA",
    color: "bg-emerald-700",
  },
  {
    id: "randevu",
    name: "Randevu (geral)",
    shortName: "Randevu",
    calendarId: "NzAYeRNJnvfpu7ynyoEK",
    initials: "RD",
    color: "bg-zinc-600",
  },
];
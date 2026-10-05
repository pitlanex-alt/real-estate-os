import type {
  AttendanceStatus,
  InterestLevel,
  NextAction,
  ViewingDetails,
  ViewingGuest,
} from "@/app/data/viewing";
import { formatViewingDateTimeRange } from "@/lib/datetime/iceland";
import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;

type ViewingRow = {
  id: string;
  viewing_type: string;
  starts_at: string;
  ends_at: string;
  status: ViewingDetails["status"];
  completed_at: string | null;
  transaction: Relation<{
    property: Relation<{ address_line: string }>;
  }>;
};

type GuestRow = {
  id: string;
  attendance: "registered" | "attended" | "no_show";
  interest: "very_interested" | "interested" | "unsure" | "not_interested" | "unset";
  internal_notes: string;
  next_action: string | null;
  is_walk_in: boolean;
  contact: Relation<{
    full_name: string;
    phone: string | null;
    email: string | null;
  }>;
};

function one<T>(value: Relation<T>) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

const attendanceFromDatabase: Record<GuestRow["attendance"], AttendanceStatus> = {
  registered: "registered",
  attended: "attended",
  no_show: "absent",
};

const interestFromDatabase: Record<GuestRow["interest"], InterestLevel> = {
  very_interested: "very",
  interested: "interested",
  unsure: "unsure",
  not_interested: "not-interested",
  unset: "unset",
};

const allowedNextActions = new Set<NextAction>(["today", "tomorrow", "second-viewing", "wait", "none"]);

export function mapGuestRow(row: GuestRow): ViewingGuest | null {
  const contact = one(row.contact);
  if (!contact) return null;
  const nextAction = row.next_action && allowedNextActions.has(row.next_action as NextAction)
    ? row.next_action as NextAction
    : "wait";

  return {
    id: row.id,
    name: contact.full_name,
    phone: contact.phone ?? "Sími ekki skráður",
    email: contact.email ?? "Netfang ekki skráð",
    attendance: attendanceFromDatabase[row.attendance],
    interest: interestFromDatabase[row.interest],
    note: row.internal_notes,
    nextAction,
    walkIn: row.is_walk_in,
  };
}

export async function getViewingDetail(viewingId: string): Promise<{
  viewing: ViewingDetails | null;
  guests: ViewingGuest[];
  error: string | null;
}> {
  const supabase = await createClient();
  const [viewingResult, guestsResult] = await Promise.all([
    supabase
      .from("viewings")
      .select(`
        id,
        viewing_type,
        starts_at,
        ends_at,
        status,
        completed_at,
        transaction:transactions!viewings_transaction_id_fkey(
          property:properties!transactions_property_id_fkey(address_line)
        )
      `)
      .eq("id", viewingId)
      .maybeSingle(),
    supabase
      .from("viewing_guests")
      .select(`
        id,
        attendance,
        interest,
        internal_notes,
        next_action,
        is_walk_in,
        contact:contacts!viewing_guests_contact_id_fkey(full_name, phone, email)
      `)
      .eq("viewing_id", viewingId)
      .order("created_at"),
  ]);

  if (viewingResult.error || guestsResult.error) {
    console.error("Unable to load viewing", viewingResult.error ?? guestsResult.error);
    return { viewing: null, guests: [], error: "Ekki tókst að sækja skoðunina." };
  }
  if (!viewingResult.data) {
    return { viewing: null, guests: [], error: null };
  }

  const row = viewingResult.data as unknown as ViewingRow;
  const transaction = one(row.transaction);
  const property = one(transaction?.property ?? null);
  const viewing: ViewingDetails = {
    id: row.id,
    title: row.viewing_type === "open_house" ? "Opið hús" : "Skoðun",
    address: property?.address_line ?? "Eign",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    dateTimeLabel: formatViewingDateTimeRange(row.starts_at, row.ends_at),
    status: row.status,
    completedAt: row.completed_at,
  };
  const guests = ((guestsResult.data ?? []) as unknown as GuestRow[])
    .map(mapGuestRow)
    .filter((guest): guest is ViewingGuest => guest !== null);

  return { viewing, guests, error: null };
}

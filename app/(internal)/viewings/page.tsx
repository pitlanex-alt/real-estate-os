import { requireInternalIdentity } from "@/lib/auth/post-auth";
import { createClient } from "@/lib/supabase/server";
import { ViewingsList, type ViewingListItem } from "./ViewingsList";

type Relation<T> = T | T[] | null;

type ViewingRow = {
  id: string;
  viewing_type: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "active" | "completed" | "cancelled";
  transaction: Relation<{
    stage: string;
    property: Relation<{
      slug: string;
      address_line: string;
      postal_code: string;
      municipality: string;
    }>;
  }>;
  guests: Array<{
    attendance: "registered" | "attended" | "no_show";
    interest: "very_interested" | "interested" | "unsure" | "not_interested" | "unset";
  }> | null;
};

function one<T>(value: Relation<T>) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function ViewingsPage() {
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);
  const { data, error } = await supabase
    .from("viewings")
    .select(`
      id,
      viewing_type,
      starts_at,
      ends_at,
      status,
      transaction:transactions!viewings_transaction_id_fkey(
        stage,
        property:properties!transactions_property_id_fkey(slug, address_line, postal_code, municipality)
      ),
      guests:viewing_guests!viewing_guests_viewing_id_fkey(attendance, interest)
    `)
    .eq("organization_id", identity.organizationId)
    .order("starts_at", { ascending: false });

  if (error) console.error("Unable to load viewings", error);
  const viewings = (data ?? []) as unknown as ViewingRow[];
  const items = viewings.flatMap((viewing): ViewingListItem[] => {
    const transaction = one(viewing.transaction);
    const property = one(transaction?.property ?? null);
    if (!transaction || !property) return [];
    const guests = viewing.guests ?? [];
    return [{ id: viewing.id, type: viewing.viewing_type, startsAt: viewing.starts_at, endsAt: viewing.ends_at, status: viewing.status, transactionStage: transaction.stage, property: { slug: property.slug, address: property.address_line, postalCode: property.postal_code, municipality: property.municipality }, registered: guests.length, attended: guests.filter((guest) => guest.attendance === "attended").length, veryInterested: guests.filter((guest) => guest.interest === "very_interested").length }];
  });

  return (
    <>
      <div className="mx-auto w-full max-w-[1336px] px-4 pb-16 pt-8 sm:px-6 lg:px-10 xl:px-12">
        <header>
          <h1 className="text-[28px] font-bold tracking-[-0.04em] text-[var(--text-primary)]">
            Skoðanir
          </h1>
          <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
            Yfirlit yfir skoðanir fasteignasölunnar.
          </p>
        </header>

        {error ? (
          <p className="mt-6 rounded-[14px] border border-[#b75e56]/20 bg-[#f7e7e5] px-4 py-3 text-[#914b45]">
            Ekki tókst að sækja skoðanir.
          </p>
        ) : <ViewingsList viewings={items} nowIso={new Date().toISOString()} />}
      </div>
    </>
  );
}

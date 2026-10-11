import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/app/components/AppShell";
import { requireInternalIdentity } from "@/lib/auth/post-auth";
import {
  formatIcelandicDateWithYear,
  formatIcelandicTime,
} from "@/lib/datetime/iceland";
import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;

type ViewingRow = {
  id: string;
  viewing_type: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "active" | "completed" | "cancelled";
  transaction: Relation<{
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

const statusLabels: Record<ViewingRow["status"], string> = {
  scheduled: "Áætluð",
  active: "Í gangi",
  completed: "Lokið",
  cancelled: "Hætt við",
};

const statusClasses: Record<ViewingRow["status"], string> = {
  scheduled: "bg-[#edf3e9] text-[#58704f]",
  active: "bg-[#e8f0e3] text-[#43563d]",
  completed: "bg-[#f0f2ef] text-[#747b73]",
  cancelled: "bg-[#f7e7e5] text-[#914b45]",
};

function one<T>(value: Relation<T>) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function viewingTypeLabel(type: string) {
  return type === "open_house" ? "Opið hús" : "Skoðun";
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
        property:properties!transactions_property_id_fkey(slug, address_line, postal_code, municipality)
      ),
      guests:viewing_guests!viewing_guests_viewing_id_fkey(attendance, interest)
    `)
    .eq("organization_id", identity.organizationId)
    .order("starts_at", { ascending: false });

  if (error) console.error("Unable to load viewings", error);
  const viewings = (data ?? []) as unknown as ViewingRow[];

  return (
    <AppShell activeItem="Skoðanir" identity={identity}>
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
        ) : (
          <section className="kelvo-card mt-6 overflow-hidden px-3 sm:px-4">
            {viewings.map((viewing) => {
              const transaction = one(viewing.transaction);
              const property = one(transaction?.property ?? null);
              if (!property) return null;
              const guests = viewing.guests ?? [];
              const attended = guests.filter((guest) => guest.attendance === "attended").length;
              const interested = guests.filter((guest) => guest.interest === "very_interested").length;

              return (
                <Link
                  key={viewing.id}
                  href={`/properties/${property.slug}/viewings/${viewing.id}?from=viewings`}
                  className="group grid min-h-[84px] items-center gap-3 border-b border-black/[0.06] px-2 py-4 last:border-b-0 sm:grid-cols-[minmax(190px,1.35fr)_minmax(180px,1fr)_auto_auto] sm:gap-6"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                      {property.address_line}
                    </p>
                    <p className="mt-1 text-[10.5px] text-[var(--text-secondary)]">
                      {property.postal_code} {property.municipality}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11.5px] font-medium text-[#434943]">
                      {viewingTypeLabel(viewing.viewing_type)}
                    </p>
                    <p className="mt-1 text-[10.5px] text-[var(--text-secondary)]">
                      {formatIcelandicDateWithYear(viewing.starts_at)} · {formatIcelandicTime(viewing.starts_at)}–{formatIcelandicTime(viewing.ends_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-[10.5px] text-[var(--text-secondary)]">
                    <span>{guests.length} skráðir</span>
                    <span>{attended} mættir</span>
                    <span>{interested} mjög áhugasamir</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className={`${statusClasses[viewing.status]} rounded-full px-2.5 py-1 text-[10px] font-semibold`}>
                      {statusLabels[viewing.status]}
                    </span>
                    <ChevronRight size={15} className="text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-primary)]" />
                  </div>
                </Link>
              );
            })}
            {!viewings.length && (
              <p className="py-12 text-center text-[12px] text-[var(--text-secondary)]">
                Engar skoðanir hafa verið skráðar.
              </p>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}

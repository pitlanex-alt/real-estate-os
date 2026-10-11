import type { AttentionItem, Metric, Property, ScheduleItem } from "@/app/data/dashboard";
import {
  compareIcelandicDays,
  formatIcelandicRelativeDay,
  formatIcelandicTime,
  getIcelandicDayRange,
  isPastInstant,
} from "@/lib/datetime/iceland";
import { getIndexedProperties } from "@/lib/properties/list";
import { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Relation<T> = T | T[] | null;

function one<T>(value: Relation<T>) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getDashboardData(supabase: Client, organizationId: string, now = new Date()) {
  const { start, end } = getIcelandicDayRange(now);
  const nowIso = now.toISOString();
  const activeOfferStatuses = ["submitted", "change_requested", "agent_approved", "sent_to_seller", "seller_intent_recorded"];
  const [propertiesResult, futureViewings, todayViewings, tasks, offers, allViewings, guests] = await Promise.all([
    getIndexedProperties(organizationId),
    supabase
      .from("viewings")
      .select("id,transaction_id,viewing_type,starts_at,status,transaction:transactions!viewings_transaction_id_fkey(property:properties!transactions_property_id_fkey(address_line))")
      .eq("organization_id", organizationId)
      .eq("status", "scheduled")
      .gte("starts_at", nowIso)
      .order("starts_at")
      .limit(12),
    supabase
      .from("viewings")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("starts_at", start)
      .lte("starts_at", end)
      .neq("status", "cancelled"),
    supabase
      .from("tasks")
      .select("id,title,status,due_at,transaction:transactions!tasks_transaction_id_fkey(property:properties!transactions_property_id_fkey(address_line))")
      .eq("organization_id", organizationId)
      .in("status", ["not_started", "in_progress"])
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("offers")
      .select("id,status,valid_until,transaction_id,transaction:transactions!offers_transaction_id_fkey(property:properties!transactions_property_id_fkey(address_line))")
      .eq("organization_id", organizationId)
      .in("status", activeOfferStatuses)
      .order("valid_until"),
    supabase.from("viewings").select("id,transaction_id").eq("organization_id", organizationId),
    supabase.from("viewing_guests").select("viewing_id,attendance,interest").eq("organization_id", organizationId),
  ]);
  const error = propertiesResult.error ?? futureViewings.error ?? todayViewings.error ?? tasks.error ?? offers.error ?? allViewings.error ?? guests.error;
  if (error) {
    console.error("Unable to load dashboard", error);
    return { metrics: [] as Metric[], schedule: [] as ScheduleItem[], attention: [] as AttentionItem[], properties: [] as Property[], error: "Ekki tókst að sækja yfirlitið." };
  }

  const viewingToTransaction = new Map((allViewings.data ?? []).map((viewing) => [viewing.id, viewing.transaction_id]));
  const counts = new Map<string, { registered: number; attended: number; interested: number }>();
  for (const guest of guests.data ?? []) {
    const transactionId = viewingToTransaction.get(guest.viewing_id);
    if (!transactionId) continue;
    const value = counts.get(transactionId) ?? { registered: 0, attended: 0, interested: 0 };
    value.registered++;
    if (guest.attendance === "attended") value.attended++;
    if (["very_interested", "interested"].includes(guest.interest)) value.interested++;
    counts.set(transactionId, value);
  }

  const dashboardProperties = propertiesResult.properties.slice(0, 3).map((property, index): Property => {
    const count = counts.get(property.id);
    return {
      id: property.id,
      href: property.href,
      address: property.address,
      location: property.location,
      status: property.stage,
      note: property.nextAction,
      noteTone: property.nextActionTone,
      registered: count ? String(count.registered) : "—",
      attended: count ? String(count.attended) : "—",
      interested: count ? String(count.interested) : "—",
      agent: { name: property.agent, initials: property.agentInitials, photoUrl: property.agentPhotoUrl },
      imageVariant: property.imageVariant ?? (["city", "coast", "stone"] as const)[index % 3],
      imageUrl: property.imageUrl,
    };
  });

  const futureRows = (futureViewings.data ?? []).filter((viewing) => !isPastInstant(viewing.starts_at, now));
  const todayRows = futureRows.filter((viewing) => compareIcelandicDays(viewing.starts_at, now) === 0);
  const visibleRows = todayRows.length ? todayRows : futureRows.slice(0, 1);
  const schedule = visibleRows.flatMap((viewing): ScheduleItem[] => {
    const transaction = one(viewing.transaction as Relation<{ property: Relation<{ address_line: string }> }>);
    const property = one(transaction?.property ?? null);
    return property ? [{
      time: formatIcelandicTime(viewing.starts_at),
      dayLabel: formatIcelandicRelativeDay(viewing.starts_at, now),
      type: viewing.viewing_type === "open_house" ? "Opið hús" : "Skoðun",
      address: property.address_line,
    }] : [];
  });

  const attention: AttentionItem[] = [];
  for (const task of (tasks.data ?? []).slice(0, 3)) {
    const transaction = one(task.transaction as Relation<{ property: Relation<{ address_line: string }> }>);
    const property = one(transaction?.property ?? null);
    const overdue = Boolean(task.due_at && isPastInstant(task.due_at, now));
    attention.push({
      title: task.title,
      detail: `${overdue ? "Komið fram yfir · " : ""}${property?.address_line ?? "Verkefni"}`,
      tone: overdue ? "warning" : "neutral",
    });
  }
  for (const offer of (offers.data ?? []).slice(0, Math.max(0, 4 - attention.length))) {
    const transaction = one(offer.transaction as Relation<{ property: Relation<{ address_line: string }> }>);
    const property = one(transaction?.property ?? null);
    const expired = isPastInstant(offer.valid_until, now);
    attention.push({
      title: expired ? "Gildistími tilboðs er liðinn" : "Virkt tilboð bíður aðgerðar",
      detail: property?.address_line ?? "Tilboð",
      tone: expired || new Date(offer.valid_until).getTime() < now.getTime() + 4 * 60 * 60 * 1000 ? "warning" : "neutral",
    });
  }
  const metrics: Metric[] = [
    { value: String(todayViewings.count ?? 0), label: "Skoðanir í dag" },
    { value: String(tasks.data?.length ?? 0), label: "Verkefni í bið" },
    { value: String(offers.data?.length ?? 0), label: "Virk tilboð" },
    { value: String(propertiesResult.properties.filter((property) => property.stage !== "Lokið").length), label: "Virkar fasteignir" },
  ];
  return { metrics, schedule, attention, properties: dashboardProperties, error: null };
}

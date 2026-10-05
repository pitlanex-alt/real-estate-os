import type { IndexedProperty, PropertyStage } from "@/app/data/properties-index";
import { createClient } from "@/lib/supabase/server";
import { propertyRouteSlug } from "@/lib/portal/customer";

type Relation<T> = T | T[] | null;

type RawTransaction = {
  id: string;
  stage: string;
  asking_price_isk: number | null;
  property: Relation<{
    address_line: string;
    postal_code: string;
    municipality: string;
  }>;
  agent: Relation<{ display_name: string }>;
  parties: Array<{
    role: string;
    is_primary: boolean;
    contact: Relation<{ full_name: string }>;
  }> | null;
  events: Array<{
    event_type: string;
    summary: string;
    created_at: string;
  }> | null;
};

const stageLabels: Record<string, PropertyStage> = {
  valuation: "Verðmat",
  preparation: "Undirbúningur",
  listed: "Á sölu",
  viewings: "Skoðanir",
  offers: "Tilboð",
  contract: "Samningur",
  closing: "Frágangur",
  handover: "Afhending",
  completed: "Lokið",
  cancelled: "Lokið",
};

function one<T>(relation: Relation<T>): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("is"))
    .join("");
}

function formatPrice(value: number | null) {
  return value === null ? "Verð ekki skráð" : `${value.toLocaleString("is-IS")} kr.`;
}

export async function getIndexedProperties(): Promise<{
  properties: IndexedProperty[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(`
      id,
      stage,
      asking_price_isk,
      property:properties!transactions_property_id_fkey(address_line, postal_code, municipality),
      agent:profiles!transactions_assigned_agent_id_fkey(display_name),
      parties:transaction_parties!transaction_parties_transaction_id_fkey(
        role,
        is_primary,
        contact:contacts!transaction_parties_contact_id_fkey(full_name)
      ),
      events:activity_events!activity_events_transaction_id_fkey(event_type, summary, created_at)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load properties", error);
    return {
      properties: [],
      error: "Ekki tókst að sækja eignir. Reyndu aftur eftir augnablik.",
    };
  }

  const properties = ((data ?? []) as unknown as RawTransaction[]).flatMap((transaction, index) => {
    const property = one(transaction.property);
    const agent = one(transaction.agent);
    if (!property || !agent) return [];

    const sellerParty = transaction.parties?.find(
      (party) => party.role === "seller" && party.is_primary,
    );
    const seller = one(sellerParty?.contact ?? null)?.full_name ?? "Seljandi ekki skráður";
    const nextAction = transaction.events
      ?.filter((event) => event.event_type === "next_action")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.summary;
    const stage = stageLabels[transaction.stage] ?? "Undirbúningur";
    const variants: IndexedProperty["imageVariant"][] = ["city", "coast", "stone"];

    return [{
      id: transaction.id,
      href: `/properties/${propertyRouteSlug(property.address_line)}`,
      address: property.address_line,
      location: `${property.postal_code} ${property.municipality}`,
      seller,
      price: formatPrice(transaction.asking_price_isk),
      stage,
      nextAction: nextAction ?? "Fara yfir næstu skref",
      nextActionTone: (nextAction && /tilboð|vantar/i.test(nextAction) ? "warning" : "neutral") as IndexedProperty["nextActionTone"],
      agent: agent.display_name,
      agentInitials: initials(agent.display_name),
      imageVariant: variants[index % variants.length],
    }];
  });

  return { properties, error: null };
}

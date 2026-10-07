import { getPropertyImages, type PropertyImage } from "@/lib/property-images/server";
import { createClient } from "@/lib/supabase/server";
import { getInternalWorkItems } from "@/lib/work-items/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
type Relation<T> = T | T[] | null;

function one<T>(value: Relation<T>) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export type PropertyWorkspaceData = {
  slug: string;
  propertyId: string;
  transactionId: string;
  address: string;
  postalCode: string;
  municipality: string;
  registryNumber: string | null;
  sizeSqm: number | null;
  roomCount: number | null;
  bedroomCount: number | null;
  yearBuilt: number | null;
  stage: string;
  askingPriceIsk: number | null;
  agent: string;
  agentTitle: string | null;
  agentPhone: string | null;
  agentEmail: string | null;
  images: PropertyImage[];
  sellers: string[];
  viewings: Array<{ id: string; type: string; startsAt: string; endsAt: string; status: string }>;
  offers: Array<{ id: string; amountIsk: number; status: string; validUntil: string }>;
  tasks: Awaited<ReturnType<typeof getInternalWorkItems>>["tasks"];
  documents: Awaited<ReturnType<typeof getInternalWorkItems>>["documents"];
  activities: Array<{ id: string; summary: string; eventType: string; createdAt: string }>;
};

type TransactionCandidate = {
  id: string;
  stage: string;
  asking_price_isk: number | null;
  started_at: string;
  property: Relation<{
    id: string;
    slug: string;
    address_line: string;
    postal_code: string;
    municipality: string;
    registry_number: string | null;
    size_sqm: number | null;
    room_count: number | null;
    bedroom_count: number | null;
    year_built: number | null;
  }>;
  agent: Relation<{ display_name: string; professional_title: string | null; phone: string | null; email: string | null }>;
  parties: Array<{
    role: string;
    contact: Relation<{ full_name: string }>;
  }> | null;
};

export async function getPropertyWorkspace(
  supabase: ServerSupabaseClient,
  propertySlug: string,
  organizationId: string,
): Promise<{ data: PropertyWorkspaceData | null; error: string | null }> {
  const { data: resolvedProperty, error: propertyError } = await supabase
    .from("properties")
    .select("id")
    .eq("slug", propertySlug)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (propertyError) {
    console.error("Unable to resolve property workspace", propertyError);
    return { data: null, error: "Ekki tókst að sækja vinnusvæði eignarinnar." };
  }
  if (!resolvedProperty) return { data: null, error: null };

  const { data: candidates, error: candidatesError } = await supabase
    .from("transactions")
    .select(`
      id, stage, asking_price_isk, started_at,
      property:properties!transactions_property_id_fkey(
        id, slug, address_line, postal_code, municipality, registry_number,
        size_sqm, room_count, bedroom_count, year_built
      ),
      agent:profiles!transactions_assigned_agent_id_fkey(display_name,professional_title,phone,email),
      parties:transaction_parties!transaction_parties_transaction_id_fkey(
        role, contact:contacts!transaction_parties_contact_id_fkey(full_name)
      )
    `)
    .eq("property_id", resolvedProperty.id)
    .order("started_at", { ascending: false });

  if (candidatesError) {
    console.error("Unable to resolve property workspace", candidatesError);
    return { data: null, error: "Ekki tókst að sækja vinnusvæði eignarinnar." };
  }

  const matchingTransactions = (candidates ?? []) as unknown as TransactionCandidate[];
  const transaction = matchingTransactions.find(
    (candidate) => candidate.stage !== "completed" && candidate.stage !== "cancelled",
  ) ?? matchingTransactions[0];

  const property = transaction ? one(transaction.property) : null;
  const agent = transaction ? one(transaction.agent) : null;
  if (!transaction || !property || !agent) return { data: null, error: null };

  const [viewingsResult, offersResult, activityResult, workItems, imageMap] = await Promise.all([
    supabase
      .from("viewings")
      .select("id,viewing_type,starts_at,ends_at,status")
      .eq("transaction_id", transaction.id)
      .order("starts_at", { ascending: false }),
    supabase
      .from("offers")
      .select("id,amount_isk,status,valid_until")
      .eq("transaction_id", transaction.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_events")
      .select("id,event_type,summary,created_at")
      .eq("transaction_id", transaction.id)
      .order("created_at", { ascending: false })
      .limit(12),
    getInternalWorkItems(supabase, transaction.id),
    getPropertyImages(supabase, [property.id]),
  ]);

  const loadError = viewingsResult.error ?? offersResult.error ?? activityResult.error;
  if (loadError || workItems.error) {
    console.error("Unable to load property workspace relations", loadError ?? workItems.error);
    return { data: null, error: "Ekki tókst að sækja vinnusvæði eignarinnar." };
  }

  const sellers = (transaction.parties ?? [])
    .filter((party) => party.role === "seller" || party.role === "co_owner")
    .flatMap((party) => {
      const contact = one(party.contact);
      return contact ? [contact.full_name] : [];
    });

  return {
    data: {
      slug: propertySlug,
      propertyId: property.id,
      transactionId: transaction.id,
      address: property.address_line,
      postalCode: property.postal_code,
      municipality: property.municipality,
      registryNumber: property.registry_number,
      sizeSqm: property.size_sqm,
      roomCount: property.room_count,
      bedroomCount: property.bedroom_count,
      yearBuilt: property.year_built,
      stage: transaction.stage,
      askingPriceIsk: transaction.asking_price_isk,
      agent: agent.display_name,
      agentTitle: agent.professional_title,
      agentPhone: agent.phone,
      agentEmail: agent.email,
      images: imageMap.get(property.id) ?? [],
      sellers,
      viewings: (viewingsResult.data ?? []).map((viewing) => ({
        id: viewing.id,
        type: viewing.viewing_type,
        startsAt: viewing.starts_at,
        endsAt: viewing.ends_at,
        status: viewing.status,
      })),
      offers: (offersResult.data ?? []).map((offer) => ({
        id: offer.id,
        amountIsk: Number(offer.amount_isk),
        status: offer.status,
        validUntil: offer.valid_until,
      })),
      tasks: workItems.tasks,
      documents: workItems.documents,
      activities: (activityResult.data ?? []).map((activity) => ({
        id: activity.id,
        summary: activity.summary,
        eventType: activity.event_type,
        createdAt: activity.created_at,
      })),
    },
    error: null,
  };
}

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
  listing: {
    propertyType: string | null;
    floor: number | null;
    parking: string | null;
    monthlyFeesIsk: number | null;
    title: string | null;
    description: string | null;
    highlights: string[];
    sellerApproved: boolean;
    sellerResponse: {
      type: "approved" | "changes_requested";
      feedback: string | null;
      submittedAt: string;
      isCurrent: boolean;
    } | null;
    requiredDocumentsReady: boolean;
    readiness: "not_started" | "in_progress" | "ready";
    factsComplete: boolean;
    photosUploaded: boolean;
    descriptionComplete: boolean;
    publishing: {
      state: "not_ready" | "needs_attention" | "ready_to_publish";
      readyForPublishAt: string | null;
      requirements: Array<{ key: string; label: string; complete: boolean }>;
    };
  };
  agent: string;
  agentTitle: string | null;
  agentPhone: string | null;
  agentEmail: string | null;
  images: PropertyImage[];
  sellers: string[];
  viewings: Array<{ id: string; type: string; startsAt: string; endsAt: string; status: string }>;
  offers: Array<{
    id: string;
    amountIsk: number;
    status: string;
    validUntil: string;
    requestedHandoverDate: string;
    buyerName: string;
    conditions: Array<{ type: string; status: string | null; details: string | null }>;
  }>;
  tasks: Awaited<ReturnType<typeof getInternalWorkItems>>["tasks"];
  documents: Awaited<ReturnType<typeof getInternalWorkItems>>["documents"];
  activities: Array<{ id: string; summary: string; eventType: string; createdAt: string }>;
};

type TransactionCandidate = {
  id: string;
  stage: string;
  asking_price_isk: number | null;
  listing_title: string | null;
  listing_description: string | null;
  listing_highlights: string[] | null;
  listing_seller_approved: boolean;
  listing_documents_ready: boolean;
  listing_readiness: "not_started" | "in_progress" | "ready";
  listing_revision: number;
  ready_for_publish_at: string | null;
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
    property_type: string | null;
    floor: number | null;
    parking: string | null;
    monthly_fees_isk: number | null;
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
      listing_title, listing_description, listing_highlights,
      listing_seller_approved, listing_documents_ready, listing_readiness,
      listing_revision, ready_for_publish_at,
      property:properties!transactions_property_id_fkey(
        id, slug, address_line, postal_code, municipality, registry_number,
        size_sqm, room_count, bedroom_count, year_built,
        property_type, floor, parking, monthly_fees_isk
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

  const [viewingsResult, offersResult, activityResult, sellerResponseResult, workItems, imageMap] = await Promise.all([
    supabase
      .from("viewings")
      .select("id,viewing_type,starts_at,ends_at,status")
      .eq("transaction_id", transaction.id)
      .order("starts_at", { ascending: false }),
    supabase
      .from("offers")
      .select(`
        id,amount_isk,status,valid_until,requested_handover_date,
        buyer:contacts!offers_buyer_contact_id_fkey(full_name),
        conditions:offer_conditions!offer_conditions_offer_id_fkey(condition_type,status,details)
      `)
      .eq("transaction_id", transaction.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_events")
      .select("id,event_type,summary,created_at")
      .eq("transaction_id", transaction.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("seller_listing_responses")
      .select("response_type,feedback,submitted_at,listing_revision")
      .eq("transaction_id", transaction.id)
      .order("submitted_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getInternalWorkItems(supabase, transaction.id),
    getPropertyImages(supabase, [property.id]),
  ]);

  const loadError = viewingsResult.error ?? offersResult.error ?? activityResult.error ?? sellerResponseResult.error;
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
  const images = imageMap.get(property.id) ?? [];
  const factsComplete = Boolean(
    property.property_type?.trim()
    && property.size_sqm !== null
    && property.room_count !== null
    && property.year_built !== null,
  );
  const descriptionComplete = Boolean(
    transaction.listing_title?.trim() && transaction.listing_description?.trim(),
  );
  const sellerResponseCurrent = Boolean(
    sellerResponseResult.data
    && sellerResponseResult.data.listing_revision === transaction.listing_revision,
  );
  const sellerApproved = Boolean(
    sellerResponseCurrent && sellerResponseResult.data?.response_type === "approved",
  );
  const publishRequirements = [
    { key: "property_type", label: "Tegund eignar", complete: Boolean(property.property_type?.trim()) },
    { key: "size", label: "Stærð eignar", complete: property.size_sqm !== null },
    { key: "room_count", label: "Fjöldi herbergja", complete: property.room_count !== null },
    { key: "year_built", label: "Byggingarár", complete: property.year_built !== null },
    { key: "listing_title", label: "Fyrirsögn skráningar", complete: Boolean(transaction.listing_title?.trim()) },
    { key: "listing_description", label: "Lýsing skráningar", complete: Boolean(transaction.listing_description?.trim()) },
    { key: "property_image", label: "Að minnsta kosti ein mynd", complete: images.length > 0 },
    { key: "required_documents", label: "Nauðsynleg skjöl tilbúin", complete: transaction.listing_documents_ready },
    { key: "seller_approval", label: "Gilt samþykki seljanda", complete: sellerApproved },
  ];
  const publishRequirementsMet = publishRequirements.every((requirement) => requirement.complete);
  const publishingState = transaction.ready_for_publish_at && publishRequirementsMet
    ? "ready_to_publish"
    : publishRequirements.some((requirement) => requirement.complete)
      ? "needs_attention"
      : "not_ready";

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
      listing: {
        propertyType: property.property_type,
        floor: property.floor,
        parking: property.parking,
        monthlyFeesIsk: property.monthly_fees_isk === null ? null : Number(property.monthly_fees_isk),
        title: transaction.listing_title,
        description: transaction.listing_description,
        highlights: transaction.listing_highlights ?? [],
        sellerApproved: transaction.listing_seller_approved,
        sellerResponse: sellerResponseResult.data ? {
          type: sellerResponseResult.data.response_type as "approved" | "changes_requested",
          feedback: sellerResponseResult.data.feedback,
          submittedAt: sellerResponseResult.data.submitted_at,
          isCurrent: sellerResponseCurrent,
        } : null,
        requiredDocumentsReady: transaction.listing_documents_ready,
        readiness: transaction.listing_readiness,
        factsComplete,
        photosUploaded: images.length > 0,
        descriptionComplete,
        publishing: {
          state: publishingState,
          readyForPublishAt: transaction.ready_for_publish_at,
          requirements: publishRequirements,
        },
      },
      agent: agent.display_name,
      agentTitle: agent.professional_title,
      agentPhone: agent.phone,
      agentEmail: agent.email,
      images,
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
        requestedHandoverDate: offer.requested_handover_date,
        buyerName: one(offer.buyer)?.full_name ?? "Óskráður kaupandi",
        conditions: (offer.conditions ?? []).map((condition) => ({
          type: condition.condition_type,
          status: condition.status,
          details: condition.details,
        })),
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

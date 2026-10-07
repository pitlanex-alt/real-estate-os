import { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}

export type CustomerPropertySummary = {
  transactionId: string;
  askingPriceIsk: number;
  property: { address: string; postalCode: string; municipality: string; sizeSqm: number | null; bedroomCount: number | null; yearBuilt: number | null };
  agent: { name: string; title?: string | null; phone: string | null; email?: string | null };
  customer: { name: string; phone: string | null; email: string | null };
  stage?: string;
  coverImageUrl?: string | null;
};

export type SellerListingReview = {
  transactionId: string;
  title: string | null;
  description: string | null;
  highlights: string[];
  askingPriceIsk: number | null;
  readiness: "not_started" | "in_progress" | "ready";
  property: {
    address: string;
    postalCode: string;
    municipality: string;
    propertyType: string | null;
    floor: number | null;
    parking: string | null;
    monthlyFeesIsk: number | null;
    sizeSqm: number | null;
    roomCount: number | null;
    bedroomCount: number | null;
    yearBuilt: number | null;
  };
  checklist: {
    propertyFactsComplete: boolean;
    photosUploaded: boolean;
    descriptionComplete: boolean;
    sellerApproved: boolean;
    requiredDocumentsReady: boolean;
  };
  latestResponse: {
    type: "approved" | "changes_requested";
    feedback: string | null;
    submittedAt: string;
  } | null;
  images: Array<{ id: string; fileName: string; isCover: boolean; sortOrder: number; url: string | null }>;
};

export type PortalResult<T> = { data: T | null; denied: boolean; error: string | null };
export type CustomerPortalDestination = {
  transactionId: string;
  role: "seller" | "co_owner" | "accepted_buyer";
  propertySlug: string;
  address: string;
  postalCode: string;
  municipality: string;
};

export function customerPortalPath(destination: CustomerPortalDestination) {
  const audience = destination.role === "accepted_buyer" ? "buyer" : "seller";
  return `/${audience}/${destination.propertySlug}`;
}

export async function getCustomerPortalDestinations(
  supabaseClient?: ServerSupabaseClient,
): Promise<PortalResult<CustomerPortalDestination[]>> {
  const supabase = supabaseClient ?? await createClient();
  const { data, error } = await supabase.rpc("customer_portal_destinations");
  if (error) return { data: null, denied: error.code === "42501" || error.code === "28000", error: error.message };
  const destinations = (Array.isArray(data) ? data : []).map((value) => {
    const row = record(value);
    if (!row) return null;
    return {
      transactionId: String(row.transaction_id),
      role: String(row.role) as CustomerPortalDestination["role"],
      propertySlug: String(row.property_slug),
      address: String(row.address),
      postalCode: String(row.postal_code),
      municipality: String(row.municipality),
    };
  }).filter((value): value is CustomerPortalDestination => value !== null);
  return { data: destinations, denied: false, error: null };
}

function parseSummary(value: unknown): CustomerPropertySummary | null {
  const row = record(value); const property = record(row?.property); const agent = record(row?.agent); const customer = record(row?.customer);
  if (!row || !property || !agent || !customer) return null;
  return {
    transactionId: String(row.transaction_id), askingPriceIsk: Number(row.asking_price_isk),
    property: { address: String(property.address), postalCode: String(property.postal_code), municipality: String(property.municipality), sizeSqm: property.size_sqm == null ? null : Number(property.size_sqm), bedroomCount: property.bedroom_count == null ? null : Number(property.bedroom_count), yearBuilt: property.year_built == null ? null : Number(property.year_built) },
    agent: { name: String(agent.name), phone: agent.phone ? String(agent.phone) : null },
    customer: { name: String(customer.name), phone: customer.phone ? String(customer.phone) : null, email: customer.email ? String(customer.email) : null },
    stage: row.stage ? String(row.stage) : undefined,
  };
}

function rpcResult<T>(data: unknown, error: { message: string; code?: string } | null, parser: (value: unknown) => T | null): PortalResult<T> {
  if (error) return { data: null, denied: error.code === "42501" || error.code === "28000", error: error.message };
  const parsed = parser(data);
  return parsed ? { data: parsed, denied: false, error: null } : { data: null, denied: true, error: null };
}

export async function getSellerTransactionSummary(transactionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("seller_transaction_summary", { p_transaction_id: transactionId });
  return rpcResult(data, error, parseSummary);
}

export async function getBuyerPropertySummary(transactionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buyer_property_summary", { p_transaction_id: transactionId });
  return rpcResult(data, error, parseSummary);
}

export function customerInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export async function getCustomerDestinationBySlug(
  propertySlug: string,
  audience: "seller" | "buyer",
  supabaseClient?: ServerSupabaseClient,
) {
  const result = await getCustomerPortalDestinations(supabaseClient);
  if (result.error || !result.data) return { data: null, denied: result.denied, error: result.error };
  const destination = result.data.find((item) => {
    const correctAudience = audience === "buyer" ? item.role === "accepted_buyer" : item.role === "seller" || item.role === "co_owner";
    return correctAudience && item.propertySlug === propertySlug;
  }) ?? null;
  return { data: destination, denied: !destination, error: null };
}

export async function getCustomerTransactionOffers(transactionId: string, supabaseClient?: ServerSupabaseClient) {
  const supabase = supabaseClient ?? await createClient();
  const { data, error } = await supabase.rpc("customer_transaction_offers", { p_transaction_id: transactionId });
  if (error) return { data: [] as Array<{ id: string; status: string; amountIsk: number; validUntil: string }>, error: error.message };
  const offers = (Array.isArray(data) ? data : []).flatMap((value) => {
    const row = record(value);
    return row ? [{ id: String(row.id), status: String(row.status), amountIsk: Number(row.amount_isk), validUntil: String(row.valid_until) }] : [];
  });
  return { data: offers, error: null };
}

export async function getCustomerCoverImage(transactionId: string, supabaseClient?: ServerSupabaseClient) {
  const supabase = supabaseClient ?? await createClient();
  const { data, error } = await supabase.rpc("customer_property_images", { p_transaction_id: transactionId });
  if (error || !Array.isArray(data)) return null;
  const images = data.flatMap((value) => { const row = record(value); return row ? [{ path: String(row.storage_path), isCover: Boolean(row.is_cover), sortOrder: Number(row.sort_order) }] : []; });
  const cover = images.find((image) => image.isCover) ?? images.sort((a, b) => a.sortOrder - b.sortOrder)[0];
  if (!cover) return null;
  const signed = await supabase.storage.from("property-images").createSignedUrl(cover.path, 3600);
  return signed.data?.signedUrl ?? null;
}

function parseSellerListingReview(value: unknown): Omit<SellerListingReview, "images"> | null {
  const row = record(value);
  const property = record(row?.property);
  const readiness = record(row?.readiness);
  const latestResponse = record(row?.latest_response);
  if (!row || !property || !readiness) return null;
  const responseType = latestResponse?.response_type;
  return {
    transactionId: String(row.transaction_id),
    title: row.listing_title == null ? null : String(row.listing_title),
    description: row.listing_description == null ? null : String(row.listing_description),
    highlights: Array.isArray(row.listing_highlights) ? row.listing_highlights.map(String) : [],
    askingPriceIsk: row.asking_price_isk == null ? null : Number(row.asking_price_isk),
    readiness: String(row.listing_readiness) as SellerListingReview["readiness"],
    property: {
      address: String(property.address),
      postalCode: String(property.postal_code),
      municipality: String(property.municipality),
      propertyType: property.property_type == null ? null : String(property.property_type),
      floor: property.floor == null ? null : Number(property.floor),
      parking: property.parking == null ? null : String(property.parking),
      monthlyFeesIsk: property.monthly_fees_isk == null ? null : Number(property.monthly_fees_isk),
      sizeSqm: property.size_sqm == null ? null : Number(property.size_sqm),
      roomCount: property.room_count == null ? null : Number(property.room_count),
      bedroomCount: property.bedroom_count == null ? null : Number(property.bedroom_count),
      yearBuilt: property.year_built == null ? null : Number(property.year_built),
    },
    checklist: {
      propertyFactsComplete: Boolean(readiness.property_facts_complete),
      photosUploaded: Boolean(readiness.photos_uploaded),
      descriptionComplete: Boolean(readiness.description_complete),
      sellerApproved: Boolean(readiness.seller_approved),
      requiredDocumentsReady: Boolean(readiness.required_documents_ready),
    },
    latestResponse: latestResponse && (responseType === "approved" || responseType === "changes_requested") ? {
      type: responseType,
      feedback: latestResponse.feedback == null ? null : String(latestResponse.feedback),
      submittedAt: String(latestResponse.submitted_at),
    } : null,
  };
}

export async function getSellerListingReview(
  transactionId: string,
  supabaseClient?: ServerSupabaseClient,
): Promise<PortalResult<SellerListingReview>> {
  const supabase = supabaseClient ?? await createClient();
  const [{ data, error }, imagesResult] = await Promise.all([
    supabase.rpc("seller_listing_review", { p_transaction_id: transactionId }),
    supabase.rpc("customer_property_images", { p_transaction_id: transactionId }),
  ]);
  const parsed = parseSellerListingReview(data);
  if (error || !parsed) {
    return {
      data: null,
      denied: error?.code === "42501" || error?.code === "28000",
      error: error?.message ?? "Listing review is unavailable",
    };
  }
  if (imagesResult.error || !Array.isArray(imagesResult.data)) {
    return { data: { ...parsed, images: [] }, denied: false, error: null };
  }
  const imageRows = imagesResult.data.flatMap((value) => {
    const row = record(value);
    return row ? [{
      id: String(row.id),
      path: String(row.storage_path),
      fileName: String(row.file_name),
      isCover: Boolean(row.is_cover),
      sortOrder: Number(row.sort_order),
    }] : [];
  });
  const signed = imageRows.length
    ? await supabase.storage.from("property-images").createSignedUrls(imageRows.map((image) => image.path), 3600)
    : { data: [], error: null };
  const urls = new Map((signed.data ?? []).map((item) => [item.path, item.signedUrl]));
  return {
    data: {
      ...parsed,
      images: imageRows.map((image) => ({
        id: image.id,
        fileName: image.fileName,
        isCover: image.isCover,
        sortOrder: image.sortOrder,
        url: urls.get(image.path) ?? null,
      })),
    },
    denied: false,
    error: null,
  };
}

export async function getCustomerAgentProfile(transactionId: string, supabaseClient?: ServerSupabaseClient) {
  const supabase = supabaseClient ?? await createClient();
  const { data, error } = await supabase.rpc("customer_agent_profile", { p_transaction_id: transactionId });
  const row = record(data);
  if (error || !row) return null;
  return { name:String(row.name), title:row.title?String(row.title):null, phone:row.phone?String(row.phone):null, email:row.email?String(row.email):null };
}

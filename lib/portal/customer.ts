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
  agent: { name: string; phone: string | null };
  customer: { name: string; phone: string | null; email: string | null };
  stage?: string;
};

export type PortalResult<T> = { data: T | null; denied: boolean; error: string | null };
export type CustomerPortalDestination = {
  transactionId: string;
  role: "seller" | "co_owner" | "accepted_buyer";
  address: string;
  postalCode: string;
  municipality: string;
};

export function propertyRouteSlug(address: string) {
  return address.toLocaleLowerCase("is-IS").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ð/g, "d").replace(/þ/g, "th").replace(/æ/g, "ae").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function customerPortalPath(destination: CustomerPortalDestination) {
  const audience = destination.role === "accepted_buyer" ? "buyer" : "seller";
  return `/${audience}/${propertyRouteSlug(destination.address)}`;
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
    return correctAudience && propertyRouteSlug(item.address) === propertySlug;
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

import { createClient } from "@/lib/supabase/server";

export type OfferStatus =
  | "draft"
  | "submitted"
  | "change_requested"
  | "agent_approved"
  | "sent_to_seller"
  | "seller_intent_recorded"
  | "withdrawn"
  | "expired"
  | "superseded";

export type OfferConditionData = { type: string; status: string | null; details: string | null };
export type OfferHistoryData = { status: OfferStatus; createdAt: string };

export type BuyerOfferData = {
  id: string;
  status: OfferStatus;
  amountIsk: number;
  validUntil: string;
  requestedHandoverDate: string;
  submittedAt: string | null;
  buyerName: string;
  buyerPhone: string | null;
  buyerEmail: string | null;
  conditions: OfferConditionData[];
  history: OfferHistoryData[];
};

export type AgentOfferData = BuyerOfferData & {
  askingPriceIsk: number;
  property: string;
  location: string;
  receivedAt: string;
  agentApprovedAt: string | null;
  sentToSellerAt: string | null;
  review: {
    buyerIdentified: boolean;
    contactConfirmed: boolean;
    financingNeedsConfirmation: boolean;
    validityRecorded: boolean;
    handoverRecorded: boolean;
    internalNotes: string;
    changeRequest: string | null;
  } | null;
};

export type SellerOfferData = {
  id: string;
  status: OfferStatus;
  amountIsk: number;
  askingPriceIsk: number;
  validUntil: string;
  requestedHandoverDate: string;
  property: string;
  location: string;
  agent: string;
  conditions: OfferConditionData[];
  latestIntent: "accept" | "reject" | "counter_offer" | null;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Ógild tilboðsgögn frá gagnagrunni.");
  return value as JsonRecord;
}

function asConditions(value: unknown): OfferConditionData[] {
  return Array.isArray(value)
    ? value.map((item) => {
        const row = asRecord(item);
        return { type: String(row.type), status: row.status ? String(row.status) : null, details: row.details ? String(row.details) : null };
      })
    : [];
}

export function parseBuyerOffer(value: unknown): BuyerOfferData | null {
  if (!value) return null;
  const row = asRecord(value);
  return {
    id: String(row.id), status: String(row.status) as OfferStatus, amountIsk: Number(row.amount_isk),
    validUntil: String(row.valid_until), requestedHandoverDate: String(row.requested_handover_date),
    submittedAt: row.submitted_at ? String(row.submitted_at) : null,
    buyerName: String(row.buyer_name), buyerPhone: row.buyer_phone ? String(row.buyer_phone) : null,
    buyerEmail: row.buyer_email ? String(row.buyer_email) : null, conditions: asConditions(row.conditions),
    history: Array.isArray(row.history) ? row.history.map((item) => {
      const history = asRecord(item);
      return { status: String(history.status) as OfferStatus, createdAt: String(history.created_at) };
    }) : [],
  };
}

export async function getBuyerOffer(offerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buyer_offer_status", { p_offer_id: offerId });
  if (error) return { data: null, denied: error.code === "42501" || error.code === "28000", error: error.message };
  return { data: parseBuyerOffer(data), denied: false, error: null };
}

export async function getSellerOffer(offerId: string): Promise<{ data: SellerOfferData | null; denied: boolean; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("seller_offer_summary", { p_offer_id: offerId });
  if (error) return { data: null, denied: error.code === "42501" || error.code === "28000", error: error.message };
  if (!data) return { data: null, denied: true, error: null };
  const row = asRecord(data);
  return { data: {
    id: String(row.id), status: String(row.status) as OfferStatus, amountIsk: Number(row.amount_isk),
    askingPriceIsk: Number(row.asking_price_isk), validUntil: String(row.valid_until),
    requestedHandoverDate: String(row.requested_handover_date), property: String(row.property),
    location: String(row.location), agent: String(row.agent), conditions: asConditions(row.conditions),
    latestIntent: row.latest_intent ? String(row.latest_intent) as SellerOfferData["latestIntent"] : null,
  }, denied: false, error: null };
}

export async function getAgentOffer(offerId: string): Promise<AgentOfferData | null> {
  const supabase = await createClient();
  const { data: offer, error } = await supabase.from("offers").select("*").eq("id", offerId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!offer) return null;
  const [buyerResult, transactionResult, conditionsResult, reviewResult, historyResult] = await Promise.all([
    supabase.from("contacts").select("full_name,phone,email").eq("id", offer.buyer_contact_id).single(),
    supabase.from("transactions").select("asking_price_isk,property_id").eq("id", offer.transaction_id).single(),
    supabase.from("offer_conditions").select("condition_type,status,details").eq("offer_id", offer.id).order("created_at"),
    supabase.from("offer_reviews").select("*").eq("offer_id", offer.id).maybeSingle(),
    supabase.from("offer_status_history").select("to_status,created_at").eq("offer_id", offer.id).order("created_at"),
  ]);
  const firstError = [buyerResult.error, transactionResult.error, conditionsResult.error, reviewResult.error, historyResult.error].find(Boolean);
  if (firstError) throw new Error(firstError.message);
  if (!buyerResult.data || !transactionResult.data) throw new Error("Tilboðsgögn eru ófullnægjandi.");
  const { data: property, error: propertyError } = await supabase.from("properties").select("address_line,postal_code,municipality").eq("id", transactionResult.data.property_id).single();
  if (propertyError) throw new Error(propertyError.message);
  const review = reviewResult.data;
  return {
    id: offer.id, status: offer.status as OfferStatus, amountIsk: Number(offer.amount_isk), validUntil: offer.valid_until,
    requestedHandoverDate: offer.requested_handover_date, submittedAt: offer.submitted_at,
    buyerName: buyerResult.data.full_name, buyerPhone: buyerResult.data.phone, buyerEmail: buyerResult.data.email,
    askingPriceIsk: Number(transactionResult.data.asking_price_isk), property: property.address_line,
    location: `${property.postal_code} ${property.municipality}`, receivedAt: offer.submitted_at ?? offer.created_at,
    agentApprovedAt: offer.agent_approved_at, sentToSellerAt: offer.sent_to_seller_at,
    conditions: (conditionsResult.data ?? []).map((condition) => ({ type: condition.condition_type, status: condition.status, details: condition.details })),
    history: (historyResult.data ?? []).map((history) => ({ status: history.to_status as OfferStatus, createdAt: history.created_at })),
    review: review ? {
      buyerIdentified: review.buyer_identified, contactConfirmed: review.contact_confirmed,
      financingNeedsConfirmation: review.financing_needs_confirmation, validityRecorded: review.validity_recorded,
      handoverRecorded: review.handover_recorded, internalNotes: review.internal_notes, changeRequest: review.change_request,
    } : null,
  };
}

export function formatIsk(value: number) { return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} kr.`; }
export function offerConditionLabel(type: string) {
  return ({ financing: "Háð fjármögnun", "property-sale": "Háð sölu annarrar eignar", inspection: "Háð skoðun / nánari yfirferð", none: "Engin sérstök skilyrði" } as Record<string, string>)[type] ?? type;
}
export function financingStatusLabel(status: string | null) {
  return ({ approved: "Samþykkt", in_progress: "Í vinnslu", "in-progress": "Í vinnslu", not_started: "Ekki hafin", "not-started": "Ekki hafin" } as Record<string, string>)[status ?? ""] ?? "—";
}

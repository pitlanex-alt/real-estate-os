"use server";

import { revalidatePath } from "next/cache";
import { propertyRouteSlug } from "@/lib/portal/customer";
import { createClient } from "@/lib/supabase/server";

type PartyInput = {
  name: string;
  phone: string;
  email: string;
};

export type CreatePropertyInput = {
  seller: PartyInput;
  coOwner: PartyInput | null;
  property: {
    address: string;
    postcode: string;
    municipality: string;
    propertyNumber: string;
    size: string;
    rooms: string;
    year: string;
  };
  salePrice: string;
};

export type CreatePropertyResult =
  | { ok: true; transactionId: string; propertySlug: string }
  | { ok: false; error: string };

function parseDecimal(value: string) {
  const match = value.replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseIsk(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? amount : null;
}

function clean(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

export async function createPropertyTransaction(
  input: CreatePropertyInput,
): Promise<CreatePropertyResult> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims?.sub) {
    return { ok: false, error: "Innskráning rann út. Skráðu þig inn aftur." };
  }

  if (!clean(input.seller.name) || !clean(input.property.address) || !clean(input.property.postcode) || !clean(input.property.municipality)) {
    return { ok: false, error: "Seljandi, heimilisfang, póstnúmer og sveitarfélag eru nauðsynleg." };
  }

  const year = parseDecimal(input.property.year);
  const { data, error } = await supabase.rpc("create_property_transaction", {
    p_organization_id: null,
    p_seller_name: input.seller.name,
    p_seller_phone: clean(input.seller.phone),
    p_seller_email: clean(input.seller.email),
    p_address_line: input.property.address,
    p_postal_code: input.property.postcode,
    p_municipality: input.property.municipality,
    p_registry_number: clean(input.property.propertyNumber),
    p_size_sqm: parseDecimal(input.property.size),
    p_room_count: parseDecimal(input.property.rooms),
    p_bedroom_count: null,
    p_year_built: year === null ? null : Math.trunc(year),
    p_asking_price_isk: parseIsk(input.salePrice),
    p_co_owner_name: input.coOwner?.name ?? null,
    p_co_owner_phone: input.coOwner ? clean(input.coOwner.phone) : null,
    p_co_owner_email: input.coOwner ? clean(input.coOwner.email) : null,
  });

  if (error) {
    console.error("Unable to create property transaction", error);
    return {
      ok: false,
      error: error.code === "23505"
        ? "Eign með þessu fastanúmeri er þegar skráð."
        : "Ekki tókst að stofna eignina. Engar hlutafærslur voru vistaðar.",
    };
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.transaction_id) {
    return { ok: false, error: "Stofnun lauk án auðkennis fyrir viðskiptin." };
  }

  revalidatePath("/properties");
  return {
    ok: true,
    transactionId: result.transaction_id,
    propertySlug: propertyRouteSlug(input.property.address),
  };
}

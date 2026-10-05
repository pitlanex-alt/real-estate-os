"use server";

import { revalidatePath } from "next/cache";
import type { AttendanceStatus, InterestLevel, ViewingGuest } from "@/app/data/viewing";
import { mapGuestRow } from "@/lib/viewings/detail";
import { createClient } from "@/lib/supabase/server";

const attendanceToDatabase: Record<AttendanceStatus, "registered" | "attended" | "no_show"> = {
  registered: "registered",
  attended: "attended",
  absent: "no_show",
};

const interestToDatabase: Record<InterestLevel, "very_interested" | "interested" | "unsure" | "not_interested" | "unset"> = {
  very: "very_interested",
  interested: "interested",
  unsure: "unsure",
  "not-interested": "not_interested",
  unset: "unset",
};

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return { supabase, authenticated: !error && Boolean(data?.claims?.sub) };
}

export async function updateViewingGuestAction(
  guest: ViewingGuest,
  routePath: string,
): Promise<ActionResult> {
  const { supabase, authenticated } = await authenticatedClient();
  if (!authenticated) return { ok: false, error: "Innskráning rann út." };

  const { error } = await supabase.rpc("update_viewing_guest", {
    p_viewing_guest_id: guest.id,
    p_attendance: attendanceToDatabase[guest.attendance],
    p_interest: interestToDatabase[guest.interest],
    p_internal_notes: guest.note,
    p_next_action: guest.nextAction,
    p_follow_up_due_at: null,
  });

  if (error) {
    console.error("Unable to update viewing guest", error);
    return { ok: false, error: "Ekki tókst að vista upplýsingar um gest." };
  }

  revalidatePath(routePath);
  return { ok: true, data: undefined };
}

export async function addWalkInGuestAction(input: {
  viewingId: string;
  name: string;
  phone: string;
  email: string;
}, routePath: string): Promise<ActionResult<ViewingGuest>> {
  const { supabase, authenticated } = await authenticatedClient();
  if (!authenticated) return { ok: false, error: "Innskráning rann út." };
  if (!input.name.trim() || !input.phone.trim()) {
    return { ok: false, error: "Nafn og sími eru nauðsynleg." };
  }

  const { data: registration, error: registrationError } = await supabase.rpc("register_viewing_guest", {
    p_viewing_id: input.viewingId,
    p_contact_id: null,
    p_full_name: input.name.trim(),
    p_phone: input.phone.trim(),
    p_email: input.email.trim() || null,
    p_attendance: "attended",
    p_interest: "unset",
    p_internal_notes: "",
    p_next_action: "today",
    p_follow_up_due_at: null,
    p_is_walk_in: true,
  });

  if (registrationError) {
    console.error("Unable to register walk-in guest", registrationError);
    return { ok: false, error: "Ekki tókst að skrá gestinn." };
  }

  const registrationRow = Array.isArray(registration) ? registration[0] : registration;
  if (!registrationRow?.viewing_guest_id) {
    return { ok: false, error: "Skráning lauk án auðkennis fyrir gest." };
  }

  const { data, error } = await supabase
    .from("viewing_guests")
    .select(`
      id,
      attendance,
      interest,
      internal_notes,
      next_action,
      is_walk_in,
      contact:contacts!viewing_guests_contact_id_fkey(full_name, phone, email)
    `)
    .eq("id", registrationRow.viewing_guest_id)
    .single();

  if (error || !data) {
    console.error("Unable to reload walk-in guest", error);
    return { ok: false, error: "Gestur var skráður en ekki tókst að endurlesa færsluna." };
  }

  const guest = mapGuestRow(data as never);
  if (!guest) return { ok: false, error: "Tengiliðaupplýsingar gests fundust ekki." };

  revalidatePath(routePath);
  return { ok: true, data: guest };
}

export async function completeViewingAction(
  viewingId: string,
  routePath: string,
): Promise<ActionResult<{ completedAt: string | null }>> {
  const { supabase, authenticated } = await authenticatedClient();
  if (!authenticated) return { ok: false, error: "Innskráning rann út." };

  const { data, error } = await supabase.rpc("complete_viewing", {
    p_viewing_id: viewingId,
    p_seller_safe_summary: null,
  });

  if (error) {
    console.error("Unable to complete viewing", error);
    return { ok: false, error: "Ekki tókst að ljúka skoðuninni." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath(routePath);
  return { ok: true, data: { completedAt: row?.completed_at ?? null } };
}

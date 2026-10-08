import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { requireInternalIdentity } from "@/lib/auth/post-auth";
import { getPropertyWorkspace } from "@/lib/properties/workspace";
import { createClient } from "@/lib/supabase/server";
import { PropertyWorkspace } from "./components/PropertyWorkspace";

export const metadata: Metadata = { title: "Vinnusvæði eignar — Kelvo" };

export default async function PropertyWorkspacePage({ params }: PageProps<"/properties/[propertySlug]">) {
  const { propertySlug } = await params;
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);
  const result = await getPropertyWorkspace(supabase, propertySlug, identity.organizationId);
  if (!result.data && !result.error) notFound();
  let canEditListing = identity.role === "admin" || identity.role === "coordinator";
  if (result.data && identity.role === "agent") {
    const { data: assignment } = await supabase
      .from("transaction_assignments")
      .select("transaction_id")
      .eq("transaction_id", result.data.transactionId)
      .eq("user_id", identity.userId)
      .limit(1)
      .maybeSingle();
    canEditListing = Boolean(assignment);
  }

  return <AppShell activeItem="Fasteignir" identity={identity}><div className="mx-auto w-full max-w-[1336px] px-4 pb-16 pt-8 sm:px-6 lg:px-10 xl:px-12">{result.data ? <PropertyWorkspace property={result.data} canEdit={identity.role !== "viewer"} canEditListing={canEditListing} /> : <section role="alert" className="rounded-[14px] border border-[#b75e56]/20 bg-[#f7e7e5] px-4 py-5 text-[12px] text-[#914b45]">{result.error}</section>}</div></AppShell>;
}

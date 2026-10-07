import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { requireInternalIdentity } from "@/lib/auth/post-auth";
import { getPropertyWorkspace } from "@/lib/properties/workspace";
import { createClient } from "@/lib/supabase/server";
import { PropertyWorkspace } from "./components/PropertyWorkspace";

export const metadata: Metadata = { title: "Vinnusvæði eignar — Mó" };

export default async function PropertyWorkspacePage({ params }: PageProps<"/properties/[propertySlug]">) {
  const { propertySlug } = await params;
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);
  const result = await getPropertyWorkspace(supabase, propertySlug, identity.organizationId);
  if (!result.data && !result.error) notFound();

  return <AppShell activeItem="Fasteignir" identity={identity}><div className="mx-auto w-full max-w-[1336px] px-4 pb-16 pt-8 sm:px-6 lg:px-10 xl:px-12">{result.data ? <PropertyWorkspace property={result.data} canEdit={identity.role !== "viewer"} /> : <section role="alert" className="border-y border-[#c8665b]/25 py-6 text-[12px] text-[#c99088]">{result.error}</section>}</div></AppShell>;
}

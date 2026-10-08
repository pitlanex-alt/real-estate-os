import { notFound } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { ViewingManager } from "./components/ViewingManager";
import { requireInternalIdentity } from "@/lib/auth/post-auth";
import { getPropertyWorkspace } from "@/lib/properties/workspace";
import { createClient } from "@/lib/supabase/server";
import { getViewingDetail } from "@/lib/viewings/detail";

export default async function ViewingPage({ params }: { params: Promise<{ propertySlug: string; viewingId: string }> }) {
  const { propertySlug, viewingId } = await params;
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);
  const [{ viewing, guests, error }, workspace] = await Promise.all([
    getViewingDetail(viewingId),
    getPropertyWorkspace(supabase, propertySlug, identity.organizationId),
  ]);
  if (!viewing && !error) notFound();
  if (viewing && (!workspace.data || !workspace.data.viewings.some((item) => item.id === viewingId))) notFound();

  return <AppShell activeItem="Skoðanir" identity={identity}><div className="mx-auto w-full max-w-[1336px] px-4 pb-16 pt-7 sm:px-6 lg:px-10 xl:px-12">{viewing ? <ViewingManager initialViewing={viewing} initialGuests={guests} propertySlug={propertySlug} /> : <div role="alert" className="rounded-[14px] border border-[#b75e56]/20 bg-[#f7e7e5] px-4 py-5 text-[12px] text-[#914b45]">{error}</div>}</div></AppShell>;
}

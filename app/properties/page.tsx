import type { Metadata } from "next";
import { AppShell } from "@/app/components/AppShell";
import { PropertiesIndex } from "./components/PropertiesIndex";
import { getIndexedProperties } from "@/lib/properties/list";
import { createClient } from "@/lib/supabase/server";
import { requireInternalIdentity } from "@/lib/auth/post-auth";

export const metadata: Metadata = {
  title: "Fasteignir — Mó",
  description: "Yfirlit yfir allar eignir og stöðu þeirra",
};

export default async function PropertiesPage({ searchParams }: PageProps<"/properties">) {
  const params = await searchParams;
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);

  const { properties, error } = await getIndexedProperties(identity.organizationId);

  return (
    <AppShell activeItem="Fasteignir" identity={identity}>
      <div className="mx-auto w-full max-w-[1336px] px-4 pb-16 pt-9 sm:px-6 lg:px-10 xl:px-12">
        <PropertiesIndex properties={properties} showSuccess={params.created === "1"} loadError={error} />
      </div>
    </AppShell>
  );
}

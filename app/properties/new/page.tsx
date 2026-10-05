import type { Metadata } from "next";
import { AppShell } from "@/app/components/AppShell";
import { NewPropertyFlow } from "./components/NewPropertyFlow";
import { createClient } from "@/lib/supabase/server";
import { requireInternalIdentity } from "@/lib/auth/post-auth";

export const metadata: Metadata = {
  title: "Ný eign — Mó",
  description: "Stofna nýja eign og hefja undirbúning sölu",
};

export default async function NewPropertyPage() {
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);

  return (
    <AppShell activeItem="Fasteignir" identity={identity}>
      <div className="mx-auto w-full max-w-[1336px] px-4 pb-16 pt-7 sm:px-6 lg:px-10 xl:px-12">
        <NewPropertyFlow agentName={identity.displayName} />
      </div>
    </AppShell>
  );
}

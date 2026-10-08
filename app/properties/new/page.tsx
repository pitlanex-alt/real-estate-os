import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { NewPropertyFlow } from "./components/NewPropertyFlow";
import { createClient } from "@/lib/supabase/server";
import { requireInternalIdentity } from "@/lib/auth/post-auth";

export const metadata: Metadata = {
  title: "Ný eign — Kelvo",
  description: "Stofna nýja eign og hefja undirbúning sölu",
};

export default async function NewPropertyPage() {
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);
  if (identity.role === "viewer") redirect("/properties");
  const [contactsResult, membersResult] = await Promise.all([
    supabase.from("contacts").select("id,full_name,email,phone").eq("organization_id", identity.organizationId).order("full_name"),
    supabase.from("organization_memberships").select("user_id,role,profile:profiles!organization_memberships_user_id_fkey(display_name)").eq("organization_id", identity.organizationId).eq("is_active", true).in("role", ["admin","agent"]).order("created_at"),
  ]);
  const agents=(membersResult.data??[]).flatMap((row)=>{const profile=Array.isArray(row.profile)?row.profile[0]:row.profile;return profile?[{id:row.user_id,label:profile.display_name}]:[]});
  const defaultAgentId=agents.some((agent)=>agent.id===identity.userId)?identity.userId:agents[0]?.id??"";

  return (
    <AppShell activeItem="Fasteignir" identity={identity}>
      <div className="mx-auto w-full max-w-[1336px] px-4 pb-16 pt-7 sm:px-6 lg:px-10 xl:px-12">
        <NewPropertyFlow agentName={agents.find((agent)=>agent.id===defaultAgentId)?.label??identity.displayName} contacts={(contactsResult.data??[]).map((contact)=>({id:contact.id,label:contact.full_name,email:contact.email,phone:contact.phone}))} agents={agents} currentAgentId={defaultAgentId} />
      </div>
    </AppShell>
  );
}

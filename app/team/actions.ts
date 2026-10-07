"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInternalIdentity } from "@/lib/auth/post-auth";
import { createClient } from "@/lib/supabase/server";

export type TeamState = { error: string | null; success: string | null };
type Role = "admin"|"agent"|"coordinator"|"viewer";
const roles = new Set<Role>(["admin","agent","coordinator","viewer"]);

async function requireAdmin() { const supabase=await createClient(); const identity=await requireInternalIdentity(supabase); if(identity.role!=="admin") throw new Error("Aðeins stjórnandi getur breytt teyminu."); return {supabase,identity}; }

export async function inviteTeamMember(_state:TeamState,formData:FormData):Promise<TeamState>{
  try { const {supabase,identity}=await requireAdmin(); const email=String(formData.get("email")??"").trim().toLowerCase(); const displayName=String(formData.get("displayName")??"").trim(); const role=String(formData.get("role")??"") as Role; if(!email||!displayName||!roles.has(role)) return{error:"Nafn, netfang og hlutverk eru nauðsynleg.",success:null};
    const admin=createAdminClient(); let userId:string|null=null; const listed=await admin.auth.admin.listUsers({page:1,perPage:1000}); userId=listed.data.users.find((user)=>user.email?.toLowerCase()===email)?.id??null;
    if(!userId){const invited=await admin.auth.admin.inviteUserByEmail(email,{data:{display_name:displayName,account_type:"internal"}}); if(invited.error||!invited.data.user)return{error:"Ekki tókst að senda boð. Athugaðu Auth tölvupóstsstillingar.",success:null}; userId=invited.data.user.id;}
    await admin.from("profiles").upsert({id:userId,display_name:displayName,email,account_type:"internal"},{onConflict:"id"});
    const membership=await supabase.rpc("set_team_membership",{p_organization_id:identity.organizationId,p_user_id:userId,p_role:role,p_is_active:true}); if(membership.error)return{error:"Notandi fannst en ekki tókst að tengja hann teyminu.",success:null}; revalidatePath("/team"); return{error:null,success:"Teymisaðila hefur verið boðið."};
  } catch(caught){return{error:caught instanceof Error?caught.message:"Aðgerð mistókst.",success:null};}
}

export async function updateTeamMembership(userId:string,role:Role,isActive:boolean){ const {supabase,identity}=await requireAdmin(); const result=await supabase.rpc("set_team_membership",{p_organization_id:identity.organizationId,p_user_id:userId,p_role:role,p_is_active:isActive}); if(result.error)throw new Error(result.error.code==="23514"?"Fyrirtækið verður að hafa að minnsta kosti einn virkan stjórnanda.":"Ekki tókst að breyta aðild."); revalidatePath("/team"); }

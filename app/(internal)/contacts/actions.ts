"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireInternalIdentity } from "@/lib/auth/post-auth";

export type ContactState={error:string|null};
function value(data:FormData,key:string){const item=data.get(key);return typeof item==="string"?item.trim():"";}
export async function createContact(_state:ContactState,formData:FormData):Promise<ContactState>{const supabase=await createClient();const identity=await requireInternalIdentity(supabase);if(identity.role==="viewer")return{error:"Lesaðgangur getur ekki stofnað tengiliði."};const{data,error}=await supabase.rpc("create_contact",{p_organization_id:identity.organizationId,p_full_name:value(formData,"name"),p_email:value(formData,"email")||null,p_phone:value(formData,"phone")||null});if(error||!data)return{error:"Ekki tókst að stofna tengilið."};revalidatePath("/contacts");redirect(`/contacts/${data.id}`);}
export async function updateContact(contactId:string,_state:ContactState,formData:FormData):Promise<ContactState>{const supabase=await createClient();await requireInternalIdentity(supabase);const{error}=await supabase.rpc("update_contact",{p_contact_id:contactId,p_full_name:value(formData,"name"),p_email:value(formData,"email")||null,p_phone:value(formData,"phone")||null});if(error)return{error:"Ekki tókst að vista tengilið."};revalidatePath(`/contacts/${contactId}`);revalidatePath("/contacts");return{error:null};}

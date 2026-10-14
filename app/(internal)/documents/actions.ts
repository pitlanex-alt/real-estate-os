"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deriveDocumentTitle, detectDocumentMimeType } from "@/lib/documents/presentation";

function refresh(){revalidatePath("/documents");revalidatePath("/properties","layout");revalidatePath("/seller","layout");revalidatePath("/buyer","layout");}

function documentMutationError(code?: string) {
  return code === "23514"
    ? "Ekki er hægt að breyta skjölum í lokuðum viðskiptum."
    : code === "42501"
      ? "Þú hefur ekki heimild til að breyta skjalinu."
      : "Ekki tókst að vista breytinguna á skjalinu.";
}

export async function uploadDocumentAction(formData:FormData){const file=formData.get("file");if(!(file instanceof File)||file.size===0)throw new Error("Veldu skrá.");const mimeType=detectDocumentMimeType(file.name,file.type);const submittedTitle=String(formData.get("title")??"").trim();const documentType=String(formData.get("documentType")??"").trim();if(!documentType)throw new Error("Veldu flokk fyrir skjalið.");const supabase=await createClient();const {data,error}=await supabase.rpc("create_document_record",{p_transaction_id:String(formData.get("transactionId")),p_title:submittedTitle||deriveDocumentTitle(file.name),p_document_type:documentType,p_visibility:String(formData.get("visibility")),p_file_name:file.name,p_mime_type:mimeType,p_file_size_bytes:file.size,p_description:null});if(error)throw new Error(documentMutationError(error.code));const document=Array.isArray(data)?data[0]:data;const {error:uploadError}=await supabase.storage.from("transaction-documents").upload(document.storage_path,file,{contentType:mimeType,upsert:false});if(uploadError){await supabase.rpc("delete_document_record",{p_document_id:document.id});throw new Error("Ekki tókst að hlaða skjalinu upp.");}refresh();}
export async function updateDocumentVisibilityAction(id:string,visibility:string){const supabase=await createClient();const{error}=await supabase.rpc("update_document_visibility",{p_document_id:id,p_visibility:visibility});if(error)throw new Error(documentMutationError(error.code));refresh();}
export async function deleteDocumentAction(id:string){const supabase=await createClient();const{data,error}=await supabase.rpc("authorize_document_download",{p_document_id:id});if(error)throw new Error(documentMutationError(error.code));const row=data as{storage_path:string};const{error:removeError}=await supabase.storage.from("transaction-documents").remove([row.storage_path]);if(removeError&&!/not found/i.test(removeError.message))throw new Error("Ekki tókst að eyða skjalinu.");const{error:deleteError}=await supabase.rpc("delete_document_record",{p_document_id:id});if(deleteError)throw new Error(documentMutationError(deleteError.code));refresh();}

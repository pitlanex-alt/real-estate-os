"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function refresh() { revalidatePath("/tasks"); revalidatePath("/properties", "layout"); }
export async function createTaskAction(formData: FormData) { const supabase=await createClient(); const {error}=await supabase.rpc("create_task",{p_transaction_id:String(formData.get("transactionId")),p_title:String(formData.get("title")),p_description:null,p_assigned_to:formData.get("assignedTo")||null,p_due_at:formData.get("dueAt")?`${formData.get("dueAt")}:00Z`:null,p_visibility:String(formData.get("visibility"))}); if(error) throw new Error(error.message); refresh(); }
export async function updateTaskAction(id:string,status:string,dueAt:string,assignedTo:string,visibility:string) { const supabase=await createClient(); const {data:task,error:readError}=await supabase.from("tasks").select("title,description").eq("id",id).single(); if(readError) throw new Error(readError.message); const {error}=await supabase.rpc("update_task",{p_task_id:id,p_title:task.title,p_description:task.description??"",p_assigned_to:assignedTo||null,p_due_at:dueAt?`${dueAt}:00Z`:null,p_status:status,p_visibility:visibility}); if(error) throw new Error(error.message); refresh(); }
export async function completeTaskAction(id:string) { const supabase=await createClient(); const {error}=await supabase.rpc("complete_task",{p_task_id:id}); if(error) throw new Error(error.message); refresh(); }
export async function cancelTaskAction(id:string) { const supabase=await createClient(); const {error}=await supabase.rpc("cancel_task",{p_task_id:id}); if(error) throw new Error(error.message); refresh(); }

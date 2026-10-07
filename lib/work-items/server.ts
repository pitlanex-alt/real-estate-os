import { createClient } from "@/lib/supabase/server";
import type {
  CustomerDocument,
  CustomerTask,
  InternalDocument,
  InternalTask,
  WorkOption,
} from "./model";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type TransactionRow = {
  id: string;
  property: { address_line: string; slug: string } | { address_line: string; slug: string }[] | null;
};

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function emptyInternalResult(error: string | null) {
  return {
    tasks: [] as InternalTask[],
    documents: [] as InternalDocument[],
    transactions: [] as WorkOption[],
    assignees: [] as WorkOption[],
    error,
  };
}

export async function getInternalWorkItems(
  supabase: ServerSupabaseClient,
  transactionId?: string,
) {
  try {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return emptyInternalResult("Innskráning fannst ekki.");
  }

  const membershipsResult = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (membershipsResult.error) {
    console.error("Unable to resolve work-item memberships", membershipsResult.error);
    return emptyInternalResult("Ekki tókst að staðfesta aðgang að fyrirtæki.");
  }

  const organizationIds = (membershipsResult.data ?? []).map(
    (membership) => membership.organization_id,
  );
  if (organizationIds.length === 0) {
    return emptyInternalResult("Engin virk fyrirtækjaaðild fannst.");
  }

  let tasksQuery = supabase
    .from("tasks")
    .select("*")
    .in("organization_id", organizationIds)
    .order("due_at", { ascending: true, nullsFirst: false });
  let documentsQuery = supabase
    .from("documents")
    .select("*")
    .in("organization_id", organizationIds)
    .order("created_at", { ascending: false });
  let transactionsQuery = supabase
    .from("transactions")
    .select(
      "id,property:properties!transactions_property_id_fkey(address_line,slug)",
    )
    .in("organization_id", organizationIds)
    .order("created_at", { ascending: false });

  if (transactionId) {
    tasksQuery = tasksQuery.eq("transaction_id", transactionId);
    documentsQuery = documentsQuery.eq("transaction_id", transactionId);
    transactionsQuery = transactionsQuery.eq("id", transactionId);
  }

  const [tasksResult, documentsResult, transactionsResult, profilesResult] =
    await Promise.all([
      tasksQuery,
      documentsQuery,
      transactionsQuery,
      supabase.from("profiles").select("id,display_name").order("display_name"),
    ]);

  const queryError =
    tasksResult.error ??
    documentsResult.error ??
    transactionsResult.error ??
    profilesResult.error;

  if (queryError) {
    console.error("Unable to load internal tasks/documents", queryError);
    return emptyInternalResult("Ekki tókst að sækja verkefni og skjöl.");
  }

  const transactionRows = (transactionsResult.data ?? []) as unknown as TransactionRow[];
  const propertyByTransaction = new Map(
    transactionRows.map((transaction) => [
      transaction.id,
      relation(transaction.property)?.address_line ?? "Óþekkt eign",
    ]),
  );
  const slugByTransaction = new Map(
    transactionRows.map((transaction) => [transaction.id, relation(transaction.property)?.slug ?? "eign"]),
  );
  const profileById = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]),
  );

  const tasks: InternalTask[] = (tasksResult.data ?? []).map((row) => ({
    id: row.id,
    transactionId: row.transaction_id,
    title: row.title,
    description: row.description,
    status: row.status,
    dueAt: row.due_at,
    visibility: row.visibility,
    completedAt: row.completed_at,
    property: propertyByTransaction.get(row.transaction_id) ?? "Óþekkt eign",
    propertySlug: slugByTransaction.get(row.transaction_id) ?? "eign",
    assigneeId: row.assigned_to,
    assignee: row.assigned_to ? profileById.get(row.assigned_to) ?? null : null,
  }));

  const documents: InternalDocument[] = (documentsResult.data ?? []).map(
    (row) => ({
      id: row.id,
      transactionId: row.transaction_id,
      title: row.title,
      documentType: row.document_type,
      visibility: row.visibility,
      fileName: row.file_name,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      createdAt: row.created_at,
      property: propertyByTransaction.get(row.transaction_id) ?? "Óþekkt eign",
      propertySlug: slugByTransaction.get(row.transaction_id) ?? "eign",
      uploadedBy: profileById.get(row.uploaded_by) ?? "Óþekktur",
    }),
  );

  const transactions: WorkOption[] = transactionRows.map((transaction) => ({
    id: transaction.id,
    label: propertyByTransaction.get(transaction.id) ?? "Óþekkt eign",
  }));
  const assignees: WorkOption[] = (profilesResult.data ?? []).map((profile) => ({
    id: profile.id,
    label: profile.display_name,
  }));

  return { tasks, documents, transactions, assignees, error: null };
  } catch (error) {
    console.error("Unable to load internal tasks/documents", error);
    return emptyInternalResult("Ekki tókst að sækja verkefni og skjöl.");
  }
}

function parseCustomerTasks(value: unknown): CustomerTask[] {
  return Array.isArray(value)
    ? value.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          id: String(item.id),
          title: String(item.title),
          description: item.description ? String(item.description) : null,
          status: String(item.status) as CustomerTask["status"],
          dueAt: item.due_at ? String(item.due_at) : null,
          completedAt: item.completed_at ? String(item.completed_at) : null,
        };
      })
    : [];
}

function parseCustomerDocuments(value: unknown): CustomerDocument[] {
  return Array.isArray(value)
    ? value.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          id: String(item.id),
          title: String(item.title),
          documentType: String(item.document_type),
          fileName: item.file_name ? String(item.file_name) : null,
          mimeType: item.mime_type ? String(item.mime_type) : null,
          fileSizeBytes:
            item.file_size_bytes == null ? null : Number(item.file_size_bytes),
          createdAt: String(item.created_at),
        };
      })
    : [];
}

export async function getCustomerWorkItems(transactionId: string) {
  const supabase = await createClient();
  const [tasks, documents] = await Promise.all([
    supabase.rpc("customer_visible_tasks", { p_transaction_id: transactionId }),
    supabase.rpc("customer_visible_documents", {
      p_transaction_id: transactionId,
    }),
  ]);

  return {
    tasks: tasks.error ? [] : parseCustomerTasks(tasks.data),
    documents: documents.error ? [] : parseCustomerDocuments(documents.data),
    error: tasks.error?.message ?? documents.error?.message ?? null,
  };
}

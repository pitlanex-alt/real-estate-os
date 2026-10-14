export type TaskStatus = "not_started" | "in_progress" | "completed" | "cancelled";

const taskStatusLabels: Record<TaskStatus, string> = {
  not_started: "Ekki hafið",
  in_progress: "Í vinnslu",
  completed: "Lokið",
  cancelled: "Hætt við",
};

export function taskStatusLabel(status: TaskStatus) {
  return taskStatusLabels[status];
}
export type ActivityVisibility = "internal" | "seller" | "buyer" | "seller_and_buyer";
export type DocumentVisibility = "internal" | "seller" | "buyer" | "shared";

export type InternalTask = { id: string; transactionId: string; transactionStage: string; workflowKey: string | null; title: string; description: string | null; status: TaskStatus; dueAt: string | null; visibility: ActivityVisibility; completedAt: string | null; property: string; propertySlug: string; assigneeId: string | null; assignee: string | null };
export type InternalDocument = { id: string; transactionId: string; transactionStage: string; title: string; documentType: string; visibility: DocumentVisibility; fileName: string | null; mimeType: string | null; fileSizeBytes: number | null; createdAt: string; property: string; propertySlug: string; uploadedBy: string };
export type WorkOption = { id: string; label: string; description?: string | null };
export type CustomerTask = Pick<InternalTask, "id" | "title" | "description" | "status" | "dueAt" | "completedAt">;
export type CustomerDocument = Pick<InternalDocument, "id" | "title" | "documentType" | "fileName" | "mimeType" | "fileSizeBytes" | "createdAt">;

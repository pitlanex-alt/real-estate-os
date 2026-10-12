type ActivityMetadata = Record<string, unknown> | null | undefined;

function metadataTitle(metadata: ActivityMetadata) {
  const title = metadata?.title;
  return typeof title === "string" && title.trim() ? title.trim() : null;
}

export function localizedActivitySummary(
  summary: string,
  eventType?: string | null,
  metadata?: ActivityMetadata,
) {
  const title = metadataTitle(metadata);

  if (eventType === "task_completed" || summary === "Task completed") {
    return title ? `Verkefninu „${title}“ lokið` : "Verkefni klárað";
  }
  if (eventType === "task_created" || summary === "Task created") {
    return title ? `Verkefnið „${title}“ stofnað` : "Verkefni stofnað";
  }
  if (eventType === "task_cancelled" || summary === "Task cancelled") {
    return title ? `Hætt við verkefnið „${title}“` : "Hætt við verkefni";
  }
  if (summary === "Transaction moved to contract preparation") {
    return "Undirbúningur kaupsamnings hafinn";
  }
  if (summary === "Contract preparation checklist initialized") {
    return "Undirbúningur kaupsamnings hafinn";
  }
  if (summary === "Document record created") return "Skjal skráð";
  if (summary === "Document visibility changed") return "Aðgangi að skjali breytt";
  if (summary === "Document metadata deleted") return "Skjal fjarlægt";

  return summary;
}

export function activityFeedback(metadata: ActivityMetadata) {
  const feedback = metadata?.feedback;
  return typeof feedback === "string" && feedback.trim() ? feedback.trim() : null;
}

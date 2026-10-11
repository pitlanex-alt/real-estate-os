export function profilePhotoUrl(
  userId: string,
  options: { transactionId?: string; editor?: boolean; version?: string | null } = {},
) {
  const params = new URLSearchParams();
  if (options.transactionId) params.set("transactionId", options.transactionId);
  if (options.editor) params.set("rendition", "editor");
  if (options.version) params.set("v", options.version);
  const query = params.toString();
  return `/api/profile-images/${encodeURIComponent(userId)}${query ? `?${query}` : ""}`;
}

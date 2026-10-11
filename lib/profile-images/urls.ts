export function profilePhotoUrl(userId: string, options: { transactionId?: string; editor?: boolean } = {}) {
  const params = new URLSearchParams();
  if (options.transactionId) params.set("transactionId", options.transactionId);
  if (options.editor) params.set("rendition", "editor");
  const query = params.toString();
  return `/api/profile-images/${encodeURIComponent(userId)}${query ? `?${query}` : ""}`;
}

export const PROPERTY_IMAGE_RENDITION_VERSION = "1";

export type PropertyImageRendition = "card" | "manager" | "gallery" | "hero";

export function propertyImageUrl(imageId: string, rendition: PropertyImageRendition) {
  const params = new URLSearchParams({ rendition, v: PROPERTY_IMAGE_RENDITION_VERSION });
  return `/api/property-images/${encodeURIComponent(imageId)}?${params.toString()}`;
}

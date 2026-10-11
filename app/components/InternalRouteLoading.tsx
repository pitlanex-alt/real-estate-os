import { InternalLoadingState } from "@/app/components/InternalLoadingState";

export function InternalRouteLoading({ rows = 4, title, description }: { rows?: number; title?: string; description?: string }) {
  return <InternalLoadingState rows={rows} title={title} description={description} />;
}

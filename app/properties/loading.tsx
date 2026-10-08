import { AppShell } from "@/app/components/AppShell";
import { InternalLoadingState } from "@/app/components/InternalLoadingState";

export default function PropertiesLoading() {
  return (
    <AppShell activeItem="Fasteignir">
      <InternalLoadingState />
    </AppShell>
  );
}

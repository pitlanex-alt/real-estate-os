import { AppShell } from "@/app/components/AppShell";
import { InternalLoadingState } from "@/app/components/InternalLoadingState";

export default function ContactDetailLoading() {
  return <AppShell activeItem="Viðskiptavinir"><InternalLoadingState rows={4} /></AppShell>;
}

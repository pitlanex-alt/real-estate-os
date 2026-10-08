import type { ReactNode } from "react";
import { Sidebar } from "@/app/components/Sidebar";
import { Topbar } from "@/app/components/Topbar";
import {
  requireInternalIdentity,
  type InternalIdentity,
} from "@/lib/auth/post-auth";
import { createClient } from "@/lib/supabase/server";
import { getPropertySearchOptions } from "@/lib/properties/search";

export async function AppShell({
  children,
  activeItem = "Yfirlit",
  identity: providedIdentity,
}: {
  children: ReactNode;
  activeItem?: string;
  identity?: InternalIdentity;
}) {
  const supabase = await createClient();
  const identity = providedIdentity ?? await requireInternalIdentity(supabase);
  const searchOptions = await getPropertySearchOptions(supabase, identity.organizationId);

  return (
    <div className="kelvo-app min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <Sidebar activeItem={activeItem} />
      <Topbar identity={identity} searchOptions={searchOptions} />
      <main className="min-w-0 pt-[72px] md:pl-[248px]">{children}</main>
    </div>
  );
}

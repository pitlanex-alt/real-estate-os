import { AppShell } from "@/app/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getInternalWorkItems } from "@/lib/work-items/server";
import { DocumentManager } from "./components/DocumentManager";
import { requireInternalIdentity } from "@/lib/auth/post-auth";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);

  const data = await getInternalWorkItems(supabase);

  return (
    <AppShell activeItem="Skjöl" identity={identity}>
      <div className="mx-auto w-full max-w-[1336px] px-4 pb-16 pt-8 sm:px-6 lg:px-10 xl:px-12">
        <header>
          <h1 className="text-[28px] font-bold tracking-[-0.04em] text-[var(--text-primary)]">
            Skjöl
          </h1>
          <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
            Einkaskjöl tengd eignaviðskiptum.
          </p>
        </header>
        <div className="pt-6">
          {data.error ? (
            <p className="rounded-[14px] border border-[#b75e56]/20 bg-[#f7e7e5] px-4 py-3 text-[#914b45]">Ekki tókst að sækja skjöl.</p>
          ) : (
            <DocumentManager
              documents={data.documents}
              transactions={data.transactions}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

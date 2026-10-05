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
        <header className="border-b border-white/[0.07] pb-7">
          <h1 className="text-[27px] font-semibold tracking-[-0.035em]">
            Skjöl
          </h1>
          <p className="mt-2 text-[12px] text-[#7a827c]">
            Einkaskjöl tengd eignaviðskiptum.
          </p>
        </header>
        <div className="pt-6">
          {data.error ? (
            <p className="text-[#c98279]">Ekki tókst að sækja skjöl.</p>
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

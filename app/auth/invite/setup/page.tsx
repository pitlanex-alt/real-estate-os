import type { Metadata } from "next";
import Link from "next/link";
import { KelvoLogo } from "@/app/components/KelvoBrand";
import { createClient } from "@/lib/supabase/server";
import { InvitePasswordForm } from "../InvitePasswordForm";

export const metadata: Metadata = { title: "Teymisboð — Kelvo" };

type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>) { return Array.isArray(value) ? value[0] ?? null : value; }

export default async function InviteSetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const membershipResult = user ? await supabase
    .from("organization_memberships")
    .select("organization:organizations(name)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle() : null;
  const profileResult = user ? await supabase.from("profiles").select("display_name,email").eq("id", user.id).maybeSingle() : null;
  const organization = one(membershipResult?.data?.organization as Relation<{ name: string }>);
  const profile = profileResult?.data;
  const canAccept = Boolean(user?.invited_at && organization && !query.error);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-10 text-[var(--text-primary)]">
      <section className="kelvo-card w-full max-w-[440px] p-7 sm:p-9" aria-labelledby="invite-heading">
        <KelvoLogo className="w-[116px]" priority />
        {canAccept ? (
          <>
            <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667d5d]">Boð í teymi</p>
            <h1 id="invite-heading" className="mt-3 text-[27px] font-bold tracking-[-0.04em]">Velkomin í Kelvo</h1>
            <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">
              Settu lykilorð til að ljúka boðinu og opna vinnusvæði {organization?.name}.
            </p>
            <div className="mt-6 rounded-[14px] bg-[var(--surface-soft)] px-4 py-3">
              <p className="text-[13px] font-semibold">{profile?.display_name ?? user?.user_metadata.display_name ?? "Nýr teymisaðili"}</p>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{profile?.email ?? user?.email}</p>
            </div>
            <InvitePasswordForm />
          </>
        ) : (
          <>
            <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#914b45]">Boð ekki virkt</p>
            <h1 id="invite-heading" className="mt-3 text-[27px] font-bold tracking-[-0.04em]">Boðstengillinn virkar ekki</h1>
            <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">Tengillinn kann að vera útrunninn eða þegar notaður. Biddu stjórnanda fasteignasölunnar um nýtt boð.</p>
            <Link href="/login" className="mo-button mo-button-secondary mt-7 inline-flex min-h-11 px-4 text-[12px]">Fara í innskráningu</Link>
          </>
        )}
      </section>
    </main>
  );
}

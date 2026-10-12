import Link from "next/link";
import { KelvoLogo } from "@/app/components/KelvoBrand";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "../UpdatePasswordForm";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-10"><section className="kelvo-card w-full max-w-sm p-7 sm:p-9"><KelvoLogo className="w-[116px]" priority /><p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667d5d]">Aðgangur starfsfólks</p><h1 className="mt-3 text-[27px] font-bold tracking-[-0.04em]">Veldu nýtt lykilorð</h1>{user ? <><p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">Notaðu sterkt lykilorð sem þú notar ekki annars staðar.</p><UpdatePasswordForm /></> : <><p role="alert" className="mt-5 rounded-[12px] bg-[#f7e7e5] px-3 py-3 text-[13px] leading-6 text-[#914b45]">Endurstillingartengillinn er ógildur eða útrunninn.</p><Link href="/auth/reset-password" className="mo-button mo-button-primary mt-6 min-h-11 w-full px-4 text-[12px] font-semibold">Senda nýjan tengil</Link></>}</section></main>;
}

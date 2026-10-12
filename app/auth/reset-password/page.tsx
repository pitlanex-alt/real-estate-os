import Link from "next/link";
import { KelvoLogo } from "@/app/components/KelvoBrand";
import { ResetRequestForm } from "./ResetRequestForm";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-10"><section className="kelvo-card w-full max-w-sm p-7 sm:p-9"><KelvoLogo className="w-[116px]" priority /><p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667d5d]">Aðgangur starfsfólks</p><h1 className="mt-3 text-[27px] font-bold tracking-[-0.04em]">Endurstilla lykilorð</h1><p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">Sláðu inn netfangið þitt og við sendum leiðbeiningar ef aðgangur er skráður.</p>{params.error === "invalid" && <p role="alert" className="mt-5 rounded-[12px] bg-[#f7e7e5] px-3 py-2.5 text-[13px] text-[#914b45]">Endurstillingartengillinn er ógildur eða útrunninn.</p>}<ResetRequestForm /><p className="mt-6 text-center text-[11px] text-[var(--text-muted)]">Þarftu aðstoð? Hafðu samband við stjórnanda fasteignasölunnar.</p><Link href="/login" className="sr-only">Til baka í innskráningu</Link></section></main>;
}

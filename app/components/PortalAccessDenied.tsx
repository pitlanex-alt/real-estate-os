import Link from "next/link";
import { logoutCustomer } from "@/app/customer/actions";
import { Button } from "@/app/components/ui/Button";
import { KelvoLogo } from "@/app/components/KelvoBrand";

export function PortalAccessDenied() {
  return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5"><section className="kelvo-card w-full max-w-md p-7 sm:p-9"><KelvoLogo className="w-[116px]" priority /><div className="mt-8 rounded-[16px] bg-[var(--surface-soft)] p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667d5d]">Aðgangur ekki heimilaður</p><h1 className="mt-3 text-[24px] font-bold tracking-[-0.035em] text-[var(--text-primary)]">Þú hefur ekki aðgang að þessari eign.</h1><p className="mt-3 text-[14px] leading-6 text-[var(--text-secondary)]">Aðgangur að gáttinni er bundinn við tiltekna eign og þarf að vera virkur.</p></div><div className="mt-6 flex flex-col gap-3 sm:flex-row"><form action={logoutCustomer}><Button type="submit" variant="primary" className="w-full text-base font-semibold">Skrá inn sem annar notandi</Button></form><Link href="/customer/login" className="mo-button mo-button-secondary min-h-11 px-4 text-base">Til baka</Link></div></section></main>;
}

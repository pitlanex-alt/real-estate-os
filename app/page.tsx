import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { AttentionList } from "@/app/components/AttentionList";
import { MetricItem } from "@/app/components/MetricItem";
import { PropertyRow } from "@/app/components/PropertyRow";
import { ScheduleList } from "@/app/components/ScheduleList";
import { AppShell } from "@/app/components/AppShell";
import { requireInternalIdentity } from "@/lib/auth/post-auth";
import { getDashboardData } from "@/lib/dashboard/server";
import { formatIcelandicTime } from "@/lib/datetime/iceland";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);
  const dashboard = await getDashboardData(supabase);
  const firstName = identity.displayName.split(/\s+/)[0];
  const dayLabel = new Intl.DateTimeFormat("is-IS", { weekday: "long", day: "numeric", month: "long", timeZone: "Atlantic/Reykjavik" }).format(new Date());
  const updatedAt = formatIcelandicTime(new Date());
  const activePropertyCount = dashboard.metrics.find((metric) => metric.label === "Virkar fasteignir")?.value ?? "0";

  return (
    <AppShell identity={identity}>
        <div className="mx-auto w-full max-w-[1336px] px-4 pb-14 pt-8 sm:px-6 sm:pt-10 lg:px-10 lg:pt-12 xl:px-12">
          <section aria-labelledby="dashboard-heading">
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-[#6f846f]">{dayLabel}</p>
                <h1 id="dashboard-heading" className="text-[27px] font-semibold leading-tight tracking-[-0.035em] text-[#f3f1ea] sm:text-[30px]">
                  Góðan daginn, {firstName}
                </h1>
                <p className="mt-2 text-[12px] text-[#818983]">Hér er það helsta í dag.</p>
              </div>
              <p className="hidden text-right text-[10px] leading-5 text-[#626a64] md:block">
                Síðast uppfært
                <br />
                í dag kl. {updatedAt}
              </p>
            </div>

            {dashboard.error && <p role="alert" className="mt-7 border-y border-[#c8665b]/25 py-4 text-[12px] text-[#c99088]">{dashboard.error}</p>}
            <div className="mt-9 grid grid-cols-2 border-y border-white/[0.08] py-4 sm:grid-cols-4 sm:divide-x sm:divide-white/[0.07]">
              {dashboard.metrics.map((metric, index) => (
                <div key={metric.label} className={`${index % 2 === 1 ? "pl-4" : "pr-4"} sm:px-5 sm:first:pl-0 sm:last:pr-0`}>
                  <MetricItem {...metric} />
                </div>
              ))}
            </div>
          </section>

          <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-14 xl:gap-20">
            <ScheduleList items={dashboard.schedule} />
            <AttentionList items={dashboard.attention} />
          </div>

          <section className="mt-12" aria-labelledby="properties-heading">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <h2 id="properties-heading" className="text-[17px] font-semibold tracking-[-0.02em] text-[#f0efe8]">
                  Virkar eignir
                </h2>
                <span className="text-[10px] text-[#68706a]">{activePropertyCount} alls</span>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/properties" className="mo-button mo-button-text flex h-8 items-center gap-1.5 px-1 text-[10px] font-medium">
                  Sjá allar
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            <div className="hidden border-b border-t border-white/[0.07] px-1 py-2.5 text-[8.5px] font-medium uppercase tracking-[0.09em] text-[#59615b] xl:grid xl:grid-cols-[72px_minmax(190px,1.45fr)_minmax(170px,1fr)_190px_160px_20px] xl:gap-5">
              <span />
              <span>Eign</span>
              <span>Staða og næsta skref</span>
              <span>Áhugi</span>
              <span>Umsjón</span>
              <span />
            </div>

            <ul className="hidden xl:block">
              {dashboard.properties.map((property) => (
                <PropertyRow key={property.id} property={property} />
              ))}
            </ul>

            {!dashboard.properties.length && !dashboard.error && (
              <p className="border-y border-white/[0.07] py-10 text-[12px] text-[#737b75]">Engar virkar eignir fundust.</p>
            )}

            <ul className="divide-y divide-white/[0.07] border-y border-white/[0.07] xl:hidden">
              {dashboard.properties.map((property) => (
                <li key={property.id}>
                  <Link href={property.href ?? "#"} className="grid grid-cols-[64px_1fr_16px] items-center gap-4 py-4">
                    <div
                      role="img"
                      aria-label={`Mynd af ${property.address}`}
                      className={`property-image property-image-${property.imageVariant} h-14 w-16 rounded-[8px] border border-white/[0.08]`}
                    >
                      <span className="property-building" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[12px] font-semibold text-[#eeede6]">{property.address}</h3>
                        <span className="shrink-0 rounded-full bg-[#6f846f]/10 px-2 py-0.5 text-[8px] text-[#a7b5a5]">{property.status}</span>
                      </div>
                      <p className="mt-1 text-[9.5px] text-[#737b75]">{property.location}</p>
                      <p className={`mt-2 truncate text-[9px] ${property.noteTone === "warning" ? "text-[#c99a52]" : "text-[#667069]"}`}>{property.note}</p>
                    </div>
                    <ArrowRight size={14} className="text-[#59615b]" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
    </AppShell>
  );
}

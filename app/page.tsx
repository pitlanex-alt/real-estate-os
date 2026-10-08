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
  const dashboard = await getDashboardData(supabase, identity.organizationId);
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
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#627254]">{dayLabel}</p>
                <h1 id="dashboard-heading" className="text-[28px] font-bold leading-tight tracking-[-0.04em] text-[var(--text-primary)] sm:text-[32px]">
                  Góðan daginn, {firstName}
                </h1>
                <p className="mt-2 text-[13px] text-[var(--text-secondary)]">Hér er það helsta í dag.</p>
              </div>
              <p className="hidden text-right text-[10px] leading-5 text-[var(--text-muted)] md:block">
                Síðast uppfært
                <br />
                í dag kl. {updatedAt}
              </p>
            </div>

            {dashboard.error && <p role="alert" className="mt-7 rounded-[14px] border border-[#b75e56]/20 bg-[#f7e7e5] px-4 py-3 text-[12px] text-[#914b45]">{dashboard.error}</p>}
            <div className="kelvo-card mt-8 grid grid-cols-2 overflow-hidden p-2 sm:grid-cols-4">
              {dashboard.metrics.map((metric, index) => (
                <div key={metric.label} className={`rounded-[15px] px-4 py-4 sm:px-5 ${index === 0 ? "bg-[var(--surface-accent)]" : ""}`}>
                  <MetricItem {...metric} />
                </div>
              ))}
            </div>
          </section>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <div className="kelvo-card p-5 sm:p-6"><ScheduleList items={dashboard.schedule} /></div>
            <div className="kelvo-card p-5 sm:p-6"><AttentionList items={dashboard.attention} /></div>
          </div>

          <section className="kelvo-card mt-8 overflow-hidden p-4 sm:p-6" aria-labelledby="properties-heading">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <h2 id="properties-heading" className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
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

            <div className="hidden border-b border-t border-black/[0.06] px-3 py-2.5 text-[8.5px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)] xl:grid xl:grid-cols-[84px_minmax(190px,1.45fr)_minmax(170px,1fr)_190px_160px_20px] xl:gap-5">
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
              <p className="border-y border-black/[0.06] py-10 text-[12px] text-[var(--text-secondary)]">Engar virkar eignir fundust.</p>
            )}

            <ul className="divide-y divide-black/[0.06] border-y border-black/[0.06] xl:hidden">
              {dashboard.properties.map((property) => (
                <li key={property.id}>
                  <Link href={property.href ?? "#"} className="mo-hover-row grid grid-cols-[76px_1fr_16px] items-center gap-4 rounded-[14px] px-2 py-3">
                    <div
                      role="img"
                      aria-label={`Mynd af ${property.address}`}
                      className={`property-image property-image-${property.imageVariant} h-16 w-[76px] rounded-[12px] border border-black/[0.07]`}
                    >
                      <span className="property-building" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{property.address}</h3>
                        <span className="kelvo-status-progress shrink-0 rounded-full px-2 py-0.5 text-[8px]">{property.status}</span>
                      </div>
                      <p className="mt-1 text-[9.5px] text-[var(--text-secondary)]">{property.location}</p>
                      <p className={`mt-2 truncate text-[9px] ${property.noteTone === "warning" ? "text-[#9b6f2d]" : "text-[var(--text-secondary)]"}`}>{property.note}</p>
                    </div>
                    <ArrowRight size={14} className="text-[var(--text-muted)]" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
    </AppShell>
  );
}

"use client";

import { Check, ChevronRight, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Select } from "@/app/components/ui/Select";
import { SearchInput } from "@/app/components/ui/Input";
import {
  propertyStatusFilters,
  type IndexedProperty,
} from "@/app/data/properties-index";

function PropertyImage({ property, className = "" }: { property: IndexedProperty; className?: string }) {
  if (property.imageUrl) return <span role="img" aria-label={`Mynd af ${property.address}`} className={`relative block shrink-0 overflow-hidden rounded-[12px] border border-black/[0.07] bg-[var(--surface-soft)] ${className}`}><Image unoptimized fill sizes="96px" src={property.imageUrl} alt="" className="object-cover" /></span>;
  return (
    <span role="img" aria-label={`Mynd af ${property.address}`} className={`property-image property-image-flat property-image-${property.imageVariant} block shrink-0 overflow-hidden rounded-[12px] border border-black/[0.07] ${className}`}>
      <span className="property-building" />
    </span>
  );
}

function Agent({ property }: { property: IndexedProperty }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--mint)] text-[8px] font-bold tracking-wide text-[#3f594c] ring-1 ring-inset ring-black/[0.05]">{property.agentInitials}</span>
      <span className="truncate text-[10px] text-[var(--text-secondary)]">{property.agent}</span>
    </span>
  );
}

function DesktopPropertyRow({ property }: { property: IndexedProperty }) {
  return (
    <li>
      <Link href={property.href} className="mo-hover-row group grid min-h-[104px] grid-cols-[88px_minmax(150px,1.25fr)_minmax(120px,.85fr)_105px_95px_minmax(135px,1fr)_130px_16px] items-center gap-3 rounded-[14px] px-2 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-[#7d9961]/60">
        <PropertyImage property={property} className="h-[72px] w-[88px]" />
        <span className="min-w-0"><span className="block truncate text-[13px] font-semibold text-[var(--text-primary)]">{property.address}</span><span className="mt-1 block text-[10px] text-[var(--text-secondary)]">{property.location}</span></span>
        <span className="truncate text-[10px] text-[var(--text-secondary)]">{property.seller}</span>
        <span className={`truncate text-[10px] font-medium ${property.price.startsWith("Verð") ? "text-[var(--text-muted)]" : "text-[#343934]"}`}>{property.price}</span>
        <span><span className="kelvo-status-progress inline-flex rounded-full px-2.5 py-1 text-[9px] font-medium">{property.stage}</span></span>
        <span className={`truncate text-[9.5px] ${property.nextActionTone === "warning" ? "text-[#9b6f2d]" : "text-[var(--text-secondary)]"}`}>{property.nextAction}</span>
        <Agent property={property} />
        <ChevronRight size={15} strokeWidth={1.5} className="mo-hover-accent text-[var(--text-muted)] transition" />
      </Link>
    </li>
  );
}

function CompactPropertyRow({ property }: { property: IndexedProperty }) {
  return (
    <li>
      <Link href={property.href} className="mo-hover-row group grid grid-cols-[76px_minmax(0,1fr)_16px] gap-4 rounded-[14px] px-2 py-3">
        <PropertyImage property={property} className="h-16 w-[76px]" />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2"><span className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{property.address}</span><span className="kelvo-status-progress rounded-full px-2 py-0.5 text-[8px]">{property.stage}</span></span>
          <span className="mt-1.5 block truncate text-[10px] text-[var(--text-secondary)]">{property.seller} · {property.price}</span>
          <span className={`mt-2 block truncate text-[9.5px] ${property.nextActionTone === "warning" ? "text-[#9b6f2d]" : "text-[var(--text-secondary)]"}`}>{property.nextAction}</span>
          <span className="mt-2 block text-[9px] text-[var(--text-muted)]">{property.agent}</span>
        </span>
        <ChevronRight size={15} className="mo-hover-accent self-center text-[var(--text-muted)]" />
      </Link>
    </li>
  );
}

export function PropertiesIndex({
  properties,
  showSuccess = false,
  loadError = null,
}: {
  properties: IndexedProperty[];
  showSuccess?: boolean;
  loadError?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof propertyStatusFilters)[number]>("Allar");

  const filteredProperties = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("is");
    return properties.filter((property) => {
      const matchesQuery = !normalizedQuery || `${property.address} ${property.seller}`.toLocaleLowerCase("is").includes(normalizedQuery);
      const matchesStatus = status === "Allar" || property.stage === status;
      return matchesQuery && matchesStatus;
    });
  }, [properties, query, status]);

  return (
    <>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-[28px] font-bold tracking-[-0.04em] text-[var(--text-primary)]">Fasteignir</h1><p className="mt-2 text-[13px] text-[var(--text-secondary)]">Yfirlit yfir allar eignir og stöðu þeirra.</p></div>
        <Link href="/properties/new" className="mo-button mo-button-primary min-h-11 px-4 text-[13px] font-semibold"><Plus size={15} />Ný eign</Link>
      </header>

      {showSuccess && (
        <div className="mt-6 flex items-start gap-3 rounded-[14px] border border-[#afcfbe]/60 bg-[var(--surface-accent)] px-4 py-4 text-[11px] text-[#536451]">
          <Check size={14} className="mt-0.5 shrink-0 text-[#627b56]" />
          <p><span className="font-semibold text-[#334033]">Eign stofnuð í undirbúningi.</span> Næstu verkefni eru tilbúin í vinnusvæði eignarinnar.</p>
        </div>
      )}

      {loadError && (
        <div role="alert" className="mt-6 border-y border-[#c8665b]/25 bg-[#c8665b]/[0.04] py-4 text-[11px] text-[#c99088]">
          {loadError}
        </div>
      )}

      <section className="mt-7" aria-label="Leit og síur">
        <div className="grid gap-3 sm:grid-cols-[minmax(240px,1fr)_220px]">
          <div>
            <label htmlFor="property-search" className="sr-only">Leita eftir heimilisfangi eða seljanda</label>
            <SearchInput id="property-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Leita eftir heimilisfangi eða seljanda..." />
          </div>
          <Select id="property-status" ariaLabel="Sía eftir stöðu" value={status} onChange={(value) => setStatus(value as (typeof propertyStatusFilters)[number])} options={propertyStatusFilters.map((filter) => ({ value: filter, label: filter }))} />
        </div>
      </section>

      <section className="kelvo-card mt-7 overflow-hidden px-3 py-4 sm:px-5" aria-labelledby="property-list-heading">
        <div className="mb-3 flex items-baseline justify-between px-2"><h2 id="property-list-heading" className="text-[14px] font-semibold text-[var(--text-primary)]">Allar eignir</h2><span className="text-[10px] text-[var(--text-muted)]">{filteredProperties.length} eignir</span></div>
        <div className="hidden grid-cols-[88px_minmax(150px,1.25fr)_minmax(120px,.85fr)_105px_95px_minmax(135px,1fr)_130px_16px] gap-3 border-y border-black/[0.06] px-2 py-2.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] xl:grid">
          <span /><span>Eign</span><span>Seljandi</span><span>Ásett verð</span><span>Staða</span><span>Næsta skref</span><span>Umsjón</span><span />
        </div>
        {filteredProperties.length ? (
          <>
            <ul className="hidden xl:block">{filteredProperties.map((property) => <DesktopPropertyRow key={property.id} property={property} />)}</ul>
            <ul className="divide-y divide-black/[0.06] border-t border-black/[0.06] xl:hidden">{filteredProperties.map((property) => <CompactPropertyRow key={property.id} property={property} />)}</ul>
          </>
        ) : (
          <div className="border-y border-black/[0.06] py-12 text-center"><p className="text-[13px] text-[var(--text-secondary)]">Engar eignir fundust.</p><button type="button" onClick={() => { setQuery(""); setStatus("Allar"); }} className="mo-button mo-button-text mt-3 min-h-11 px-4 text-[12px] font-medium">Hreinsa síur</button></div>
        )}
      </section>
    </>
  );
}

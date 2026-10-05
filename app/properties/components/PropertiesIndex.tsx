"use client";

import { Check, ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  propertyStatusFilters,
  type IndexedProperty,
} from "@/app/data/properties-index";

function PropertyImage({ property, className = "" }: { property: IndexedProperty; className?: string }) {
  return (
    <span role="img" aria-label={`Mynd af ${property.address}`} className={`property-image property-image-flat property-image-${property.imageVariant} block shrink-0 overflow-hidden rounded-[8px] border border-white/[0.08] ${className}`}>
      <span className="property-building" />
    </span>
  );
}

function Agent({ property }: { property: IndexedProperty }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#252c26] text-[8px] font-semibold tracking-wide text-[#aeb9ac] ring-1 ring-inset ring-white/[0.07]">{property.agentInitials}</span>
      <span className="truncate text-[10px] text-[#838b85]">{property.agent}</span>
    </span>
  );
}

function DesktopPropertyRow({ property }: { property: IndexedProperty }) {
  return (
    <li>
      <Link href={property.href} className="group grid min-h-[92px] grid-cols-[64px_minmax(150px,1.25fr)_minmax(120px,.85fr)_105px_95px_minmax(135px,1fr)_130px_16px] items-center gap-3 border-b border-white/[0.07] py-3 transition-colors hover:bg-white/[0.018]">
        <PropertyImage property={property} className="h-14 w-16" />
        <span className="min-w-0"><span className="block truncate text-[12px] font-semibold text-[#ecebe4]">{property.address}</span><span className="mt-1 block text-[9.5px] text-[#6f7771]">{property.location}</span></span>
        <span className="truncate text-[10px] text-[#9aa19b]">{property.seller}</span>
        <span className={`truncate text-[10px] font-medium ${property.price.startsWith("Verð") ? "text-[#656d67]" : "text-[#c5c6bf]"}`}>{property.price}</span>
        <span><span className="inline-flex rounded-full border border-[#6f846f]/25 bg-[#6f846f]/10 px-2 py-1 text-[9px] font-medium text-[#a5b3a3]">{property.stage}</span></span>
        <span className={`truncate text-[9.5px] ${property.nextActionTone === "warning" ? "text-[#bc965e]" : "text-[#737b75]"}`}>{property.nextAction}</span>
        <Agent property={property} />
        <ChevronRight size={15} strokeWidth={1.5} className="text-[#4e5650] transition group-hover:translate-x-0.5 group-hover:text-[#9caf9a]" />
      </Link>
    </li>
  );
}

function CompactPropertyRow({ property }: { property: IndexedProperty }) {
  return (
    <li>
      <Link href={property.href} className="group grid grid-cols-[64px_minmax(0,1fr)_16px] gap-4 border-b border-white/[0.07] py-4">
        <PropertyImage property={property} className="h-14 w-16" />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2"><span className="truncate text-[12px] font-semibold text-[#ecebe4]">{property.address}</span><span className="rounded-full bg-[#6f846f]/10 px-2 py-0.5 text-[8px] text-[#a5b3a3]">{property.stage}</span></span>
          <span className="mt-1.5 block truncate text-[10px] text-[#858d87]">{property.seller} · {property.price}</span>
          <span className={`mt-2 block truncate text-[9.5px] ${property.nextActionTone === "warning" ? "text-[#bc965e]" : "text-[#69716b]"}`}>{property.nextAction}</span>
          <span className="mt-2 block text-[9px] text-[#59615b]">{property.agent}</span>
        </span>
        <ChevronRight size={15} className="self-center text-[#4e5650] group-hover:text-[#9caf9a]" />
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
      <header className="flex flex-col gap-6 border-b border-white/[0.07] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-[27px] font-semibold tracking-[-0.035em] text-[#f2f0e9]">Fasteignir</h1><p className="mt-2 text-[12px] text-[#7a827c]">Yfirlit yfir allar eignir og stöðu þeirra.</p></div>
        <Link href="/properties/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#6f846f] px-4 text-[13px] font-semibold text-[#111412] hover:bg-[#829782]"><Plus size={15} />Ný eign</Link>
      </header>

      {showSuccess && (
        <div className="mt-6 flex items-start gap-3 border-y border-[#6f846f]/25 bg-[#6f846f]/[0.05] py-4 text-[11px] text-[#aab7a8]">
          <Check size={14} className="mt-0.5 shrink-0 text-[#9caf9a]" />
          <p><span className="font-medium text-[#d7ddd4]">Eign stofnuð í undirbúningi.</span> Næstu verkefni eru tilbúin í vinnusvæði eignarinnar.</p>
        </div>
      )}

      {loadError && (
        <div role="alert" className="mt-6 border-y border-[#c8665b]/25 bg-[#c8665b]/[0.04] py-4 text-[11px] text-[#c99088]">
          {loadError}
        </div>
      )}

      <section className="mt-7" aria-label="Leit og síur">
        <div className="grid gap-3 sm:grid-cols-[minmax(240px,1fr)_220px]">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#69716b]" />
            <label htmlFor="property-search" className="sr-only">Leita eftir heimilisfangi eða seljanda</label>
            <input id="property-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Leita eftir heimilisfangi eða seljanda..." className="min-h-11 w-full rounded-[9px] border border-white/[0.08] bg-[#171b18] pl-10 pr-4 text-base text-[#deddd6] outline-none placeholder:text-[#636b65] focus:border-[#6f846f]/60" />
          </div>
          <div>
            <label htmlFor="property-status" className="sr-only">Sía eftir stöðu</label>
            <select id="property-status" value={status} onChange={(event) => setStatus(event.target.value as (typeof propertyStatusFilters)[number])} className="min-h-11 w-full rounded-[9px] border border-white/[0.08] bg-[#171b18] px-3 text-base text-[#c8cbc4] outline-none focus:border-[#6f846f]/60">
              {propertyStatusFilters.map((filter) => <option key={filter}>{filter}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="mt-7" aria-labelledby="property-list-heading">
        <div className="mb-3 flex items-baseline justify-between"><h2 id="property-list-heading" className="text-[14px] font-semibold text-[#e8e7e0]">Allar eignir</h2><span className="text-[10px] text-[#626a64]">{filteredProperties.length} eignir</span></div>
        <div className="hidden grid-cols-[64px_minmax(150px,1.25fr)_minmax(120px,.85fr)_105px_95px_minmax(135px,1fr)_130px_16px] gap-3 border-y border-white/[0.07] py-2.5 text-[8px] font-medium uppercase tracking-[0.08em] text-[#59615b] xl:grid">
          <span /><span>Eign</span><span>Seljandi</span><span>Ásett verð</span><span>Staða</span><span>Næsta skref</span><span>Umsjón</span><span />
        </div>
        {filteredProperties.length ? (
          <>
            <ul className="hidden xl:block">{filteredProperties.map((property) => <DesktopPropertyRow key={property.id} property={property} />)}</ul>
            <ul className="border-t border-white/[0.07] xl:hidden">{filteredProperties.map((property) => <CompactPropertyRow key={property.id} property={property} />)}</ul>
          </>
        ) : (
          <div className="border-y border-white/[0.07] py-12 text-center"><p className="text-[13px] text-[#8a928c]">Engar eignir fundust.</p><button type="button" onClick={() => { setQuery(""); setStatus("Allar"); }} className="mt-3 min-h-11 px-4 text-[12px] font-medium text-[#899b8a]">Hreinsa síur</button></div>
        )}
      </section>
    </>
  );
}

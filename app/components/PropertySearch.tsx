"use client";

import Link from "next/link";
import { useState } from "react";
import { SearchInput } from "@/app/components/ui/Input";
import type { PropertySearchOption } from "@/lib/properties/search";

export function PropertySearch({ options }: { options: PropertySearchOption[] }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("is-IS");
  const results = normalized
    ? options.filter((option) => `${option.address} ${option.location} ${option.sellers.join(" ")}`.toLocaleLowerCase("is-IS").includes(normalized)).slice(0, 6)
    : [];

  return <div className="relative w-full max-w-[480px]">
    <label htmlFor="global-search" className="sr-only">Leita</label>
    <SearchInput id="global-search" controlSize="compact" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Leita að fasteign eða seljanda..." className="bg-[#f7f8f5] text-[13px]" />
    {normalized && <div className="absolute inset-x-0 top-12 overflow-hidden rounded-[16px] border border-black/[0.08] bg-white p-1.5 shadow-[0_18px_46px_rgba(25,34,24,0.12)]">
      <ul>{results.map((result) => <li key={result.href}><Link href={result.href} onClick={() => setQuery("")} className="mo-hover-row block rounded-[11px] px-3 py-3"><p className="text-[13px] font-semibold text-[#252925]">{result.address}</p><p className="mt-1 text-[11px] text-[#7d847c]">{result.location}{result.sellers.length ? ` · ${result.sellers.join(", ")}` : ""}</p></Link></li>)}{!results.length && <li className="px-3 py-4 text-[12px] text-[#858c84]">Engin eign fannst.</li>}</ul>
    </div>}
  </div>;
}

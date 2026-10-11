"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Input, SearchInput } from "@/app/components/ui/Input";
import { Panel } from "@/app/components/ui/Panel";
import { createContact, type ContactState } from "./actions";

type Contact = { id: string; name: string; email: string | null; phone: string | null; contexts: string[]; properties: string[] };
const contactColumns = "lg:grid-cols-[minmax(150px,1.05fr)_minmax(120px,.75fr)_minmax(180px,1fr)_minmax(110px,.7fr)_minmax(170px,1.1fr)]";

function MobileLabel({ children }: { children: string }) {
  return <span className="mr-2 text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)] lg:hidden">{children}</span>;
}

export function ContactDirectory({ contacts, canEdit }: { contacts: Contact[]; canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [show, setShow] = useState(false);
  const [state, action, pending] = useActionState(createContact, { error: null } satisfies ContactState);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("is-IS");
    return normalized ? contacts.filter((contact) => `${contact.name} ${contact.email ?? ""} ${contact.phone ?? ""} ${contact.properties.join(" ")}`.toLocaleLowerCase("is-IS").includes(normalized)) : contacts;
  }, [contacts, query]);

  return <>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
      <label className="block max-w-md flex-1"><span className="sr-only">Leita að tengilið</span><SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Leita eftir nafni, netfangi eða eign..." /></label>
      {canEdit && <Button variant="primary" onClick={() => setShow(!show)}><Plus size={14} />Nýr tengiliður</Button>}
    </div>
    {show && <Panel className="mt-5"><form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_160px_auto]"><Input name="name" required placeholder="Nafn" /><Input name="email" type="email" placeholder="Netfang" /><Input name="phone" placeholder="Sími" /><Button type="submit" variant="primary" disabled={pending}>Stofna</Button>{state.error && <p role="alert" className="sm:col-span-4 text-[12px] text-[#a24f48]">{state.error}</p>}</form></Panel>}
    <Panel className="mt-5 overflow-hidden p-3 sm:p-4">
      <div className={`hidden min-h-9 items-center gap-4 border-b border-black/[0.07] px-2 text-[9.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] lg:grid ${contactColumns}`} aria-hidden="true">
        <span>Nafn</span><span>Hlutverk</span><span>Netfang</span><span>Sími</span><span>Tengd eign</span>
      </div>
      {filtered.map((contact) => <Link key={contact.id} href={`/contacts/${contact.id}`} className={`grid gap-2 rounded-[12px] border-b border-black/[0.06] px-2 py-4 last:border-b-0 lg:min-h-[66px] lg:items-center lg:gap-4 ${contactColumns}`}>
        <p className="min-w-0 truncate text-[13px] font-semibold text-[var(--text-primary)]">{contact.name}</p>
        <p className="min-w-0 truncate text-[10.5px] text-[var(--text-secondary)]"><MobileLabel>Hlutverk</MobileLabel>{contact.contexts.join(" · ") || "Tengiliður"}</p>
        <p className="min-w-0 truncate text-[11px] text-[var(--text-secondary)]"><MobileLabel>Netfang</MobileLabel>{contact.email ?? "—"}</p>
        <p className="min-w-0 truncate text-[11px] text-[var(--text-secondary)]"><MobileLabel>Sími</MobileLabel>{contact.phone ?? "—"}</p>
        <p className="min-w-0 truncate text-[10.5px] text-[#60705f]"><MobileLabel>Tengd eign</MobileLabel>{contact.properties.join(", ") || "Engin tengd eign"}</p>
      </Link>)}
      {!filtered.length && <EmptyState>Engir tengiliðir fundust.</EmptyState>}
    </Panel>
  </>;
}

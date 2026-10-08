"use client";

import { Download, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Combobox } from "@/app/components/ui/Combobox";
import { FileUpload } from "@/app/components/ui/FileUpload";
import { Input } from "@/app/components/ui/Input";
import { Select } from "@/app/components/ui/Select";
import type { DocumentVisibility, InternalDocument, WorkOption } from "@/lib/work-items/model";
import { deleteDocumentAction, getDocumentDownloadUrl, updateDocumentVisibilityAction, uploadDocumentAction } from "../actions";

const labels = { internal: "Innri", seller: "Seljandi", buyer: "Kaupandi", shared: "Sameiginlegt" };
const visibilityOptions = Object.entries(labels).map(([value, label]) => ({ value, label }));

export function DocumentManager({ documents, transactions }: { documents: InternalDocument[]; transactions: WorkOption[] }) {
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<void>) { setPending(key); setError(null); try { await fn(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Aðgerð mistókst."); } finally { setPending(null); } }
  async function download(id: string) { setPending(id); const result = await getDocumentDownloadUrl(id); setPending(null); if (result.url) window.open(result.url, "_blank", "noopener,noreferrer"); else setError(result.error ?? "Skrá fannst ekki í geymslu."); }
  return <>
    <div className="flex justify-end"><Button variant="primary" onClick={() => setShow(!show)} className="min-h-11 px-4 text-[12px] font-semibold"><Plus size={14} />Hlaða upp skjali</Button></div>
    {show && <UploadDocumentForm transactions={transactions} pending={pending === "upload"} run={(data) => run("upload", () => uploadDocumentAction(data))} />}
    {error && <p role="alert" className="mt-3 text-[12px] text-[#a24f48]">{error}</p>}
    <div className="kelvo-card mt-5 overflow-hidden px-3 sm:px-4">
      {documents.map((document) => <DocumentRow key={document.id} document={document} pending={pending === document.id} run={(fn) => run(document.id, fn)} download={() => void download(document.id)} />)}
      {!documents.length && <p className="py-10 text-[13px] text-[var(--text-secondary)]">Engin skjöl fundust.</p>}
    </div>
  </>;
}

function UploadDocumentForm({ transactions, pending, run }: { transactions: WorkOption[]; pending: boolean; run: (data: FormData) => void }) {
  const [transactionId, setTransactionId] = useState(transactions[0]?.id ?? "");
  const [visibility, setVisibility] = useState("internal");
  return <form action={run} className="kelvo-card mt-5 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_.8fr_1fr_.8fr_1.3fr_auto]">
    <Input name="title" required placeholder="Heiti skjals" controlSize="compact" />
    <Input name="documentType" required placeholder="Tegund" controlSize="compact" />
    <Combobox
      name="transactionId"
      ariaLabel="Eign"
      placeholder="Leita að fasteign..."
      emptyMessage="Engin fasteign fannst."
      value={transactionId}
      onChange={setTransactionId}
      options={transactions.map((item) => ({ value: item.id, label: item.label, description: item.description }))}
      disabled={!transactions.length}
      required
      size="compact"
    />
    <Select name="visibility" ariaLabel="Sýnileiki" value={visibility} onChange={setVisibility} options={visibilityOptions} size="compact" />
    <FileUpload name="file" required presentation="action" chooseLabel="Velja skrá" />
    <Button type="submit" variant="primary" size="compact" disabled={pending || !transactions.length} className="font-semibold">Vista</Button>
  </form>;
}

function DocumentRow({ document, pending, run, download }: { document: InternalDocument; pending: boolean; run: (fn: () => Promise<void>) => void; download: () => void }) {
  const [visibility, setVisibility] = useState<DocumentVisibility>(document.visibility);
  return <article className="mo-hover-row grid gap-3 border-b border-black/[0.06] px-2 py-3 last:border-b-0 md:grid-cols-[minmax(190px,1.5fr)_minmax(110px,.7fr)_minmax(150px,170px)_124px_82px] md:items-center">
    <div><h2 className="text-[12px] font-semibold text-[var(--text-primary)]">{document.title}</h2><p className="mt-1 text-[10px] text-[var(--text-secondary)]"><Link href={`/properties/${document.propertySlug}`} className="mo-button-text">{document.property}</Link> · {document.documentType}</p></div>
    <p className="text-[10px] text-[var(--text-secondary)]">{document.uploadedBy}</p>
    <Select ariaLabel={`Sýnileiki fyrir ${document.title}`} value={visibility} onChange={(value) => setVisibility(value as DocumentVisibility)} options={visibilityOptions} size="compact" />
    <Button size="compact" disabled={pending} onClick={() => run(() => updateDocumentVisibilityAction(document.id, visibility))} className="whitespace-nowrap">Vista aðgang</Button>
    <div className="flex justify-end">
      <Button variant="icon" size="icon" aria-label="Sækja" disabled={pending} onClick={download} className="text-[#5f765a]"><Download size={14} /></Button>
      <Button variant="danger" size="icon" aria-label="Eyða" disabled={pending} onClick={() => run(() => deleteDocumentAction(document.id))} className="border-transparent"><Trash2 size={14} /></Button>
    </div>
  </article>;
}

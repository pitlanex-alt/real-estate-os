"use client";

import { Download, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
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
    {error && <p role="alert" className="mt-3 text-[12px] text-[#c98279]">{error}</p>}
    <div className="mt-6 border-t border-white/[0.07]">
      {documents.map((document) => <DocumentRow key={document.id} document={document} pending={pending === document.id} run={(fn) => run(document.id, fn)} download={() => void download(document.id)} />)}
      {!documents.length && <p className="py-10 text-[13px] text-[#737b75]">Engin skjöl fundust.</p>}
    </div>
  </>;
}

function UploadDocumentForm({ transactions, pending, run }: { transactions: WorkOption[]; pending: boolean; run: (data: FormData) => void }) {
  const [transactionId, setTransactionId] = useState(transactions[0]?.id ?? "");
  const [visibility, setVisibility] = useState("internal");
  return <form action={run} className="mt-5 grid gap-3 border-y border-white/[0.07] py-5 md:grid-cols-2 xl:grid-cols-[1fr_.8fr_1fr_.8fr_1.3fr_auto]">
    <input name="title" required placeholder="Heiti skjals" className="mo-control min-h-11 min-w-0 px-3 text-base outline-none" />
    <input name="documentType" required placeholder="Tegund" className="mo-control min-h-11 min-w-0 px-3 text-base outline-none" />
    <Select name="transactionId" ariaLabel="Eign" value={transactionId} onChange={setTransactionId} options={transactions.map((item) => ({ value: item.id, label: item.label }))} disabled={!transactions.length} />
    <Select name="visibility" ariaLabel="Sýnileiki" value={visibility} onChange={setVisibility} options={visibilityOptions} />
    <input name="file" type="file" required className="min-h-11 min-w-0 text-base text-[#929a94] file:mr-2 file:min-h-11 file:cursor-pointer file:rounded-[8px] file:border file:border-white/[0.08] file:bg-[#202620] file:px-3 file:text-[#bdc6bb]" />
    <Button type="submit" variant="primary" disabled={pending || !transactions.length} className="min-h-11 px-4 text-[12px] font-semibold">Vista</Button>
  </form>;
}

function DocumentRow({ document, pending, run, download }: { document: InternalDocument; pending: boolean; run: (fn: () => Promise<void>) => void; download: () => void }) {
  const [visibility, setVisibility] = useState<DocumentVisibility>(document.visibility);
  return <article className="grid gap-3 border-b border-white/[0.07] py-4 md:grid-cols-[1.5fr_.7fr_150px_130px_auto] md:items-center">
    <div><h2 className="text-[13px] font-medium text-[#e4e3dc]">{document.title}</h2><p className="mt-1 text-[10.5px] text-[#6f7771]"><Link href={`/properties/${document.propertySlug}`} className="mo-button-text">{document.property}</Link> · {document.documentType}</p></div>
    <p className="text-[11px] text-[#8b938d]">{document.uploadedBy}</p>
    <Select ariaLabel={`Sýnileiki fyrir ${document.title}`} value={visibility} onChange={(value) => setVisibility(value as DocumentVisibility)} options={visibilityOptions} />
    <Button disabled={pending} onClick={() => run(() => updateDocumentVisibilityAction(document.id, visibility))} className="min-h-11 px-3 text-[11px]">Vista aðgang</Button>
    <div className="flex justify-end">
      <Button variant="icon" aria-label="Sækja" disabled={pending} onClick={download} className="size-11 text-[#93a590]"><Download size={15} /></Button>
      <Button variant="danger" aria-label="Eyða" disabled={pending} onClick={() => run(() => deleteDocumentAction(document.id))} className="size-11 border-transparent"><Trash2 size={15} /></Button>
    </div>
  </article>;
}

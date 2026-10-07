"use client";

import { Check, Clock3, Download, FileText } from "lucide-react";
import { useState } from "react";
import { getDocumentDownloadUrl } from "@/app/documents/actions";
import type { CustomerDocument, CustomerTask } from "@/lib/work-items/model";

const statusLabels = { not_started: "Ekki hafið", in_progress: "Í vinnslu", completed: "Lokið", cancelled: "Hætt við" };

export function CustomerWorkItems({ tasks, documents, showTasks = true }: { tasks: CustomerTask[]; documents: CustomerDocument[]; showTasks?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  async function download(id: string) { setError(null); const result = await getDocumentDownloadUrl(id); if (result.url) window.open(result.url, "_blank", "noopener,noreferrer"); else setError(result.error ?? "Ekki tókst að opna skjalið."); }
  return <div>
    {showTasks && <div><p className="text-[11px] font-medium uppercase tracking-[0.11em] text-[#738074]">Verkefni</p><ul className="mt-3 divide-y divide-white/[0.06] border-y border-white/[0.07]">{tasks.map((task) => <li key={task.id} className="flex min-h-14 items-center gap-3 py-2 text-[13px] text-[#a9aea8]">{task.status === "completed" ? <Check size={14} className="text-[#8fa18d]" /> : <Clock3 size={14} className="text-[#b3976b]" />}<span className="min-w-0 flex-1">{task.title}</span><span className="text-[11px] text-[#727a74]">{statusLabels[task.status]}</span></li>)}{!tasks.length && <li className="py-4 text-[13px] text-[#7a827c]">Engin verkefni bíða eftir þér.</li>}</ul></div>}
    <div className={showTasks ? "mt-7" : ""}><p className="text-[11px] font-medium uppercase tracking-[0.11em] text-[#738074]">Skjöl</p>{error && <p role="alert" className="mt-3 text-[12px] text-[#c98279]">{error}</p>}<ul className="mt-3 border-t border-white/[0.07]">{documents.map((document) => <li key={document.id} className="flex min-h-14 items-center gap-3 border-b border-white/[0.07] py-2"><FileText size={15} className="text-[#788679]" /><span className="min-w-0 flex-1 text-[13px] text-[#b6bab3]">{document.title}</span><button type="button" onClick={() => void download(document.id)} className="mo-button mo-button-text min-h-11 px-2 text-[13px] font-medium">Opna <span className="sr-only">{document.title}</span><Download size={13} /></button></li>)}{!documents.length && <li className="border-b border-white/[0.07] py-4 text-[13px] text-[#7a827c]">Engin skjöl í boði.</li>}</ul></div>
  </div>;
}

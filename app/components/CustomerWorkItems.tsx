"use client";

import { Check, Clock3, Download, FileText } from "lucide-react";
import { useState } from "react";
import { getDocumentDownloadUrl } from "@/app/documents/actions";
import { Button } from "@/app/components/ui/Button";
import type { CustomerDocument, CustomerTask } from "@/lib/work-items/model";

const statusLabels = { not_started: "Ekki hafið", in_progress: "Í vinnslu", completed: "Lokið", cancelled: "Hætt við" };

export function CustomerWorkItems({ tasks, documents, showTasks = true }: { tasks: CustomerTask[]; documents: CustomerDocument[]; showTasks?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  async function download(id: string) { setError(null); const result = await getDocumentDownloadUrl(id); if (result.url) window.open(result.url, "_blank", "noopener,noreferrer"); else setError(result.error ?? "Ekki tókst að opna skjalið."); }
  return <div>
    {showTasks && <div><p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#667d5d]">Verkefni</p><ul className="mt-3 divide-y divide-black/[0.06] border-y border-black/[0.06]">{tasks.map((task) => <li key={task.id} className="flex min-h-14 items-center gap-3 py-2 text-[13px] text-[#474e47]">{task.status === "completed" ? <Check size={14} className="text-[#69805f]" /> : <Clock3 size={14} className="text-[#a87835]" />}<span className="min-w-0 flex-1">{task.title}</span><span className="text-[11px] text-[var(--text-muted)]">{statusLabels[task.status]}</span></li>)}{!tasks.length && <li className="py-4 text-[13px] text-[var(--text-secondary)]">Engin verkefni bíða eftir þér.</li>}</ul></div>}
    <div className={showTasks ? "mt-7" : ""}><p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#667d5d]">Skjöl</p>{error && <p role="alert" className="mt-3 text-[12px] text-[#a24f48]">{error}</p>}<ul className="mt-3 border-t border-black/[0.06]">{documents.map((document) => <li key={document.id} className="flex min-h-14 items-center gap-3 border-b border-black/[0.06] py-2"><FileText size={15} className="text-[#60765d]" /><span className="min-w-0 flex-1 text-[13px] text-[#474e47]">{document.title}</span><Button variant="text" type="button" onClick={() => void download(document.id)} className="text-[13px] font-medium">Opna <span className="sr-only">{document.title}</span><Download size={13} /></Button></li>)}{!documents.length && <li className="border-b border-black/[0.06] py-4 text-[13px] text-[var(--text-secondary)]">Engin skjöl í boði.</li>}</ul></div>
  </div>;
}

"use client";

import { Check, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { DateTimePicker, toIcelandDateTimeLocal } from "@/app/components/ui/DateTimePicker";
import { Select } from "@/app/components/ui/Select";
import type { InternalTask, WorkOption } from "@/lib/work-items/model";
import { cancelTaskAction, completeTaskAction, createTaskAction, updateTaskAction } from "../actions";

const statusLabels = { not_started: "Ekki hafið", in_progress: "Í vinnslu", completed: "Lokið", cancelled: "Hætt við" };
const visibilityLabels = { internal: "Innri", seller: "Seljandi", buyer: "Kaupandi", seller_and_buyer: "Báðir" };
const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }));
const visibilityOptions = Object.entries(visibilityLabels).map(([value, label]) => ({ value, label }));

export function TaskManager({ tasks, transactions, assignees }: { tasks: InternalTask[]; transactions: WorkOption[]; assignees: WorkOption[] }) {
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<void>) {
    setPending(key);
    setError(null);
    try { await fn(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Aðgerð mistókst."); }
    finally { setPending(null); }
  }

  return <>
    <div className="flex justify-end">
      <Button variant="primary" onClick={() => setShow(!show)} className="min-h-11 px-4 text-[12px] font-semibold"><Plus size={14} />Nýtt verkefni</Button>
    </div>
    {show && <NewTaskForm transactions={transactions} assignees={assignees} pending={pending === "create"} run={(data) => run("create", () => createTaskAction(data))} />}
    {error && <p role="alert" className="mt-3 text-[12px] text-[#c98279]">{error}</p>}
    <div className="mt-6 border-t border-white/[0.07]">
      {tasks.map((task) => <TaskRow key={task.id} task={task} assignees={assignees} pending={pending === task.id} run={(fn) => run(task.id, fn)} />)}
      {!tasks.length && <p className="py-10 text-[13px] text-[#737b75]">Engin verkefni fundust.</p>}
    </div>
  </>;
}

function NewTaskForm({ transactions, assignees, pending, run }: { transactions: WorkOption[]; assignees: WorkOption[]; pending: boolean; run: (data: FormData) => void }) {
  const [transactionId, setTransactionId] = useState(transactions[0]?.id ?? "");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [visibility, setVisibility] = useState("internal");
  return <form action={run} className="mt-5 grid gap-3 border-y border-white/[0.07] py-5 md:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr_1.25fr_1fr_auto]">
    <input name="title" required placeholder="Heiti verkefnis" className="mo-control min-h-11 min-w-0 px-3 text-base outline-none" />
    <Select name="transactionId" ariaLabel="Eign" required value={transactionId} onChange={setTransactionId} options={transactions.map((item) => ({ value: item.id, label: item.label }))} disabled={!transactions.length} />
    <Select name="assignedTo" ariaLabel="Ábyrgðaraðili" value={assignedTo} onChange={setAssignedTo} options={[{ value: "", label: "Óúthlutað" }, ...assignees.map((item) => ({ value: item.id, label: item.label }))]} />
    <DateTimePicker name="dueAt" ariaLabel="Skiladagur" value={dueAt} onChange={setDueAt} />
    <Select name="visibility" ariaLabel="Sýnileiki" value={visibility} onChange={setVisibility} options={visibilityOptions} />
    <Button type="submit" variant="primary" disabled={pending || !transactions.length} className="min-h-11 px-4 text-[12px] font-semibold">Vista</Button>
  </form>;
}

function TaskRow({ task, assignees, pending, run }: { task: InternalTask; assignees: WorkOption[]; pending: boolean; run: (fn: () => Promise<void>) => void }) {
  const [status, setStatus] = useState(task.status);
  const [due, setDue] = useState(toIcelandDateTimeLocal(task.dueAt));
  const [assigned, setAssigned] = useState(task.assigneeId ?? "");
  const [visibility, setVisibility] = useState(task.visibility);
  const overdue = task.dueAt && new Date(task.dueAt) < new Date() && !["completed", "cancelled"].includes(task.status);
  const subdued = task.status === "completed" || task.status === "cancelled";

  return <article className={`grid gap-3 border-b border-white/[0.07] py-4 xl:grid-cols-[1.25fr_.8fr_130px_190px_125px_82px_auto] xl:items-center ${subdued ? "bg-white/[0.008]" : ""}`}>
    <div className={subdued ? "opacity-70" : ""}>
      <h2 className="text-[13px] font-medium text-[#e4e3dc]">{task.title}</h2>
      <p className="mt-1 text-[10.5px] text-[#6f7771]"><Link href={`/properties/${task.propertySlug}`} className="mo-button-text">{task.property}</Link></p>
    </div>
    <Select ariaLabel={`Ábyrgðaraðili fyrir ${task.title}`} value={assigned} onChange={setAssigned} options={[{ value: "", label: "Óúthlutað" }, ...assignees.map((item) => ({ value: item.id, label: item.label }))]} />
    <Select ariaLabel={`Staða fyrir ${task.title}`} value={status} onChange={(value) => setStatus(value as InternalTask["status"])} options={statusOptions} />
    <DateTimePicker ariaLabel={`Skiladagur fyrir ${task.title}`} value={due} onChange={setDue} error={Boolean(overdue)} />
    <Select ariaLabel={`Sýnileiki fyrir ${task.title}`} value={visibility} onChange={(value) => setVisibility(value as InternalTask["visibility"])} options={visibilityOptions} />
    <Button disabled={pending} onClick={() => run(() => updateTaskAction(task.id, status, due, assigned, visibility))} className="min-h-11 px-3 text-[11px]">Vista</Button>
    <div className="flex justify-end">
      <Button variant="icon" aria-label="Ljúka" disabled={pending || task.status === "completed"} onClick={() => run(() => completeTaskAction(task.id))} className="size-11 text-[#93a590]"><Check size={15} /></Button>
      <Button variant="danger" aria-label="Hætta við" disabled={pending || task.status === "cancelled"} onClick={() => run(() => cancelTaskAction(task.id))} className="size-11 border-transparent"><X size={15} /></Button>
    </div>
  </article>;
}

"use client";

import { Check, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { DateTimePicker, toIcelandDateTimeLocal } from "@/app/components/ui/DateTimePicker";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Input } from "@/app/components/ui/Input";
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
    {error && <p role="alert" className="mt-3 text-[12px] text-[#a24f48]">{error}</p>}
    <div className="kelvo-card mt-5 overflow-hidden px-3 sm:px-4">
      {tasks.map((task) => <TaskRow key={task.id} task={task} assignees={assignees} pending={pending === task.id} run={(fn) => run(task.id, fn)} />)}
      {!tasks.length && <EmptyState>Engin verkefni fundust.</EmptyState>}
    </div>
  </>;
}

function NewTaskForm({ transactions, assignees, pending, run }: { transactions: WorkOption[]; assignees: WorkOption[]; pending: boolean; run: (data: FormData) => void }) {
  const [transactionId, setTransactionId] = useState(transactions[0]?.id ?? "");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [visibility, setVisibility] = useState("internal");
  return <form action={run} className="kelvo-card mt-5 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1.35fr_1fr_auto]">
    <Input name="title" required placeholder="Heiti verkefnis" controlSize="compact" />
    <Select name="transactionId" ariaLabel="Eign" required value={transactionId} onChange={setTransactionId} options={transactions.map((item) => ({ value: item.id, label: item.label }))} disabled={!transactions.length} size="compact" />
    <Select name="assignedTo" ariaLabel="Ábyrgðaraðili" value={assignedTo} onChange={setAssignedTo} options={[{ value: "", label: "Óúthlutað" }, ...assignees.map((item) => ({ value: item.id, label: item.label }))]} size="compact" />
    <DateTimePicker name="dueAt" ariaLabel="Skiladagur" value={dueAt} onChange={setDueAt} size="compact" />
    <Select name="visibility" ariaLabel="Sýnileiki" value={visibility} onChange={setVisibility} options={visibilityOptions} size="compact" />
    <Button type="submit" variant="primary" size="compact" disabled={pending || !transactions.length} className="font-semibold">Vista</Button>
  </form>;
}

function TaskRow({ task, assignees, pending, run }: { task: InternalTask; assignees: WorkOption[]; pending: boolean; run: (fn: () => Promise<void>) => void }) {
  const [status, setStatus] = useState(task.status);
  const [due, setDue] = useState(toIcelandDateTimeLocal(task.dueAt));
  const [assigned, setAssigned] = useState(task.assigneeId ?? "");
  const [visibility, setVisibility] = useState(task.visibility);
  const overdue = task.dueAt && new Date(task.dueAt) < new Date() && !["completed", "cancelled"].includes(task.status);
  const subdued = task.status === "completed" || task.status === "cancelled";

  return <article className="mo-hover-row grid gap-3 border-b border-black/[0.06] px-2 py-3 last:border-b-0 xl:grid-cols-[minmax(170px,1.35fr)_minmax(125px,.8fr)_112px_minmax(174px,1fr)_112px_66px_88px] xl:items-center xl:gap-2">
    <div>
      <div className="flex flex-wrap items-center gap-2"><h2 className={`text-[12px] font-semibold text-[var(--text-primary)] ${subdued ? "opacity-70" : ""}`}>{task.title}</h2>{subdued && <span className={`${task.status === "completed" ? "kelvo-status-progress" : "kelvo-status-neutral"} rounded-full px-2 py-0.5 text-[8px]`}>{task.status === "completed" ? "Lokið" : "Hætt við"}</span>}</div>
      <p className={`mt-1 text-[10px] text-[var(--text-secondary)] ${subdued ? "opacity-70" : ""}`}><Link href={`/properties/${task.propertySlug}`} className="mo-button-text">{task.property}</Link> · {visibilityLabels[task.visibility]}</p>
    </div>
    <Select ariaLabel={`Ábyrgðaraðili fyrir ${task.title}`} value={assigned} onChange={setAssigned} options={[{ value: "", label: "Óúthlutað" }, ...assignees.map((item) => ({ value: item.id, label: item.label }))]} size="compact" />
    <Select ariaLabel={`Staða fyrir ${task.title}`} value={status} onChange={(value) => setStatus(value as InternalTask["status"])} options={statusOptions} size="compact" />
    <DateTimePicker ariaLabel={`Skiladagur fyrir ${task.title}`} value={due} onChange={setDue} error={Boolean(overdue)} size="compact" />
    <Select ariaLabel={`Sýnileiki fyrir ${task.title}`} value={visibility} onChange={(value) => setVisibility(value as InternalTask["visibility"])} options={visibilityOptions} size="compact" />
    <Button size="compact" disabled={pending} onClick={() => run(() => updateTaskAction(task.id, status, due, assigned, visibility))}>Vista</Button>
    <div className="flex justify-end gap-0.5">
      <Button variant="positive" size="icon" aria-label="Ljúka" disabled={pending || task.status === "completed"} onClick={() => run(() => completeTaskAction(task.id))}><Check size={14} /></Button>
      <Button variant="danger" size="icon" aria-label="Hætta við" disabled={pending || task.status === "cancelled"} onClick={() => run(() => cancelTaskAction(task.id))}><X size={14} /></Button>
    </div>
  </article>;
}

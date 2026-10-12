"use client";

import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { TransactionLifecycle } from "@/app/components/TransactionLifecycle";
import { Button } from "@/app/components/ui/Button";
import { ConfirmDialog } from "@/app/components/ui/ConfirmDialog";
import { formatIcelandicDate, formatIcelandicTime, formatOfferValidity } from "@/lib/datetime/iceland";
import { documentCategoryLabel, documentFormatLabel, documentVisibilityLabel } from "@/lib/documents/presentation";
import { customerOfferStatusLabel, formatIsk, offerConditionLabel } from "@/lib/offers/model";
import type { PropertyWorkspaceData } from "@/lib/properties/workspace";
import { taskStatusLabel } from "@/lib/work-items/model";
import { ListingPreparation } from "./ListingPreparation";
import { PropertyImageManager } from "./PropertyImageManager";
import { confirmContractSigning } from "../actions";

const stageLabels: Record<string, string> = { valuation: "Verðmat", preparation: "Undirbúningur", listed: "Á sölu", viewings: "Skoðanir", offers: "Tilboð", contract: "Samningur", closing: "Frágangur", handover: "Afhending", completed: "Lokið", cancelled: "Hætt við" };
const tabs = ["Yfirlit", "Skráning", "Skoðanir", "Tilboð", "Verkefni", "Skjöl", "Virkni"] as const;
const tabKeys: Record<(typeof tabs)[number], string> = { Yfirlit: "overview", Skráning: "listing", Skoðanir: "viewings", Tilboð: "offers", Verkefni: "tasks", Skjöl: "documents", Virkni: "activity" };
const keyTabs = Object.fromEntries(Object.entries(tabKeys).map(([label, key]) => [key, label])) as Record<string, (typeof tabs)[number]>;
const contractTaskTitles = ["Staðfesta fjármögnun", "Yfirfara skilyrði tilboðs", "Staðfesta afhendingardag", "Safna nauðsynlegum skjölum", "Undirbúa kaupsamning", "Bóka undirritun"];
const closingTaskTitles = ["Ljúka skilyrðum kaupsamnings", "Staðfesta fjármögnun og greiðslur", "Undirbúa lokaskjöl", "Staðfesta stöðu fyrir afhendingu", "Staðfesta afhendingartíma"];
const taskStatusLabels: Record<string, string> = { not_started: "Ekki hafið", in_progress: "Í vinnslu", completed: "Lokið", cancelled: "Hætt við" };

function ListSection({ title, empty, count, children }: { title: string; empty: string; count: number; children: ReactNode }) { return <section className="kelvo-card mt-6 p-5 sm:p-6"><h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{title}</h2><div className="mt-4 border-t border-black/[0.06]">{count ? children : <p className="py-10 text-[12px] text-[var(--text-secondary)]">{empty}</p>}</div></section>; }

function TransactionChecklist({
  property,
  acceptedOffer,
  titles,
  heading,
  eyebrow,
  isContractPreparation = false,
  canConfirmSigning = false,
}: {
  property: PropertyWorkspaceData;
  acceptedOffer: PropertyWorkspaceData["offers"][number];
  titles: string[];
  heading: string;
  eyebrow: string;
  isContractPreparation?: boolean;
  canConfirmSigning?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tasks = titles.flatMap((title) => {
    const task = property.tasks.find((item) => item.title === title);
    return task ? [task] : [];
  });
  const completed = tasks.filter((task) => task.status === "completed").length;
  const allComplete = tasks.length === titles.length && completed === titles.length;

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      await confirmContractSigning(property.slug, property.transactionId);
      setConfirmOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ekki tókst að staðfesta undirritun.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="kelvo-card mt-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667d5d]">{eyebrow}</p>
          <h2 className="mt-2 text-[18px] font-semibold text-[var(--text-primary)]">
            {isContractPreparation && allComplete ? "Undirbúningi kaupsamnings lokið" : heading}
          </h2>
          <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
            {isContractPreparation && allComplete
              ? "Öllum undirbúningsverkefnum er lokið. Næsta skref er að staðfesta undirritun kaupsamnings."
              : `${completed} af ${titles.length} lokið`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canConfirmSigning && allComplete && (
            <Button variant="primary" onClick={() => setConfirmOpen(true)}>Staðfesta undirritun</Button>
          )}
          <Link href="/tasks" className="mo-button mo-button-secondary min-h-11 px-4 text-[11px]">Opna verkefni</Link>
          <Link href={`/properties/${property.slug}/offers/${acceptedOffer.id}`} className="mo-button mo-button-text min-h-11 text-[11px]">Skoða tilboð <ChevronRight size={14} /></Link>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 rounded-[12px] border border-[#b75e56]/20 bg-[#f7e7e5] px-4 py-3 text-[11px] text-[#914b45]">{error}</p>}
      <dl className="mt-5 grid gap-5 border-y border-black/[0.06] py-5 sm:grid-cols-4">
        <div><dt className="text-[10px] text-[var(--text-muted)]">Kaupandi</dt><dd className="mt-2 text-[12px] text-[#343934]">{acceptedOffer.buyerName}</dd></div>
        <div><dt className="text-[10px] text-[var(--text-muted)]">Samþykkt upphæð</dt><dd className="mt-2 text-[12px] text-[#343934]">{formatIsk(acceptedOffer.amountIsk)}</dd></div>
        <div><dt className="text-[10px] text-[var(--text-muted)]">Óskuð afhending</dt><dd className="mt-2 text-[12px] text-[#343934]">{formatIcelandicDate(`${acceptedOffer.requestedHandoverDate}T12:00:00Z`)}</dd></div>
        <div><dt className="text-[10px] text-[var(--text-muted)]">Skilyrði</dt><dd className="mt-2 text-[12px] text-[#343934]">{acceptedOffer.conditions.map((condition) => offerConditionLabel(condition.type)).join(", ") || "Engin"}</dd></div>
      </dl>
      <div className="mt-7">
        <div className="h-1.5 overflow-hidden rounded-full bg-[#e8ece6]"><div className="h-full bg-[var(--mint-strong)] transition-[width] duration-150" style={{ width: `${(completed / titles.length) * 100}%` }} /></div>
        <div className="mt-4 border-t border-black/[0.06]">
          {titles.map((title) => {
            const task = tasks.find((item) => item.title === title);
            return <div key={title} className="flex min-h-12 items-center justify-between gap-4 border-b border-black/[0.06]"><div className="flex items-center gap-3"><span className={task?.status === "completed" ? "h-2 w-2 rounded-full bg-[#7d9676]" : task?.status === "in_progress" ? "h-2 w-2 rounded-full bg-[#b98a3f]" : "h-2 w-2 rounded-full bg-[#c9cec8]"} /><span className={task?.status === "completed" ? "text-[11px] text-[var(--text-secondary)]" : "text-[11px] text-[#434943]"}>{title}</span></div><span className="text-[10px] text-[var(--text-muted)]">{task ? taskStatusLabels[task.status] ?? task.status : "Bíður stofnunar"}</span></div>;
          })}
        </div>
        <p className="mt-3 text-[10px] text-[var(--text-muted)]">Verkefnin eru innri undirbúningur. Kelvo framkvæmir ekki löggerninga eða undirritun.</p>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Staðfesta undirritun kaupsamnings?"
        description="Viðskiptin færast í Frágang og næstu verkefni verða stofnuð."
        confirmLabel="Staðfesta"
        confirmVariant="primary"
        pending={pending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleConfirm()}
      />
    </section>
  );
}

export function PropertyWorkspace({ property, organizationId, canEdit, canEditListing, nowIso, initialTab = "overview" }: { property: PropertyWorkspaceData; organizationId: string; canEdit: boolean; canEditListing: boolean; nowIso: string; initialTab?: string }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>(keyTabs[initialTab] ?? "Yfirlit");
  useEffect(() => {
    const syncTab = () => setTab(keyTabs[new URL(window.location.href).searchParams.get("tab") ?? "overview"] ?? "Yfirlit");
    window.addEventListener("popstate", syncTab);
    return () => window.removeEventListener("popstate", syncTab);
  }, []);
  function selectTab(nextTab: (typeof tabs)[number]) {
    setTab(nextTab);
    const url = new URL(window.location.href);
    if (nextTab === "Yfirlit") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tabKeys[nextTab]);
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
  const facts = [["Ásett verð", property.askingPriceIsk === null ? "Ekki skráð" : formatIsk(property.askingPriceIsk)], ["Stærð", property.sizeSqm === null ? "—" : `${property.sizeSqm} m²`], ["Herbergi", property.roomCount === null ? "—" : String(property.roomCount)], ["Svefnherbergi", property.bedroomCount === null ? "—" : String(property.bedroomCount)], ["Byggingarár", property.yearBuilt === null ? "—" : String(property.yearBuilt)], ["Fastanúmer", property.registryNumber ?? "—"]];

  const cover = property.images.find((image) => image.isCover) ?? property.images[0];
  const acceptedOffer = property.offers.find((offer) => offer.status === "accepted");
  return <><header className="kelvo-card grid overflow-hidden md:grid-cols-[minmax(220px,34%)_1fr]"><div className="property-image property-image-city relative min-h-[180px] overflow-hidden md:min-h-[220px]">{cover?.url ? <Image unoptimized fill sizes="(max-width: 768px) 100vw, 560px" src={cover.url} alt={`Forsíðumynd af ${property.address}`} decoding="async" fetchPriority="high" className="z-10 object-cover" /> : <span className="property-building" />}</div><div className="flex flex-col justify-center p-5 sm:p-7"><div className="flex flex-wrap items-center gap-3"><h1 className="text-[28px] font-bold tracking-[-0.04em] text-[var(--text-primary)] sm:text-[32px]">{property.address}</h1><span className="kelvo-status-progress rounded-full px-3 py-1.5 text-[9.5px] font-semibold">{stageLabels[property.stage] ?? property.stage}</span></div><p className="mt-2 text-[12px] text-[var(--text-secondary)]">{property.postalCode} {property.municipality}</p><dl className="mt-6 grid gap-4 border-t border-black/[0.06] pt-5 sm:grid-cols-3"><div><dt className="text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Ásett verð</dt><dd className="mt-1.5 text-[13px] font-semibold text-[var(--text-primary)]">{property.askingPriceIsk === null ? "Ekki skráð" : formatIsk(property.askingPriceIsk)}</dd></div><div><dt className="text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Seljandi</dt><dd className="mt-1.5 truncate text-[12px] text-[#3f463f]">{property.sellers.join(", ") || "Ekki skráður"}</dd></div><div><dt className="text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Umsjón</dt><dd className="mt-1.5 truncate text-[12px] text-[#3f463f]">{property.agent}{property.agentTitle ? ` · ${property.agentTitle}` : ""}</dd></div></dl></div></header>
    <TransactionLifecycle currentStage={property.stage} />
    <nav className="mt-5 overflow-x-auto rounded-[14px] border border-black/[0.06] bg-white p-1.5" aria-label="Vinnusvæði eignar"><div className="flex min-w-max gap-1">{tabs.map((item) => <button key={item} onClick={() => selectTab(item)} aria-current={tab === item ? "page" : undefined} className={`mo-tab h-10 rounded-[10px] px-4 text-[10.5px] font-semibold ${tab === item ? "bg-[var(--surface-accent)] text-[#34432f]" : "text-[var(--text-secondary)]"}`}>{item}</button>)}</div></nav>
    {tab === "Yfirlit" && <div className="py-6"><div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><section className="kelvo-card p-5 sm:p-6"><h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Staða viðskipta</h2><dl className="mt-4 grid grid-cols-2 border-t border-black/[0.06] sm:grid-cols-3">{facts.map(([label,value]) => <div key={label} className="border-b border-black/[0.06] py-4"><dt className="text-[9.5px] text-[var(--text-muted)]">{label}</dt><dd className="mt-2 text-[12px] font-semibold text-[#343934]">{value}</dd></div>)}</dl></section><aside className="kelvo-card p-5 sm:p-6"><h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Næstu atriði</h2><div className="mt-4 border-t border-black/[0.06]"><p className="border-b border-black/[0.06] py-4 text-[12px] text-[#4f5650]">{property.tasks.find((task) => !["completed","cancelled"].includes(task.status))?.title ?? "Engin opin verkefni"}</p><p className="border-b border-black/[0.06] py-4 text-[12px] text-[#4f5650]">{property.viewings.find((viewing) => viewing.status === "scheduled") ? "Næsta skoðun er skráð" : "Engin næsta skoðun skráð"}</p></div></aside></div>
      {property.stage === "contract" && acceptedOffer && <TransactionChecklist property={property} acceptedOffer={acceptedOffer} titles={contractTaskTitles} heading="Undirbúningur kaupsamnings" eyebrow="Samningsferli" isContractPreparation canConfirmSigning={canEditListing} />}
      {property.stage === "closing" && acceptedOffer && <TransactionChecklist property={property} acceptedOffer={acceptedOffer} titles={closingTaskTitles} heading="Frágangur viðskipta" eyebrow="Frágangur" />}
    </div>}
    {tab === "Skráning" && <ListingPreparation property={property} canEdit={canEditListing} />}
    {tab === "Skoðanir" && <ListSection title="Skoðanir" empty="Engar skoðanir hafa verið skráðar." count={property.viewings.length}>{property.viewings.map((viewing) => <Link key={viewing.id} href={`/properties/${property.slug}/viewings/${viewing.id}`} className="mo-hover-row flex min-h-16 items-center justify-between rounded-[10px] border-b border-black/[0.06] px-2 py-3"><div><p className="text-[12px] font-semibold text-[var(--text-primary)]">{viewing.type === "open_house" ? "Opið hús" : "Skoðun"}</p><p className="mt-1 text-[10.5px] text-[var(--text-secondary)]">{formatIcelandicDate(viewing.startsAt)} · {formatIcelandicTime(viewing.startsAt)}–{formatIcelandicTime(viewing.endsAt)}</p></div><ChevronRight size={15} className="text-[var(--text-muted)]" /></Link>)}</ListSection>}
    {tab === "Tilboð" && <ListSection title="Tilboð" empty="Engin tilboð hafa borist." count={property.offers.length}>{property.offers.map((offer) => { const validity = formatOfferValidity(offer.validUntil, nowIso); return <Link key={offer.id} href={`/properties/${property.slug}/offers/${offer.id}`} className="mo-hover-row flex min-h-16 items-center justify-between rounded-[10px] border-b border-black/[0.06] px-2 py-3"><div><p className="text-[13px] font-semibold text-[var(--text-primary)]">{formatIsk(offer.amountIsk)}</p><p className={`mt-1 text-[10.5px] ${validity.expired && offer.status !== "accepted" ? "text-[#914b45]" : "text-[var(--text-secondary)]"}`}>{offer.status === "accepted" ? "Tilboð samþykkt · samningsundirbúningur hafinn" : `${customerOfferStatusLabel(offer.status)} · ${validity.label.toLocaleLowerCase("is-IS")}`}</p></div><ChevronRight size={15} className="text-[var(--text-muted)]" /></Link>; })}</ListSection>}
    {tab === "Verkefni" && <ListSection title="Verkefni" empty="Engin verkefni skráð." count={property.tasks.length}>{property.tasks.map((task) => <div key={task.id} className="flex min-h-16 items-center justify-between border-b border-black/[0.06] py-3"><div><p className="text-[12px] font-medium text-[var(--text-primary)]">{task.title}</p><p className="mt-1 text-[10.5px] text-[var(--text-secondary)]">{task.assignee ?? "Óúthlutað"}</p></div><span className="kelvo-status-neutral rounded-full px-2.5 py-1 text-[9px]">{taskStatusLabel(task.status)}</span></div>)}</ListSection>}
    {tab === "Skjöl" && <ListSection title="Skjöl" empty="Engin skjöl skráð." count={property.documents.length}>{property.documents.map((document) => <div key={document.id} className="flex min-h-16 items-center gap-3 border-b border-black/[0.06] py-3"><FileText size={14} className="text-[#60765d]" /><div className="flex-1"><p className="text-[12px] font-medium text-[var(--text-primary)]">{document.title}</p><p className="mt-1 text-[10.5px] text-[var(--text-secondary)]">{documentCategoryLabel(document.documentType)} · {documentFormatLabel(document.mimeType, document.fileName)}</p></div><span className="kelvo-status-neutral rounded-full px-2.5 py-1 text-[9px]">{documentVisibilityLabel(document.visibility)}</span></div>)}</ListSection>}
    {tab === "Virkni" && <ListSection title="Nýleg virkni" empty="Engin virkni skráð." count={property.activities.length}>{property.activities.map((activity) => <div key={activity.id} className="border-b border-black/[0.06] py-4"><p className="text-[12px] text-[#3f463f]">{activity.summary}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{formatIcelandicDate(activity.createdAt)} · {formatIcelandicTime(activity.createdAt)}</p></div>)}</ListSection>}
    <PropertyImageManager key={property.propertyId} organizationId={organizationId} propertyId={property.propertyId} images={property.images} canEdit={canEdit} />
  </>;
}

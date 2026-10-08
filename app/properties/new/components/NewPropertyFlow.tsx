"use client";

import { Check, ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/app/components/ui/Button";
import { Checkbox } from "@/app/components/ui/Checkbox";
import { Input } from "@/app/components/ui/Input";
import { Panel } from "@/app/components/ui/Panel";
import { Select } from "@/app/components/ui/Select";
import { setupChecklistLabels, type SetupStatus } from "@/app/data/properties-index";
import { createPropertyTransaction } from "../actions";

const steps = ["Seljandi", "Eign", "Verðmat", "Uppsetning", "Yfirferð"];
const setupStatusOptions: Array<{ value: SetupStatus; label: string }> = [
  { value: "not-started", label: "Ekki hafið" },
  { value: "in-progress", label: "Í vinnslu" },
  { value: "complete", label: "Lokið" },
];

type SellerForm = { name: string; idNumber: string; phone: string; email: string };
type PropertyForm = { address: string; postcode: string; municipality: string; propertyNumber: string; size: string; rooms: string; bedrooms: string; year: string };
type ValuationForm = { marketValue: string; salePrice: string; commission: string; completed: boolean; notes: string };

function FlowSteps({ currentStep }: { currentStep: number }) {
  return (
    <div className="overflow-x-auto pb-2" aria-label={`Skref ${currentStep} af ${steps.length}`}>
      <ol className="grid min-w-[620px] grid-cols-5 px-1">
        {steps.map((step, index) => {
          const number = index + 1;
          const isComplete = number < currentStep;
          const isCurrent = number === currentStep;
          return (
            <li key={step} className="relative pt-10 text-center">
              {index > 0 && <span className={`absolute right-1/2 top-[15px] h-px w-1/2 ${isComplete || isCurrent ? "bg-[var(--mint-strong)]" : "bg-black/[0.09]"}`} />}
              {index < steps.length - 1 && <span className={`absolute left-1/2 top-[15px] h-px w-1/2 ${isComplete ? "bg-[var(--mint-strong)]" : "bg-black/[0.09]"}`} />}
              <span className={`absolute left-1/2 top-0 z-10 grid size-8 -translate-x-1/2 place-items-center rounded-full border text-[10px] font-semibold ${isCurrent ? "border-[#c7df4f] bg-[var(--accent)] text-[var(--accent-text)]" : isComplete ? "border-[#bad4c5] bg-[var(--mint)] text-[#365044]" : "border-black/[0.08] bg-[#eef0eb] text-[var(--text-muted)]"}`}>
                {isComplete ? <Check size={13} strokeWidth={2.2} /> : number}
              </span>
              <span className={`text-[11px] ${isCurrent ? "font-semibold text-[var(--text-primary)]" : isComplete ? "font-medium text-[#5f765a]" : "text-[var(--text-muted)]"}`}>{step}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; inputMode?: "text" | "email" | "tel" | "numeric" }) {
  const id = `new-property-${label.toLocaleLowerCase("is-IS").replaceAll(" ", "-")}`;
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} className="mt-2" />
    </div>
  );
}

function StepIntro({ step, title, description }: { step: number; title: string; description: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#607d57]">Skref {step} af 5</p><h2 className="mt-3 text-[24px] font-bold tracking-[-0.035em] text-[var(--text-primary)]">{title}</h2><p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--text-secondary)]">{description}</p></div>;
}

function SellerStep({ seller, setSeller, secondOwner, setSecondOwner, contacts, sellerContactId, setSellerContactId }: { seller: SellerForm; setSeller: (seller: SellerForm) => void; secondOwner: SellerForm | null; setSecondOwner: (seller: SellerForm | null) => void; contacts:Array<{id:string;label:string;email:string|null;phone:string|null}>;sellerContactId:string;setSellerContactId:(value:string)=>void }) {
  return (
    <section aria-labelledby="seller-step-heading">
      <span id="seller-step-heading" className="sr-only">Seljandi</span>
      <StepIntro step={1} title="Seljandi" description="Skráðu tengiliðaupplýsingar eiganda áður en eignin fer í undirbúning." />
      <div className="mt-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Skráður tengiliður</p>
        <div className="mt-3 max-w-md"><label className="mb-2 block text-[11px] font-medium text-[var(--text-secondary)]">Velja skráðan tengilið</label><Select ariaLabel="Velja skráðan seljanda" value={sellerContactId} onChange={(value)=>{setSellerContactId(value);const contact=contacts.find((item)=>item.id===value);if(contact)setSeller({...seller,name:contact.label,email:contact.email??"",phone:contact.phone??""});}} options={[{value:"",label:"Stofna nýjan tengilið"},...contacts.map((item)=>({value:item.id,label:item.label}))]} /></div>
      </div>
      <div className="mt-8 border-t border-black/[0.07] pt-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{sellerContactId ? "Valinn tengiliður" : "Nýr tengiliður"}</p>
        {sellerContactId ? (
          <div className="mt-3 rounded-[14px] border border-black/[0.06] bg-[var(--surface-soft)] px-4 py-3">
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">{seller.name}</p>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{[seller.email, seller.phone].filter(Boolean).join(" · ") || "Engar tengiliðaupplýsingar skráðar"}</p>
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field label="Nafn" value={seller.name} onChange={(name) => setSeller({ ...seller, name })} />
              <Field label="Kennitala" value={seller.idNumber} onChange={(idNumber) => setSeller({ ...seller, idNumber })} inputMode="numeric" />
              <Field label="Sími" value={seller.phone} onChange={(phone) => setSeller({ ...seller, phone })} inputMode="tel" />
              <Field label="Netfang" value={seller.email} onChange={(email) => setSeller({ ...seller, email })} inputMode="email" />
            </div>
            <p className="mt-4 text-[10px] text-[var(--text-muted)]">Kennitala er ekki sannreynd í þessari frumgerð.</p>
          </>
        )}
      </div>

      {secondOwner ? (
        <div className="mt-8 border-t border-black/[0.07] pt-7">
          <div className="flex items-center justify-between"><h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Annar eigandi</h3><Button variant="danger" onClick={() => setSecondOwner(null)} size="compact">Fjarlægja</Button></div>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Field label="Nafn annars eiganda" value={secondOwner.name} onChange={(name) => setSecondOwner({ ...secondOwner, name })} />
            <Field label="Kennitala annars eiganda" value={secondOwner.idNumber} onChange={(idNumber) => setSecondOwner({ ...secondOwner, idNumber })} inputMode="numeric" />
            <Field label="Sími annars eiganda" value={secondOwner.phone} onChange={(phone) => setSecondOwner({ ...secondOwner, phone })} inputMode="tel" />
            <Field label="Netfang annars eiganda" value={secondOwner.email} onChange={(email) => setSecondOwner({ ...secondOwner, email })} inputMode="email" />
          </div>
        </div>
      ) : (
        <Button variant="text" onClick={() => setSecondOwner({ name: "", idNumber: "", phone: "", email: "" })} className="mt-7 min-h-11 text-[12px] font-medium"><Plus size={14} />Bæta við öðrum eiganda</Button>
      )}
    </section>
  );
}

function PropertyStep({ property, setProperty }: { property: PropertyForm; setProperty: (property: PropertyForm) => void }) {
  function populateRegistryData() {
    setProperty({ ...property });
  }
  return (
    <section aria-labelledby="property-step-heading">
      <span id="property-step-heading" className="sr-only">Eign</span>
      <StepIntro step={2} title="Eign" description="Grunnupplýsingar um eignina. Síðar verður hægt að sækja þær sjálfkrafa úr eignaskrá." />
      <Button onClick={populateRegistryData} className="mt-6 min-h-11 px-4 text-[12px] font-medium"><Download size={14} />Sækja upplýsingar um eign</Button>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field label="Heimilisfang" value={property.address} onChange={(address) => setProperty({ ...property, address })} />
        <Field label="Póstnúmer" value={property.postcode} onChange={(postcode) => setProperty({ ...property, postcode })} inputMode="numeric" />
        <Field label="Sveitarfélag" value={property.municipality} onChange={(municipality) => setProperty({ ...property, municipality })} />
        <Field label="Fastanúmer" value={property.propertyNumber} onChange={(propertyNumber) => setProperty({ ...property, propertyNumber })} />
        <Field label="Stærð" value={property.size} onChange={(size) => setProperty({ ...property, size })} />
        <Field label="Fjöldi herbergja" value={property.rooms} onChange={(rooms) => setProperty({ ...property, rooms })} />
        <Field label="Svefnherbergi" value={property.bedrooms} onChange={(bedrooms) => setProperty({ ...property, bedrooms })} inputMode="numeric" />
        <Field label="Byggingarár" value={property.year} onChange={(year) => setProperty({ ...property, year })} inputMode="numeric" />
      </div>
    </section>
  );
}

function ValuationStep({ valuation, setValuation }: { valuation: ValuationForm; setValuation: (valuation: ValuationForm) => void }) {
  return (
    <section aria-labelledby="valuation-step-heading">
      <span id="valuation-step-heading" className="sr-only">Verðmat</span>
      <StepIntro step={3} title="Verðmat" description="Skráðu verðforsendur og stutta samantekt úr verðmati eignarinnar." />
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field label="Áætlað markaðsvirði" value={valuation.marketValue} onChange={(marketValue) => setValuation({ ...valuation, marketValue })} />
        <Field label="Áætlað söluverð" value={valuation.salePrice} onChange={(salePrice) => setValuation({ ...valuation, salePrice })} />
        <Field label="Söluþóknun" value={valuation.commission} onChange={(commission) => setValuation({ ...valuation, commission })} />
      </div>
      <Checkbox checked={valuation.completed} onChange={(completed) => setValuation({ ...valuation, completed })} label="Verðmat hefur verið framkvæmt" className="mt-7 min-h-12 rounded-[12px] border border-black/[0.07] bg-[var(--surface-soft)] px-4 py-3 text-[13px] text-[var(--text-primary)]" />
      <div className="mt-7"><label htmlFor="valuation-notes" className="text-[11px] font-medium text-[var(--text-secondary)]">Glósur úr verðmati</label><textarea id="valuation-notes" value={valuation.notes} onChange={(event) => setValuation({ ...valuation, notes: event.target.value })} rows={4} placeholder="Valfrjálst" className="mo-control mt-2 min-h-28 w-full resize-none px-4 py-3 text-base leading-6" /></div>
    </section>
  );
}

function SetupStep({ checklist, setChecklist, agentName }: { checklist: Record<string, SetupStatus>; setChecklist: (checklist: Record<string, SetupStatus>) => void; agentName: string }) {
  return (
    <section aria-labelledby="setup-step-heading">
      <span id="setup-step-heading" className="sr-only">Uppsetning sölu</span>
      <StepIntro step={4} title="Uppsetning sölu" description="Skipuleggðu fyrstu verkefnin áður en eignin verður tilbúin til birtingar." />
      <dl className="mt-7 grid grid-cols-2 gap-6 border-y border-black/[0.07] py-5">
        <div><dt className="text-[10px] text-[var(--text-muted)]">Ábyrgur fasteignasali</dt><dd className="mt-1.5 text-[13px] font-medium text-[var(--text-primary)]">{agentName}</dd></div>
        <div><dt className="text-[10px] text-[var(--text-muted)]">Fyrirhuguð staða</dt><dd className="mt-1.5 text-[13px] font-medium text-[#5f765a]">Undirbúningur</dd></div>
      </dl>
      <div className="mt-7 divide-y divide-black/[0.06] border-t border-black/[0.06]">
        {setupChecklistLabels.map((item) => (
          <div key={item} className="grid gap-2 py-3 sm:grid-cols-[1fr_190px] sm:items-center">
            <span className="text-[13px] text-[var(--text-primary)]">{item}</span>
            <Select id={`setup-${item}`} ariaLabel={`Staða fyrir ${item}`} value={checklist[item]} onChange={(value) => setChecklist({ ...checklist, [item]: value as SetupStatus })} options={setupStatusOptions} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ReviewStep({ seller, property, valuation, checklist, agentName }: { seller: SellerForm; property: PropertyForm; valuation: ValuationForm; checklist: Record<string, SetupStatus>; agentName: string }) {
  const statusLabel = (status: SetupStatus) => setupStatusOptions.find((option) => option.value === status)?.label;
  return (
    <section aria-labelledby="review-step-heading">
      <span id="review-step-heading" className="sr-only">Yfirferð</span>
      <StepIntro step={5} title="Yfirferð" description="Farðu yfir upplýsingarnar áður en eignin er stofnuð í undirbúningi." />
      <dl className="mt-7 divide-y divide-black/[0.06] border-y border-black/[0.06]">
        {[
          ["Seljandi", seller.name],
          ["Eign", `${property.address}, ${property.postcode} ${property.municipality}`],
          ["Áætlað söluverð", valuation.salePrice],
          ["Fasteignasali", agentName],
          ["Staða við stofnun", "Undirbúningur"],
        ].map(([label, value]) => <div key={label} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr]"><dt className="text-[11px] text-[var(--text-muted)]">{label}</dt><dd className="text-[13px] font-medium text-[var(--text-primary)]">{value}</dd></div>)}
      </dl>
      <div className="mt-8"><h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Undirbúningsverkefni</h3><ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">{setupChecklistLabels.map((item) => <li key={item} className="flex items-center justify-between gap-4 border-b border-black/[0.06] pb-3 text-[11px]"><span className="text-[var(--text-secondary)]">{item}</span><span className={checklist[item] === "complete" ? "text-[#5f765a]" : checklist[item] === "in-progress" ? "text-[var(--warning)]" : "text-[var(--text-muted)]"}>{statusLabel(checklist[item])}</span></li>)}</ul></div>
      <p className="mt-8 rounded-r-[12px] border-l-2 border-[#91aa73] bg-[var(--surface-soft)] px-4 py-3 text-[12px] leading-5 text-[var(--text-secondary)]">Eignin verður stofnuð í undirbúningi og næstu verkefni birtast í vinnusvæði eignarinnar.</p>
    </section>
  );
}

export function NewPropertyFlow({ agentName, contacts, agents, currentAgentId }: { agentName: string; contacts:Array<{id:string;label:string;email:string|null;phone:string|null}>;agents:Array<{id:string;label:string}>;currentAgentId:string }) {
  const router = useRouter();
  const [isCreating, startCreating] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [seller, setSeller] = useState<SellerForm>({ name: "", idNumber: "", phone: "", email: "" });
  const [sellerContactId,setSellerContactId]=useState("");
  const [assignedAgentId,setAssignedAgentId]=useState(currentAgentId);
  const [initialStage,setInitialStage]=useState<"valuation"|"preparation">("preparation");
  const [secondOwner, setSecondOwner] = useState<SellerForm | null>(null);
  const [property, setProperty] = useState<PropertyForm>({ address: "", postcode: "", municipality: "", propertyNumber: "", size: "", rooms: "", bedrooms: "", year: "" });
  const [valuation, setValuation] = useState<ValuationForm>({ marketValue: "86.000.000 kr.", salePrice: "84.900.000 kr.", commission: "1,75%", completed: true, notes: "" });
  const initialChecklist = useMemo(() => Object.fromEntries(setupChecklistLabels.map((item, index) => [item, index < 2 ? "in-progress" : "not-started"])) as Record<string, SetupStatus>, []);
  const [checklist, setChecklist] = useState(initialChecklist);

  function submitProperty() {
    setCreateError(null);
    startCreating(async () => {
      const result = await createPropertyTransaction({
        sellerContactId: sellerContactId || null,
        assignedAgentId,
        initialStage,
        seller: { name: seller.name, phone: seller.phone, email: seller.email },
        coOwner: secondOwner ? { name: secondOwner.name, phone: secondOwner.phone, email: secondOwner.email } : null,
        property,
        salePrice: valuation.salePrice,
      });

      if (!result.ok) {
        setCreateError(result.error);
        return;
      }

      router.push(`/properties/${result.propertySlug}?created=1`);
    });
  }

  return (
    <div className="mx-auto w-full max-w-[880px]">
      <Link href="/properties" className="mo-button mo-button-text min-h-11 gap-1.5 text-[11px] font-medium"><ChevronLeft size={14} />Fasteignir</Link>
      <header className="mt-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#607d57]">Ný viðskipti</p><h1 className="mt-3 text-[30px] font-bold tracking-[-0.04em] text-[var(--text-primary)] sm:text-[34px]">Stofna nýja eign</h1><p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">Byrjaðu ferlið með seljanda, eign og verðmati.</p></header>
      <div className="mt-8"><FlowSteps currentStep={currentStep} /></div>

      <Panel padding="none" className="mt-5 overflow-visible">
        <div className="p-5 sm:p-8">
          {currentStep === 1 && <SellerStep seller={seller} setSeller={setSeller} secondOwner={secondOwner} setSecondOwner={setSecondOwner} contacts={contacts} sellerContactId={sellerContactId} setSellerContactId={setSellerContactId} />}
          {currentStep === 2 && <PropertyStep property={property} setProperty={setProperty} />}
          {currentStep === 3 && <ValuationStep valuation={valuation} setValuation={setValuation} />}
          {currentStep === 4 && <><div className="mb-7 grid gap-5 sm:grid-cols-2"><div><label className="mb-2 block text-[11px] font-medium text-[var(--text-secondary)]">Ábyrgur fasteignasali</label><Select ariaLabel="Ábyrgur fasteignasali" value={assignedAgentId} onChange={setAssignedAgentId} options={agents.map((agent)=>({value:agent.id,label:agent.label}))}/></div><div><label className="mb-2 block text-[11px] font-medium text-[var(--text-secondary)]">Upphafsstaða</label><Select ariaLabel="Upphafsstaða" value={initialStage} onChange={(value)=>setInitialStage(value as "valuation"|"preparation")} options={[{value:"valuation",label:"Verðmat"},{value:"preparation",label:"Undirbúningur"}]}/></div></div><SetupStep checklist={checklist} setChecklist={setChecklist} agentName={agents.find((agent)=>agent.id===assignedAgentId)?.label??agentName} /></>}
          {currentStep === 5 && <ReviewStep seller={seller} property={property} valuation={valuation} checklist={checklist} agentName={agents.find((agent)=>agent.id===assignedAgentId)?.label??agentName} />}
          {createError && <p role="alert" className="mt-7 rounded-[12px] border border-[#b75e56]/20 bg-[#fffafa] px-4 py-3 text-[12px] text-[#a24f48]">{createError}</p>}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-black/[0.07] bg-[#fbfcf9] px-5 py-4 sm:flex-row sm:justify-end sm:rounded-b-[18px] sm:px-8">
          {currentStep > 1 && <Button onClick={() => setCurrentStep((step) => step - 1)} className="w-full text-base font-medium sm:w-auto"><ChevronLeft size={15} />Til baka</Button>}
          {currentStep < 5 ? <Button variant="primary" onClick={() => setCurrentStep((step) => step + 1)} className="w-full text-base font-semibold sm:w-auto">Halda áfram<ChevronRight size={15} /></Button> : <Button variant="primary" onClick={submitProperty} disabled={isCreating} className="w-full text-base font-semibold sm:w-auto">{isCreating ? "Stofna eign…" : "Stofna eign"}</Button>}
        </div>
      </Panel>
    </div>
  );
}

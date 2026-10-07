"use client";

import { Check, ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/app/components/ui/Button";
import { Checkbox } from "@/app/components/ui/Checkbox";
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
      <ol className="grid min-w-[660px] grid-cols-5">
        {steps.map((step, index) => {
          const number = index + 1;
          const isComplete = number < currentStep;
          const isCurrent = number === currentStep;
          return (
            <li key={step} className="relative pt-6">
              <span className={`absolute left-0 right-0 top-[8px] h-px ${isCurrent ? "bg-[#9caf9a]" : isComplete ? "bg-[#59655b]" : "bg-white/[0.08]"}`} />
              <span className={`absolute left-0 top-0 grid size-4 place-items-center rounded-full border text-[8px] ${isCurrent ? "border-[#9caf9a] bg-[#9caf9a] text-[#121512]" : isComplete ? "border-[#687569] bg-[#283029] text-[#aab6a7]" : "border-[#3c433d] bg-[#111412] text-[#59615b]"}`}>
                {isComplete ? <Check size={9} strokeWidth={2.2} /> : number}
              </span>
              <span className={`text-[11px] ${isCurrent ? "font-semibold text-[#c2cebf]" : isComplete ? "text-[#89928b]" : "text-[#555d57]"}`}>{step}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; inputMode?: "text" | "email" | "tel" | "numeric" }) {
  const id = `new-property-${label.toLocaleLowerCase("is").replaceAll(" ", "-")}`;
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-medium text-[#8c948e]">{label}</label>
      <input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} className="mt-2 min-h-11 w-full rounded-[8px] border border-white/[0.08] bg-[#191d1a] px-3 text-base text-[#dedfd8] outline-none placeholder:text-[#59615b] focus:border-[#6f846f]/60" />
    </div>
  );
}

function StepIntro({ step, title, description }: { step: number; title: string; description: string }) {
  return <div><p className="text-[10px] font-medium uppercase tracking-[0.11em] text-[#758675]">Skref {step} af 5</p><h2 className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-[#efede6]">{title}</h2><p className="mt-2 text-[12px] leading-5 text-[#737b75]">{description}</p></div>;
}

function SellerStep({ seller, setSeller, secondOwner, setSecondOwner, contacts, sellerContactId, setSellerContactId }: { seller: SellerForm; setSeller: (seller: SellerForm) => void; secondOwner: SellerForm | null; setSecondOwner: (seller: SellerForm | null) => void; contacts:Array<{id:string;label:string;email:string|null;phone:string|null}>;sellerContactId:string;setSellerContactId:(value:string)=>void }) {
  return (
    <section aria-labelledby="seller-step-heading">
      <span id="seller-step-heading" className="sr-only">Seljandi</span>
      <StepIntro step={1} title="Seljandi" description="Skráðu tengiliðaupplýsingar eiganda áður en eignin fer í undirbúning." />
      <div className="mt-7 max-w-md"><label className="mb-2 block text-[11px] font-medium text-[#8c948e]">Velja skráðan tengilið</label><Select ariaLabel="Velja skráðan seljanda" value={sellerContactId} onChange={(value)=>{setSellerContactId(value);const contact=contacts.find((item)=>item.id===value);if(contact)setSeller({...seller,name:contact.label,email:contact.email??"",phone:contact.phone??""});}} options={[{value:"",label:"Stofna nýjan tengilið"},...contacts.map((item)=>({value:item.id,label:item.label}))]} /></div>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field label="Nafn" value={seller.name} onChange={(name) => setSeller({ ...seller, name })} />
        <Field label="Kennitala" value={seller.idNumber} onChange={(idNumber) => setSeller({ ...seller, idNumber })} inputMode="numeric" />
        <Field label="Sími" value={seller.phone} onChange={(phone) => setSeller({ ...seller, phone })} inputMode="tel" />
        <Field label="Netfang" value={seller.email} onChange={(email) => setSeller({ ...seller, email })} inputMode="email" />
      </div>
      <p className="mt-4 text-[10px] text-[#606861]">Kennitala er ekki sannreynd í þessari frumgerð.</p>

      {secondOwner ? (
        <div className="mt-8 border-t border-white/[0.07] pt-7">
          <div className="flex items-center justify-between"><h3 className="text-[14px] font-semibold text-[#d8d8d1]">Annar eigandi</h3><Button variant="danger" onClick={() => setSecondOwner(null)} className="min-h-11 border-transparent px-2 text-[11px]">Fjarlægja</Button></div>
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
      <Checkbox checked={valuation.completed} onChange={(completed) => setValuation({ ...valuation, completed })} label="Verðmat hefur verið framkvæmt" className="mt-7 min-h-12 border-y border-white/[0.07] py-3 text-[13px] text-[#aeb3ad]" />
      <div className="mt-7"><label htmlFor="valuation-notes" className="text-[11px] font-medium text-[#8c948e]">Glósur úr verðmati</label><textarea id="valuation-notes" value={valuation.notes} onChange={(event) => setValuation({ ...valuation, notes: event.target.value })} rows={4} placeholder="Valfrjálst" className="mt-2 w-full resize-none rounded-[8px] border border-white/[0.08] bg-[#191d1a] p-3 text-base leading-6 text-[#dedfd8] outline-none placeholder:text-[#59615b] focus:border-[#6f846f]/60" /></div>
    </section>
  );
}

function SetupStep({ checklist, setChecklist, agentName }: { checklist: Record<string, SetupStatus>; setChecklist: (checklist: Record<string, SetupStatus>) => void; agentName: string }) {
  return (
    <section aria-labelledby="setup-step-heading">
      <span id="setup-step-heading" className="sr-only">Uppsetning sölu</span>
      <StepIntro step={4} title="Uppsetning sölu" description="Skipuleggðu fyrstu verkefnin áður en eignin verður tilbúin til birtingar." />
      <dl className="mt-7 grid grid-cols-2 gap-6 border-y border-white/[0.07] py-5">
        <div><dt className="text-[10px] text-[#69716b]">Ábyrgur fasteignasali</dt><dd className="mt-1.5 text-[13px] font-medium text-[#c8c9c2]">{agentName}</dd></div>
        <div><dt className="text-[10px] text-[#69716b]">Fyrirhuguð staða</dt><dd className="mt-1.5 text-[13px] font-medium text-[#a9b8a7]">Undirbúningur</dd></div>
      </dl>
      <div className="mt-7 divide-y divide-white/[0.07] border-t border-white/[0.07]">
        {setupChecklistLabels.map((item) => (
          <div key={item} className="grid gap-2 py-3 sm:grid-cols-[1fr_190px] sm:items-center">
            <span className="text-[13px] text-[#adb2ac]">{item}</span>
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
      <dl className="mt-7 divide-y divide-white/[0.07] border-y border-white/[0.07]">
        {[
          ["Seljandi", seller.name],
          ["Eign", `${property.address}, ${property.postcode} ${property.municipality}`],
          ["Áætlað söluverð", valuation.salePrice],
          ["Fasteignasali", agentName],
          ["Staða við stofnun", "Undirbúningur"],
        ].map(([label, value]) => <div key={label} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr]"><dt className="text-[11px] text-[#69716b]">{label}</dt><dd className="text-[13px] font-medium text-[#c9cbc4]">{value}</dd></div>)}
      </dl>
      <div className="mt-8"><h3 className="text-[13px] font-semibold text-[#dcdbd4]">Undirbúningsverkefni</h3><ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">{setupChecklistLabels.map((item) => <li key={item} className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3 text-[11px]"><span className="text-[#939a94]">{item}</span><span className={checklist[item] === "complete" ? "text-[#9caf9a]" : checklist[item] === "in-progress" ? "text-[#c0a16f]" : "text-[#616963]"}>{statusLabel(checklist[item])}</span></li>)}</ul></div>
      <p className="mt-8 border-l-2 border-[#6f846f] pl-4 text-[12px] leading-5 text-[#8d958f]">Eignin verður stofnuð í undirbúningi og næstu verkefni birtast í vinnusvæði eignarinnar.</p>
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
    <>
      <Link href="/properties" className="mo-button mo-button-text min-h-11 gap-1.5 text-[11px] font-medium"><ChevronLeft size={14} />Fasteignir</Link>
      <header className="mt-3 border-b border-white/[0.07] pb-7"><p className="text-[9.5px] font-medium uppercase tracking-[0.13em] text-[#6f846f]">Ný viðskipti</p><h1 className="mt-3 text-[27px] font-semibold tracking-[-0.035em] text-[#f1efe8]">Stofna nýja eign</h1><p className="mt-2 text-[12px] text-[#747c76]">Byrjaðu ferlið með seljanda, eign og verðmati.</p></header>
      <div className="mt-7"><FlowSteps currentStep={currentStep} /></div>

      <div className="mt-10 max-w-3xl">
        {currentStep === 1 && <SellerStep seller={seller} setSeller={setSeller} secondOwner={secondOwner} setSecondOwner={setSecondOwner} contacts={contacts} sellerContactId={sellerContactId} setSellerContactId={setSellerContactId} />}
        {currentStep === 2 && <PropertyStep property={property} setProperty={setProperty} />}
        {currentStep === 3 && <ValuationStep valuation={valuation} setValuation={setValuation} />}
        {currentStep === 4 && <><div className="mb-7 grid gap-5 sm:grid-cols-2"><div><label className="mb-2 block text-[11px] text-[#8c948e]">Ábyrgur fasteignasali</label><Select ariaLabel="Ábyrgur fasteignasali" value={assignedAgentId} onChange={setAssignedAgentId} options={agents.map((agent)=>({value:agent.id,label:agent.label}))}/></div><div><label className="mb-2 block text-[11px] text-[#8c948e]">Upphafsstaða</label><Select ariaLabel="Upphafsstaða" value={initialStage} onChange={(value)=>setInitialStage(value as "valuation"|"preparation")} options={[{value:"valuation",label:"Verðmat"},{value:"preparation",label:"Undirbúningur"}]}/></div></div><SetupStep checklist={checklist} setChecklist={setChecklist} agentName={agents.find((agent)=>agent.id===assignedAgentId)?.label??agentName} /></>}
        {currentStep === 5 && <ReviewStep seller={seller} property={property} valuation={valuation} checklist={checklist} agentName={agents.find((agent)=>agent.id===assignedAgentId)?.label??agentName} />}
      </div>

      {createError && <p role="alert" className="mt-7 max-w-3xl border-y border-[#c8665b]/25 py-4 text-[12px] text-[#c99088]">{createError}</p>}

      <div className="sticky bottom-0 z-10 -mx-4 mt-10 flex gap-3 border-t border-white/[0.08] bg-[#111412] px-4 py-4 sm:static sm:mx-0 sm:max-w-3xl sm:justify-end sm:bg-transparent sm:px-0">
        {currentStep > 1 && <Button onClick={() => setCurrentStep((step) => step - 1)} className="min-h-11 flex-1 px-4 text-base font-medium sm:flex-none"><ChevronLeft size={15} />Til baka</Button>}
        {currentStep < 5 ? <Button variant="primary" onClick={() => setCurrentStep((step) => step + 1)} className="min-h-11 flex-1 px-5 text-base font-semibold sm:flex-none">Halda áfram<ChevronRight size={15} /></Button> : <Button variant="primary" onClick={submitProperty} disabled={isCreating} className="min-h-11 flex-1 px-5 text-base font-semibold sm:flex-none">{isCreating ? "Stofna eign…" : "Stofna eign"}</Button>}
      </div>
    </>
  );
}

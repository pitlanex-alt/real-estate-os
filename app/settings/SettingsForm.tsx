"use client";

import { Camera } from "lucide-react";
import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Avatar } from "@/app/components/ui/Avatar";
import { Button } from "@/app/components/ui/Button";
import { FileUpload } from "@/app/components/ui/FileUpload";
import { Input } from "@/app/components/ui/Input";
import { Panel } from "@/app/components/ui/Panel";
import { saveProfile, saveSettings, type SettingsState } from "./actions";
import { ProfilePhotoEditor } from "./ProfilePhotoEditor";

type Values = Record<string, string | null>;

function Field({ name, label, value, type = "text" }: { name: string; label: string; value: string | null; type?: string }) {
  return <label className="block text-[11px] font-medium text-[var(--text-secondary)]">{label}<Input name={name} type={type} defaultValue={value ?? ""} className="mt-2" /></label>;
}

function Message({ state }: { state: SettingsState }) {
  return <>{state.error && <p role="alert" className="text-[12px] text-[#a24f48]">{state.error}</p>}{state.success && <p className="text-[12px] text-[#58704f]">{state.success}</p>}</>;
}

function ProfilePhotoControl({ name, currentPhotoUrl, currentEditorUrl, disabled }: { name: string; currentPhotoUrl: string | null; currentEditorUrl: string | null; disabled: boolean }) {
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const submissionInputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState(currentPhotoUrl);
  const [editorSource, setEditorSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  function selectSource(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Veldu JPG, PNG eða WebP mynd sem er mest 5 MB.");
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    setEditorSource(url);
  }

  function acceptCrop(file: File) {
    if (!submissionInputRef.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    submissionInputRef.current.files = transfer.files;
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    setPreviewUrl(url);
    setEditorSource(null);
    setError(null);
  }

  return (
    <div className="sm:col-span-2">
      <p className="text-[11px] font-medium text-[var(--text-secondary)]">Prófílmynd</p>
      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-[16px] border border-black/[0.06] bg-[var(--surface-soft)] p-4">
        <Avatar name={name || "Notandi"} photoUrl={previewUrl} size="large" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-[var(--text-primary)]">Myndin birtist í hringlaga avatar</p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">Veldu mynd og stilltu staðsetningu og aðdrátt áður en þú vistar prófílinn.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {previewUrl && <Button size="compact" variant="secondary" disabled={disabled} onClick={() => setEditorSource(previewUrl === currentPhotoUrl ? currentEditorUrl ?? previewUrl : previewUrl)}><Camera size={14} />Breyta mynd</Button>}
            <Button size="compact" variant="secondary" disabled={disabled} onClick={() => sourceInputRef.current?.click()}>{previewUrl ? "Velja aðra mynd" : "Velja mynd"}</Button>
          </div>
          {error && <p role="alert" className="mt-2 text-[11px] text-[#a24f48]">{error}</p>}
        </div>
      </div>
      <input ref={sourceInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectSource} className="sr-only" tabIndex={-1} />
      <input ref={submissionInputRef} name="profilePhoto" type="file" accept="image/webp" className="sr-only" tabIndex={-1} />
      {editorSource && <ProfilePhotoEditor key={editorSource} source={editorSource} onCancel={() => setEditorSource(null)} onSave={acceptCrop} />}
    </div>
  );
}

export function SettingsForm({ values, canEditOrganization }: { values: Values; canEditOrganization: boolean }) {
  const [organizationState, organizationAction, organizationPending] = useActionState(saveSettings, { error: null, success: null } satisfies SettingsState);
  const [profileState, profileAction, profilePending] = useActionState(saveProfile, { error: null, success: null } satisfies SettingsState);

  return <div className="mt-6 max-w-4xl space-y-6">
    <Panel><form action={organizationAction} className="space-y-8">
      <fieldset disabled={!canEditOrganization || organizationPending} className="space-y-8">
        <section><h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Fasteignasalan</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field name="name" label="Nafn" value={values.name} /><Field name="publicEmail" label="Opinbert netfang" type="email" value={values.publicEmail} /><Field name="phone" label="Sími" value={values.phone} /><Field name="website" label="Vefsíða" value={values.website} /><div className="sm:col-span-2"><Field name="address" label="Heimilisfang" value={values.address} /></div><label className="block text-[11px] font-medium text-[var(--text-secondary)]">Merki<FileUpload name="logo" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="mt-2" /></label></div></section>
        <section className="border-t border-black/[0.06] pt-8"><h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Sjálfgefinn tengiliður</h2><div className="mt-5 grid gap-5 sm:grid-cols-3"><Field name="defaultContactName" label="Nafn" value={values.defaultContactName} /><Field name="defaultContactEmail" label="Netfang" type="email" value={values.defaultContactEmail} /><Field name="defaultContactPhone" label="Sími" value={values.defaultContactPhone} /></div></section>
        <Button type="submit" variant="primary" className="font-semibold">Vista fyrirtæki</Button>
      </fieldset>
      {!canEditOrganization && <p className="text-[12px] text-[#c09b66]">Aðeins stjórnandi getur breytt fyrirtækjastillingum.</p>}
      <Message state={organizationState} />
    </form></Panel>

    <Panel><form action={profileAction}>
      <fieldset disabled={profilePending}>
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Minn prófíll</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2"><Field name="displayName" label="Birtingarnafn" value={values.displayName} /><Field name="professionalTitle" label="Starfsheiti" value={values.professionalTitle} /><Field name="profilePhone" label="Sími" value={values.profilePhone} /><Field name="profileEmail" label="Netfang" type="email" value={values.profileEmail} /><ProfilePhotoControl name={values.displayName ?? "Notandi"} currentPhotoUrl={values.profilePhotoUrl} currentEditorUrl={values.profilePhotoEditorUrl} disabled={profilePending} /></div>
        <Button type="submit" variant="primary" className="mt-6 font-semibold">Vista prófíl</Button>
      </fieldset>
      <div className="mt-4"><Message state={profileState} /></div>
    </form></Panel>
  </div>;
}

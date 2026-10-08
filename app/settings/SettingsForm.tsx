"use client";

import { useActionState } from "react";
import { Button } from "@/app/components/ui/Button";
import { FileUpload } from "@/app/components/ui/FileUpload";
import { Input } from "@/app/components/ui/Input";
import { Panel } from "@/app/components/ui/Panel";
import { saveProfile, saveSettings, type SettingsState } from "./actions";

type Values = Record<string, string | null>;

function Field({ name, label, value, type = "text" }: { name: string; label: string; value: string | null; type?: string }) {
  return <label className="block text-[11px] font-medium text-[var(--text-secondary)]">{label}<Input name={name} type={type} defaultValue={value ?? ""} className="mt-2" /></label>;
}

function Message({ state }: { state: SettingsState }) {
  return <>{state.error && <p role="alert" className="text-[12px] text-[#a24f48]">{state.error}</p>}{state.success && <p className="text-[12px] text-[#58704f]">{state.success}</p>}</>;
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
        <div className="mt-5 grid gap-5 sm:grid-cols-2"><Field name="displayName" label="Birtingarnafn" value={values.displayName} /><Field name="professionalTitle" label="Starfsheiti" value={values.professionalTitle} /><Field name="profilePhone" label="Sími" value={values.profilePhone} /><Field name="profileEmail" label="Netfang" type="email" value={values.profileEmail} /><label className="block text-[11px] font-medium text-[var(--text-secondary)] sm:col-span-2">Prófílmynd<FileUpload name="profilePhoto" accept="image/jpeg,image/png,image/webp" className="mt-2" /></label></div>
        <Button type="submit" variant="primary" className="mt-6 font-semibold">Vista prófíl</Button>
      </fieldset>
      <div className="mt-4"><Message state={profileState} /></div>
    </form></Panel>
  </div>;
}

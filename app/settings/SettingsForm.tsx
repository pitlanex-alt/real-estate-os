"use client";

import { useActionState } from "react";
import { Button } from "@/app/components/ui/Button";
import { saveProfile, saveSettings, type SettingsState } from "./actions";

type Values = Record<string, string | null>;

function Field({ name, label, value, type = "text" }: { name: string; label: string; value: string | null; type?: string }) {
  return <label className="block text-[11px] text-[#8b938d]">{label}<input name={name} type={type} defaultValue={value ?? ""} className="mo-control mt-2 min-h-11 w-full px-3 text-base outline-none" /></label>;
}

function Message({ state }: { state: SettingsState }) {
  return <>{state.error && <p role="alert" className="text-[12px] text-[#c98279]">{state.error}</p>}{state.success && <p className="text-[12px] text-[#9caf9a]">{state.success}</p>}</>;
}

export function SettingsForm({ values, canEditOrganization }: { values: Values; canEditOrganization: boolean }) {
  const [organizationState, organizationAction, organizationPending] = useActionState(saveSettings, { error: null, success: null } satisfies SettingsState);
  const [profileState, profileAction, profilePending] = useActionState(saveProfile, { error: null, success: null } satisfies SettingsState);

  return <div className="mt-8 max-w-4xl space-y-10">
    <form action={organizationAction} className="space-y-8">
      <fieldset disabled={!canEditOrganization || organizationPending} className="space-y-8">
        <section><h2 className="text-[15px] font-semibold">Fasteignasalan</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field name="name" label="Nafn" value={values.name} /><Field name="publicEmail" label="Opinbert netfang" type="email" value={values.publicEmail} /><Field name="phone" label="Sími" value={values.phone} /><Field name="website" label="Vefsíða" value={values.website} /><div className="sm:col-span-2"><Field name="address" label="Heimilisfang" value={values.address} /></div><label className="block text-[11px] text-[#8b938d]">Merki<input name="logo" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="mt-2 block min-h-11 w-full text-base text-[#8b938d] file:mr-3 file:rounded-[8px] file:border file:border-white/[0.08] file:bg-[#181c19] file:px-3 file:py-2 file:text-[#c1c8bf]" /></label></div></section>
        <section className="border-t border-white/[0.07] pt-8"><h2 className="text-[15px] font-semibold">Sjálfgefinn tengiliður</h2><div className="mt-5 grid gap-5 sm:grid-cols-3"><Field name="defaultContactName" label="Nafn" value={values.defaultContactName} /><Field name="defaultContactEmail" label="Netfang" type="email" value={values.defaultContactEmail} /><Field name="defaultContactPhone" label="Sími" value={values.defaultContactPhone} /></div></section>
        <Button type="submit" variant="primary" className="min-h-11 px-5 text-[13px] font-semibold">Vista fyrirtæki</Button>
      </fieldset>
      {!canEditOrganization && <p className="text-[12px] text-[#c09b66]">Aðeins stjórnandi getur breytt fyrirtækjastillingum.</p>}
      <Message state={organizationState} />
    </form>

    <form action={profileAction} className="border-t border-white/[0.07] pt-8">
      <fieldset disabled={profilePending}>
        <h2 className="text-[15px] font-semibold">Minn prófíll</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2"><Field name="displayName" label="Birtingarnafn" value={values.displayName} /><Field name="professionalTitle" label="Starfsheiti" value={values.professionalTitle} /><Field name="profilePhone" label="Sími" value={values.profilePhone} /><Field name="profileEmail" label="Netfang" type="email" value={values.profileEmail} /><label className="block text-[11px] text-[#8b938d] sm:col-span-2">Prófílmynd<input name="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block min-h-11 w-full text-base text-[#8b938d] file:mr-3 file:rounded-[8px] file:border file:border-white/[0.08] file:bg-[#181c19] file:px-3 file:py-2 file:text-[#c1c8bf]" /></label></div>
        <Button type="submit" variant="primary" className="mt-6 min-h-11 px-5 text-[13px] font-semibold">Vista prófíl</Button>
      </fieldset>
      <div className="mt-4"><Message state={profileState} /></div>
    </form>
  </div>;
}

"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Avatar } from "@/app/components/ui/Avatar";
import { Button } from "@/app/components/ui/Button";
import { FileUpload } from "@/app/components/ui/FileUpload";
import { Input } from "@/app/components/ui/Input";
import { Panel } from "@/app/components/ui/Panel";
import { createClient } from "@/lib/supabase/client";
import { saveProfile, saveSettings, type SettingsState } from "./actions";
import { defaultProfilePhotoCrop, ProfilePhotoEditor, type ProfilePhotoCrop } from "./ProfilePhotoEditor";

type Values = Record<string, string | null>;

function Field({ name, label, value, type = "text" }: { name: string; label: string; value: string | null; type?: string }) {
  return <label className="block text-[11px] font-medium text-[var(--text-secondary)]">{label}<Input name={name} type={type} defaultValue={value ?? ""} className="mt-2" /></label>;
}

function Message({ state }: { state: SettingsState }) {
  return <>{state.error && <p role="alert" className="text-[12px] text-[#a24f48]">{state.error}</p>}{state.success && <p className="text-[12px] text-[#58704f]">{state.success}</p>}</>;
}

type EditorSession = { source: string; sourceFile: File | null; crop: ProfilePhotoCrop };

function ProfilePhotoControl({ name, currentPhotoUrl, currentEditorUrl, initialCrop, organizationId, userId, disabled, savedAt }: {
  name: string;
  currentPhotoUrl: string | null;
  currentEditorUrl: string | null;
  initialCrop: ProfilePhotoCrop;
  organizationId: string;
  userId: string;
  disabled: boolean;
  savedAt?: number;
}) {
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState(currentPhotoUrl);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState(currentEditorUrl);
  const [crop, setCrop] = useState(initialCrop);
  const [editor, setEditor] = useState<EditorSession | null>(null);
  const [uploadedPaths, setUploadedPaths] = useState<{ avatar: string; source: string | null; stagedAt?: number } | null>(null);
  const [uploading, setUploading] = useState(false);
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
    setEditor({ source: url, sourceFile: file, crop: defaultProfilePhotoCrop });
  }

  async function acceptCrop(result: { file: File; crop: ProfilePhotoCrop }) {
    if (!editor) return;
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const uploadId = crypto.randomUUID();
    const basePath = `organizations/${organizationId}/profiles/${userId}/${uploadId}`;
    let sourcePath: string | null = editor.sourceFile
      ? null
      : uploadedPaths && uploadedPaths.stagedAt === savedAt ? uploadedPaths.source : null;
    const avatarPath = `${basePath}/avatar.webp`;
    try {
      if (editor.sourceFile) {
        const extension = editor.sourceFile.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
        sourcePath = `${basePath}/source.${extension}`;
        const sourceUpload = await supabase.storage.from("agency-assets").upload(sourcePath, editor.sourceFile, {
          contentType: editor.sourceFile.type,
          cacheControl: "31536000",
          upsert: false,
        });
        if (sourceUpload.error) throw sourceUpload.error;
      }
      const avatarUpload = await supabase.storage.from("agency-assets").upload(avatarPath, result.file, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
      if (avatarUpload.error) throw avatarUpload.error;

      if (uploadedPaths && uploadedPaths.stagedAt === savedAt) {
        const oldPaths = [uploadedPaths.avatar, uploadedPaths.source]
          .filter((path): path is string => Boolean(path) && path !== sourcePath);
        if (oldPaths.length) await supabase.storage.from("agency-assets").remove(oldPaths);
      }
      const url = URL.createObjectURL(result.file);
      objectUrls.current.push(url);
      setUploadedPaths({ avatar: avatarPath, source: sourcePath, stagedAt: savedAt });
      setPreviewUrl(url);
      setSourcePreviewUrl(editor.source);
      setCrop(result.crop);
      setEditor(null);
    } catch {
      const cleanup = [avatarPath, sourcePath].filter((path): path is string => Boolean(path));
      if (cleanup.length) await supabase.storage.from("agency-assets").remove(cleanup);
      setError("Ekki tókst að vista myndina. Reyndu aftur.");
      throw new Error("Profile photo upload failed");
    } finally {
      setUploading(false);
    }
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
            {previewUrl && <Button size="compact" variant="secondary" disabled={disabled || uploading} onClick={() => setEditor({ source: sourcePreviewUrl ?? previewUrl, sourceFile: null, crop })}><Camera size={14} />Breyta mynd</Button>}
            <Button size="compact" variant="secondary" disabled={disabled || uploading} onClick={() => sourceInputRef.current?.click()}>{uploading ? "Vista mynd…" : previewUrl ? "Velja aðra mynd" : "Velja mynd"}</Button>
          </div>
          {error && <p role="alert" className="mt-2 text-[11px] text-[#a24f48]">{error}</p>}
        </div>
      </div>
      <input ref={sourceInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectSource} className="sr-only" tabIndex={-1} />
      <input type="hidden" name="profilePhotoPath" value={uploadedPaths?.avatar ?? ""} />
      <input type="hidden" name="profilePhotoSourcePath" value={uploadedPaths?.source ?? ""} />
      <input type="hidden" name="profilePhotoCropX" value={uploadedPaths ? crop.x : ""} />
      <input type="hidden" name="profilePhotoCropY" value={uploadedPaths ? crop.y : ""} />
      <input type="hidden" name="profilePhotoCropZoom" value={uploadedPaths ? crop.zoom : ""} />
      {editor && <ProfilePhotoEditor key={editor.source} source={editor.source} initialCrop={editor.crop} onCancel={() => setEditor(null)} onSave={acceptCrop} />}
    </div>
  );
}

export function SettingsForm({ values, canEditOrganization, organizationId, userId }: { values: Values; canEditOrganization: boolean; organizationId: string; userId: string }) {
  const router = useRouter();
  const [organizationState, organizationAction, organizationPending] = useActionState(saveSettings, { error: null, success: null } satisfies SettingsState);
  const [profileState, profileAction, profilePending] = useActionState(saveProfile, { error: null, success: null } satisfies SettingsState);

  useEffect(() => {
    if (profileState.savedAt) router.refresh();
  }, [profileState.savedAt, router]);

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
        <div className="mt-5 grid gap-5 sm:grid-cols-2"><Field name="displayName" label="Birtingarnafn" value={values.displayName} /><Field name="professionalTitle" label="Starfsheiti" value={values.professionalTitle} /><Field name="profilePhone" label="Sími" value={values.profilePhone} /><Field name="profileEmail" label="Netfang" type="email" value={values.profileEmail} /><ProfilePhotoControl name={values.displayName ?? "Notandi"} currentPhotoUrl={values.profilePhotoUrl} currentEditorUrl={values.profilePhotoEditorUrl} initialCrop={{ x: Number(values.profilePhotoCropX ?? 0), y: Number(values.profilePhotoCropY ?? 0), zoom: Number(values.profilePhotoCropZoom ?? 1) }} organizationId={organizationId} userId={userId} disabled={profilePending} savedAt={profileState.savedAt} /></div>
        <Button type="submit" variant="primary" className="mt-6 font-semibold">Vista prófíl</Button>
      </fieldset>
      <div className="mt-4"><Message state={profileState} /></div>
    </form></Panel>
  </div>;
}

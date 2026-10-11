import { AppShell } from "@/app/components/AppShell";
import { requireInternalIdentity } from "@/lib/auth/post-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { profilePhotoUrl } from "@/lib/profile-images/urls";
import { TeamManager, type TeamMember } from "./TeamManager";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("is-IS")).join("");
}

export default async function TeamPage() {
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("user_id,role,is_active,profile:profiles!organization_memberships_user_id_fkey(display_name,email,professional_title,profile_photo_path)")
    .eq("organization_id", identity.organizationId)
    .order("created_at");
  if (error) console.error("Unable to load team", error);

  const admin = createAdminClient();
  const members: TeamMember[] = await Promise.all((data ?? []).flatMap((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return profile ? [{ row, profile }] : [];
  }).map(async ({ row, profile }) => {
    const authResult = await admin.auth.admin.getUserById(row.user_id);
    const authUser = authResult.data.user;
    const isKelvoTeamInvite = authUser?.user_metadata.invite_flow === "kelvo_team_v1";
    const invitePending = Boolean(row.is_active && authUser?.invited_at && (
      isKelvoTeamInvite
        ? !authUser.user_metadata.invite_accepted_at
        : !authUser.last_sign_in_at
    ));
    return {
      userId: row.user_id,
      name: profile.display_name,
      email: profile.email,
      title: profile.professional_title,
      role: row.role as TeamMember["role"],
      active: row.is_active,
      invitePending,
      initials: initials(profile.display_name),
      photoUrl: profile.profile_photo_path ? profilePhotoUrl(row.user_id) : null,
    };
  }));

  return <AppShell activeItem="Teymi" identity={identity}><div className="mx-auto max-w-[1336px] px-4 pb-16 pt-8 sm:px-6 lg:px-10 xl:px-12"><header><h1 className="text-[28px] font-bold tracking-[-0.04em] text-[var(--text-primary)]">Teymi</h1><p className="mt-2 text-[13px] text-[var(--text-secondary)]">Aðgangur, hlutverk og virk staða starfsfólks.</p></header><TeamManager members={members} canEdit={identity.role === "admin"}/></div></AppShell>;
}

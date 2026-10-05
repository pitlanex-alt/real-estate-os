import { redirect } from "next/navigation";
import {
  customerPortalPath,
  getCustomerPortalDestinations,
  type CustomerPortalDestination,
} from "@/lib/portal/customer";
import { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
type OrganizationRole = "admin" | "agent" | "coordinator" | "viewer";

export type InternalIdentity = {
  userId: string;
  organizationId: string;
  displayName: string;
  initials: string;
  role: OrganizationRole;
  roleLabel: string;
};

export type PostAuthPreference = "internal" | "customer";

const roleLabels: Record<OrganizationRole, string> = {
  admin: "Stjórnandi",
  agent: "Fasteignasali",
  coordinator: "Umsjón",
  viewer: "Lesaðgangur",
};

function initials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("is-IS"))
    .join("");
}

function customerDestination(destinations: CustomerPortalDestination[]) {
  if (destinations.length === 1) return customerPortalPath(destinations[0]);
  if (destinations.length > 1) return "/customer/portals";
  return null;
}

export async function resolvePostAuthDestination(
  supabase: ServerSupabaseClient,
  preference: PostAuthPreference,
) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      authenticated: false,
      destination: null,
      internalIdentity: null,
      customerDestinations: [] as CustomerPortalDestination[],
    };
  }

  const [membershipResult, profileResult, portalResult] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("organization_id,role,created_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    getCustomerPortalDestinations(supabase),
  ]);

  const membership = membershipResult.error ? null : membershipResult.data;
  const profile = profileResult.error ? null : profileResult.data;
  const customerDestinations = portalResult.data ?? [];
  const role = membership?.role as OrganizationRole | undefined;
  const displayName = profile?.display_name?.trim() || "Notandi";
  const internalIdentity = membership && role
    ? {
        userId: user.id,
        organizationId: membership.organization_id,
        displayName,
        initials: initials(displayName),
        role,
        roleLabel: roleLabels[role],
      }
    : null;

  const internalDestination = internalIdentity ? "/properties" : null;
  const portalDestination = customerDestination(customerDestinations);
  const destination = preference === "customer"
    ? portalDestination ?? internalDestination ?? "/customer/access-denied"
    : internalDestination ?? portalDestination ?? "/customer/access-denied";

  return {
    authenticated: true,
    destination,
    internalIdentity,
    customerDestinations,
  };
}

export async function requireInternalIdentity(
  supabaseClient?: ServerSupabaseClient,
): Promise<InternalIdentity> {
  const supabase = supabaseClient ?? await createClient();
  const resolution = await resolvePostAuthDestination(supabase, "internal");

  if (!resolution.authenticated) redirect("/login");
  if (!resolution.internalIdentity) {
    redirect(resolution.destination ?? "/customer/access-denied");
  }

  return resolution.internalIdentity;
}

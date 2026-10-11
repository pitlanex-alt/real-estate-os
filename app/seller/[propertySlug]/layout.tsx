import type { ReactNode } from "react";
import { CustomerShell } from "@/app/components/CustomerShell";
import { PortalAccessDenied } from "@/app/components/PortalAccessDenied";
import { customerInitials } from "@/lib/portal/customer";
import { getSellerPortalContext } from "@/lib/portal/context";

export default async function SellerPropertyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ propertySlug: string }>;
}) {
  const { propertySlug } = await params;
  const context = await getSellerPortalContext(propertySlug);
  if (!context) return <PortalAccessDenied />;

  return (
    <CustomerShell
      customerName={context.summary.customer.name}
      customerInitials={customerInitials(context.summary.customer.name)}
      customerRole="Seljandi"
      homeHref={`/seller/${propertySlug}`}
      portalLabel="Seljandagátt"
    >
      {children}
    </CustomerShell>
  );
}

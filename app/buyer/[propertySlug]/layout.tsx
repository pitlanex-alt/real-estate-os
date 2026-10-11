import type { ReactNode } from "react";
import { CustomerShell } from "@/app/components/CustomerShell";
import { PortalAccessDenied } from "@/app/components/PortalAccessDenied";
import { customerInitials } from "@/lib/portal/customer";
import { getBuyerPortalContext } from "@/lib/portal/context";

export default async function BuyerPropertyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ propertySlug: string }>;
}) {
  const { propertySlug } = await params;
  const context = await getBuyerPortalContext(propertySlug);
  if (!context) return <PortalAccessDenied />;

  return (
    <CustomerShell
      customerName={context.summary.customer.name}
      customerInitials={customerInitials(context.summary.customer.name)}
      customerRole="Kaupandi"
      homeHref={`/buyer/${propertySlug}`}
      portalLabel="Kaupendagátt"
    >
      {children}
    </CustomerShell>
  );
}

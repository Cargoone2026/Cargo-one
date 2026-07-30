import React from "react";
import { RequireRole } from "@/components/RequireRole";
import { PortalShell } from "@/components/portal/PortalShell";
import {
  Home,
  PlusCircle,
  Package,
  MessagesSquare,
  User as UserIcon,
  Zap,
} from "lucide-react";

const CUSTOMER_NAV = [
  { label: "Home", href: "/customer", icon: Home },
  { label: "Post Job", href: "/customer/post-job", icon: PlusCircle },
  { label: "ASAP", href: "/customer/asap", icon: Zap },
  { label: "Bookings", href: "/customer/bookings", icon: Package },
  { label: "Messages", href: "/customer/messages", icon: MessagesSquare },
  { label: "Profile", href: "/customer/profile", icon: UserIcon },
];

export function CustomerLayout({ children }) {
  return (
    <RequireRole role="customer">
      <PortalShell role="customer" items={CUSTOMER_NAV}>
        {children}
      </PortalShell>
    </RequireRole>
  );
}

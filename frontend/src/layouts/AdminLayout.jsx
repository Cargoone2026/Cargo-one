import React from "react";
import { RequireRole } from "@/components/RequireRole";
import { PortalShell } from "@/components/portal/PortalShell";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Car,
  Package,
  Wallet,
  Boxes,
  Inbox,
  User as UserIcon,
  Layers,
} from "lucide-react";

const ADMIN_NAV = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Drivers", href: "/admin/drivers", icon: Car },
  { label: "Jobs", href: "/admin/jobs", icon: Package },
  { label: "Bookings", href: "/admin/bookings", icon: Boxes },
  { label: "Catalog", href: "/admin/catalog", icon: Layers },
  { label: "Fee Bands", href: "/admin/deposit-bands", icon: Wallet },
  { label: "Queues", href: "/admin/queues", icon: Inbox },
  { label: "Profile", href: "/admin/profile", icon: UserIcon },
];

export function AdminLayout({ children }) {
  return (
    <RequireRole role="admin">
      <PortalShell role="admin" items={ADMIN_NAV}>
        {children}
      </PortalShell>
    </RequireRole>
  );
}

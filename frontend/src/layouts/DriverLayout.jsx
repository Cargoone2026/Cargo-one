import React from "react";
import { RequireRole } from "@/components/RequireRole";
import { PortalShell } from "@/components/portal/PortalShell";
import {
  Home,
  Compass,
  Package,
  PoundSterling,
  Truck,
  User as UserIcon,
} from "lucide-react";

const DRIVER_NAV = [
  { label: "Home", href: "/driver", icon: Home },
  { label: "Available", href: "/driver/jobs", icon: Compass },
  { label: "My Jobs", href: "/driver/my-jobs", icon: Package },
  { label: "Earnings", href: "/driver/earnings", icon: PoundSterling },
  { label: "Fleet", href: "/driver/fleet", icon: Truck },
  { label: "Profile", href: "/driver/profile", icon: UserIcon },
];

export function DriverLayout({ children }) {
  return (
    <RequireRole role="driver">
      <PortalShell role="driver" items={DRIVER_NAV}>
        {children}
      </PortalShell>
    </RequireRole>
  );
}

import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Globe, LogOut, Package, Settings } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const ROLE_LABEL = { customer: "Customer", driver: "Driver", admin: "Admin" };

export function SideRail({ role, items }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (href) => {
    if (location.pathname === href) return true;
    if (href === `/${role}`) return location.pathname === `/${role}`;
    return location.pathname.startsWith(`${href}/`);
  };

  const doLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <aside
      className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col border-r border-white/10 bg-[#0B0B0F] px-3 py-4"
      data-testid={`side-rail-${role}`}
    >
      <Link to="/" className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-white/5">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#D62828]">
          <Package className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-bold tracking-[1.4px] text-white">CARGO ONE</div>
          <div className="mt-0.5 text-[12px] text-white/55">{ROLE_LABEL[role]} portal</div>
        </div>
      </Link>

      <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              data-testid={`side-rail-item-${item.href.replace(/\W+/g, "-")}`}
              className={`flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px] font-medium transition-colors ${
                active
                  ? "bg-[#D62828]/15 text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" style={{ color: active ? "#D62828" : "rgba(255,255,255,0.72)" }} />
              <span className="flex-1">{item.label}</span>
              {active && <span className="h-1.5 w-1.5 rounded-full bg-[#D62828]" />}
            </Link>
          );
        })}
      </nav>

      <div className="mt-2 space-y-0.5 border-t border-white/10 pt-2">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-[12px] px-3 py-2 text-[14px] font-medium text-white/70 hover:bg-white/5 hover:text-white"
        >
          <Globe className="h-[18px] w-[18px]" />
          Public site
        </Link>
        <Link
          to="/settings"
          className="flex items-center gap-3 rounded-[12px] px-3 py-2 text-[14px] font-medium text-white/70 hover:bg-white/5 hover:text-white"
        >
          <Settings className="h-[18px] w-[18px]" />
          Settings
        </Link>
      </div>

      <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[14px] font-bold text-white">
          {(user?.name || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="truncate text-[12px] font-semibold text-white">
            {user?.name || "Signed in"}
          </div>
          <div className="truncate text-[11px] text-white/50">{user?.email}</div>
        </div>
        <button
          type="button"
          onClick={doLogout}
          aria-label="Log out"
          data-testid="side-rail-logout"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </aside>
  );
}

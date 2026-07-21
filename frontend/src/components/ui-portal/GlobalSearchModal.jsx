import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  X,
  Package,
  Layers,
  Truck,
  User as UserIcon,
  Settings,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";

const GROUPS = [
  { key: "categories", label: "Service Categories", Icon: Package, color: "#D62828" },
  { key: "vehicles", label: "Vehicles", Icon: Truck, color: "#FF6A00" },
  { key: "capabilities", label: "Capabilities", Icon: Settings, color: "#7C3AED" },
  { key: "jobs", label: "Jobs", Icon: Layers, color: "#16A34A" },
  { key: "users", label: "Users", Icon: UserIcon, color: "#6B7280" },
  { key: "pages", label: "Pages", Icon: FileText, color: "#3B82F6" },
];

/**
 * GlobalSearchModal — web port of the Expo GlobalSearchModal.
 * Calls GET /api/search?q=…&scope=… (public, cookie-authenticated if the
 * user is signed in). Keyboard-accessible; ESC closes.
 */
export function GlobalSearchModal({
  open,
  onClose,
  scope = "all",
  placeholder = "Search categories, vehicles or jobs…",
  testID = "global-search",
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    setQ("");
    setResults(null);
    setErr(null);
    setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const runSearch = useCallback(
    async (query) => {
      if (!query || query.trim().length < 2) {
        setResults(null);
        return;
      }
      try {
        setLoading(true);
        setErr(null);
        const data = await api(
          `/search?q=${encodeURIComponent(query.trim())}&scope=${encodeURIComponent(scope)}`,
        );
        setResults(data);
      } catch (e) {
        setResults(null);
        setErr(e?.message || "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [scope],
  );

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 220);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [q, open, runSearch]);

  const handlePick = (row) => {
    onClose?.();
    if (row?.href) navigate(row.href);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-3 pt-10 sm:pt-24"
      role="dialog"
      aria-modal="true"
      data-testid={`${testID}-modal`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-3">
          <Search className="h-5 w-5 text-[#6B7280]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            data-testid={`${testID}-input`}
            className="flex-1 bg-transparent text-[16px] text-[#111111] placeholder:text-[#9CA3AF] outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            data-testid={`${testID}-close`}
            className="rounded-full p-1.5 hover:bg-[#F4F4F4]"
          >
            <X className="h-5 w-5 text-[#111111]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {q.trim().length < 2 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[#6B7280]">
              Type at least 2 characters to search categories, vehicles, jobs
              and pages.
            </p>
          ) : loading ? (
            <p className="px-4 py-6 text-[13px] text-[#6B7280]">Searching…</p>
          ) : err ? (
            <p className="px-4 py-6 text-[13px] text-[#DC2626]">{err}</p>
          ) : !results || (results.total ?? 0) === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-[#6B7280]">
              No results for “{q}”.
            </p>
          ) : (
            <div>
              {GROUPS.map(({ key, label, Icon, color }) => {
                const rows = results[key] || [];
                if (!rows.length) return null;
                return (
                  <section
                    key={key}
                    className="border-b border-[#F3F4F6] last:border-b-0"
                    data-testid={`${testID}-group-${key}`}
                  >
                    <h3 className="bg-[#F9FAFB] px-4 py-2 text-[11px] font-bold uppercase tracking-[1.2px] text-[#6B7280]">
                      {label}
                    </h3>
                    <ul>
                      {rows.map((row, i) => (
                        <li key={row.id || row.key || `${key}-${i}`}>
                          {row.href?.startsWith("http") ? (
                            <a
                              href={row.href}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-start gap-3 px-4 py-3 hover:bg-[#F4F4F4]"
                            >
                              <RowInner Icon={Icon} color={color} row={row} />
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handlePick(row)}
                              data-testid={`${testID}-row-${row.id || row.key || `${key}-${i}`}`}
                              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[#F4F4F4]"
                            >
                              <RowInner Icon={Icon} color={color} row={row} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RowInner({ Icon, color, row }) {
  return (
    <>
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate text-[14px] font-semibold text-[#111111]">
          {row.title}
        </span>
        {row.subtitle ? (
          <span className="block truncate text-[12px] text-[#6B7280]">
            {row.subtitle}
          </span>
        ) : null}
      </span>
    </>
  );
}

import React, { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X as XIcon, ArrowUp, ArrowDown } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui-portal/Button";
import { Input } from "@/components/ui-portal/Input";

const TAB_META = {
  categories: {
    title: "Service Categories",
    endpoint: "/admin/catalog/categories",
    itemLabel: "category",
    fields: ["key", "name", "description", "icon"],
  },
  vehicles: {
    title: "Vehicle Types",
    endpoint: "/admin/catalog/vehicles",
    itemLabel: "vehicle",
    fields: ["key", "name", "description", "icon"],
  },
  capabilities: {
    title: "Vehicle Capabilities",
    endpoint: "/admin/catalog/capabilities",
    itemLabel: "capability",
    fields: ["key", "name", "description", "icon"],
  },
};

export default function AdminCatalog() {
  const [tab, setTab] = useState("categories");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(TAB_META[tab].endpoint).catch(() => []);
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [tab]);
  useEffect(() => {
    load();
  }, [load]);

  const openNew = () =>
    setEditing({ key: "", name: "", description: "", icon: "", is_active: true, order: rows.length });
  const openEdit = (r) => setEditing({ ...r });

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setErr(null);
    try {
      const path = editing.id
        ? `${TAB_META[tab].endpoint}/${editing.id}`
        : TAB_META[tab].endpoint;
      await api(path, {
        method: editing.id ? "PUT" : "POST",
        body: editing,
      });
      setEditing(null);
      await load();
    } catch (e) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r) => {
    try {
      await api(`${TAB_META[tab].endpoint}/${r.id}`, {
        method: "PUT",
        body: { ...r, is_active: !r.is_active },
      });
      await load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Toggle failed");
    }
  };

  const remove = async (r) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete ${TAB_META[tab].itemLabel} "${r.name}"?`)) return;
    try {
      await api(`${TAB_META[tab].endpoint}/${r.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Delete failed");
    }
  };

  const reorder = async (r, dir) => {
    const idx = rows.findIndex((x) => x.id === r.id);
    const other = rows[dir === "up" ? idx - 1 : idx + 1];
    if (!other) return;
    try {
      await Promise.all([
        api(`${TAB_META[tab].endpoint}/${r.id}`, {
          method: "PUT",
          body: { ...r, order: other.order },
        }),
        api(`${TAB_META[tab].endpoint}/${other.id}`, {
          method: "PUT",
          body: { ...other, order: r.order },
        }),
      ]);
      await load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Reorder failed");
    }
  };

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-catalog">
      <header className="flex items-start justify-between gap-3 px-4 pt-6 md:px-8">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">
            Service Catalog
          </h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            {rows.length} {TAB_META[tab].itemLabel}
            {rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          data-testid="catalog-add"
          aria-label="Add"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D62828] text-white hover:bg-[#B01F1F]"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      <div className="mx-4 mt-3 flex gap-2 overflow-x-auto md:mx-8" data-testid="catalog-tabs">
        {Object.keys(TAB_META).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            data-testid={`catalog-tab-${k}`}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold ${
              tab === k
                ? "bg-[#111111] text-white"
                : "bg-[#F4F4F4] text-[#111111]"
            }`}
          >
            {TAB_META[k].title}
          </button>
        ))}
      </div>

      <ul className="mx-4 mt-3 space-y-3 md:mx-8">
        {loading && rows.length === 0 ? (
          <li className="text-[13px] text-[#6B7280]">Loading…</li>
        ) : rows.length === 0 ? (
          <li className="rounded-[12px] bg-[#F9FAFB] p-6 text-center text-[13px] text-[#6B7280]" data-testid="catalog-empty">
            No {TAB_META[tab].itemLabel} yet.
          </li>
        ) : (
          rows.map((r, i) => (
            <li
              key={r.id}
              className="rounded-[12px] border border-[#E5E7EB] p-4"
              data-testid={`catalog-row-${r.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-[#111111]">{r.name}</p>
                  <p className="text-[12px] text-[#6B7280]">
                    key: <code className="rounded bg-[#F4F4F4] px-1">{r.key}</code>
                    {r.order != null ? ` · order: ${r.order}` : ""}
                  </p>
                  {r.description && (
                    <p className="mt-1 line-clamp-2 text-[12px] text-[#6B7280]">
                      {r.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(r)}
                  data-testid={`catalog-toggle-${r.id}`}
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] ${
                    r.is_active
                      ? "bg-[#DCFCE7] text-[#16A34A]"
                      : "bg-[#FEE2E2] text-[#DC2626]"
                  }`}
                >
                  {r.is_active ? "Active" : "Inactive"}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => reorder(r, "up")}
                  disabled={i === 0}
                  data-testid={`catalog-up-${r.id}`}
                  aria-label="Move up"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F4] disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => reorder(r, "down")}
                  disabled={i === rows.length - 1}
                  data-testid={`catalog-down-${r.id}`}
                  aria-label="Move down"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F4] disabled:opacity-40"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  data-testid={`catalog-edit-${r.id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-[#F4F4F4] px-3 py-1.5 text-[12px] font-semibold text-[#111111] hover:bg-[#E5E7EB]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(r)}
                  data-testid={`catalog-delete-${r.id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-[#FEE2E2] px-3 py-1.5 text-[12px] font-semibold text-[#DC2626] hover:bg-[#FECACA]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          role="dialog"
          data-testid="catalog-modal"
        >
          <div className="flex max-h-[92vh] w-full flex-col overflow-hidden bg-white sm:max-w-[520px] sm:rounded-[20px]">
            <header className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-3">
              <div className="flex-1">
                <p className="text-[11px] font-bold tracking-[1.5px] text-[#D62828]">
                  {editing.id ? "EDIT" : "NEW"}
                </p>
                <h2 className="text-[18px] font-bold text-[#111111] capitalize">
                  {TAB_META[tab].itemLabel}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setErr(null);
                }}
                aria-label="Close"
                data-testid="catalog-modal-close"
              >
                <XIcon className="h-5 w-5 text-[#111111]" />
              </button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <Input
                label="Key (unique)"
                value={editing.key || ""}
                onChange={(e) => setEditing({ ...editing, key: e.target.value })}
                placeholder="lowercase_snake_case"
                testID="catalog-input-key"
              />
              <Input
                label="Name"
                value={editing.name || ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                testID="catalog-input-name"
              />
              <label className="block">
                <span className="mb-1 block text-[13px] font-semibold text-[#111111]">
                  Description
                </span>
                <textarea
                  rows={3}
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  data-testid="catalog-input-description"
                  className="w-full resize-none rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-[14px] outline-none focus:border-[#111111]"
                />
              </label>
              <Input
                label="Icon (name or key)"
                value={editing.icon || ""}
                onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                testID="catalog-input-icon"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  data-testid="catalog-input-active"
                />
                <span className="text-[13px] text-[#111111]">Active</span>
              </label>
              {err && (
                <p className="text-[13px] text-[#DC2626]" data-testid="catalog-modal-error">
                  {err}
                </p>
              )}
            </div>
            <footer className="flex gap-2 border-t border-[#E5E7EB] p-3">
              <Button
                title="Cancel"
                variant="ghost"
                fullWidth={false}
                onClick={() => {
                  setEditing(null);
                  setErr(null);
                }}
                testID="catalog-modal-cancel"
              />
              <Button
                title={editing.id ? "Save" : "Create"}
                variant="primary"
                loading={saving}
                disabled={!editing.key?.trim() || !editing.name?.trim()}
                onClick={save}
                testID="catalog-modal-save"
              />
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

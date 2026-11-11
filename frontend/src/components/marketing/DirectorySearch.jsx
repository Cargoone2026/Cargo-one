import React, { useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { searchDirectory } from "@/data/directory";

const POST_JOB_HREF = "/auth/register?role=customer";

// Client-side "What do you need to move?" search over the A-Z directory entries. Combobox with keyboard support.
export function DirectorySearch() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(-1);
  const [noMatch, setNoMatch] = useState(false);
  const navigate = useNavigate();
  const id = useId();
  const results = searchDirectory(q);
  const open = q.trim().length > 0 && results.length > 0;

  const go = (e) => navigate(e.path);
  const onKeyDown = (ev) => {
    if (ev.key === "ArrowDown" && open) { ev.preventDefault(); setActive((a) => (a + 1) % results.length); }
    else if (ev.key === "ArrowUp" && open) { ev.preventDefault(); setActive((a) => (a <= 0 ? results.length - 1 : a - 1)); }
    else if (ev.key === "Escape") { setQ(""); setActive(-1); }
    else if (ev.key === "Enter") {
      ev.preventDefault();
      if (open) go(results[active >= 0 ? active : 0]);
      else if (q.trim()) setNoMatch(true);
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-[720px]" data-testid="directory-search">
      <label htmlFor={`${id}-input`} className="mb-2 block text-[14px] font-bold text-[#111111]">What do you need to move?</label>
      <div className="flex items-center gap-2 rounded-full border-2 border-[#E5E7EB] bg-white px-4 py-3 focus-within:border-[#D62828]">
        <Search className="h-5 w-5 shrink-0 text-[#6B7280]" aria-hidden="true" />
        <input
          id={`${id}-input`}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(-1); setNoMatch(false); }}
          onKeyDown={onKeyDown}
          placeholder="What do you need to move? e.g. sofa, car won't start, pallet, piano"
          data-testid="directory-search-input"
          className="w-full bg-transparent text-[15px] text-[#111111] outline-none placeholder:text-[#9CA3AF] focus:outline-none focus-visible:outline-none"
        />
      </div>
      {open ? (
        <ul id={`${id}-list`} role="listbox" className="absolute inset-x-0 z-20 mt-2 overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white shadow-xl" data-testid="directory-search-results">
          {results.map((e, i) => (
            <li
              key={`${e.label}-${e.path}`}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(ev) => { ev.preventDefault(); go(e); }}
              onMouseEnter={() => setActive(i)}
              data-testid={`directory-search-result-${i}`}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${i === active ? "bg-[#FEF2F2]" : "bg-white"}`}
            >
              <span>
                <span className="block text-[15px] font-bold text-[#111111]">{e.label}</span>
                <span className="block text-[13px] text-[#6B7280]">{e.line}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[#D62828]" aria-hidden="true" />
            </li>
          ))}
        </ul>
      ) : null}
      {noMatch && !open ? (
        <p className="mt-3 text-[14px] text-[#374151]" role="status" data-testid="directory-search-no-match">
          Not listed?{" "}
          <Link to={POST_JOB_HREF} className="font-bold text-[#D62828] underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D62828]" data-testid="directory-search-post-job">
            Post your job and local drivers will quote
          </Link>
        </p>
      ) : null}
    </div>
  );
}

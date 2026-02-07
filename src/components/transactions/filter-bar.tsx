"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface FilterBarProps {
  categories: { id: string; name: string; icon: string | null }[];
  accounts: { id: string; name: string }[];
}

export function FilterBar({ categories, accounts }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get("category") ?? "";
  const currentAccount = searchParams.get("account") ?? "";
  const currentType = searchParams.get("type") ?? "";
  const currentSearch = searchParams.get("search") ?? "";

  const [search, setSearch] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const hasFilters =
    currentCategory || currentAccount || currentType || currentSearch;

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("category");
    params.delete("account");
    params.delete("type");
    params.delete("search");
    router.push(`?${params.toString()}`);
    setSearch("");
  }, [router, searchParams]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (search !== currentSearch) {
        updateParams("search", search);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, currentSearch, updateParams]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <Input
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 w-40 text-xs sm:w-48"
      />

      {/* Category filter */}
      <select
        value={currentCategory}
        onChange={(e) => updateParams("category", e.target.value)}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
      >
        <option value="">All categories</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.icon} {cat.name}
          </option>
        ))}
      </select>

      {/* Account filter */}
      {accounts.length > 1 ? (
        <select
          value={currentAccount}
          onChange={(e) => updateParams("account", e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
        >
          <option value="">All accounts</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </select>
      ) : null}

      {/* Type toggle */}
      <div className="flex rounded-md border border-border">
        {(
          [
            ["", "All"],
            ["income", "Income"],
            ["expense", "Expenses"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => updateParams("type", value)}
            className={`px-2.5 py-1 text-xs transition-colors ${
              currentType === value
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            } ${value === "" ? "rounded-l-md" : ""} ${value === "expense" ? "rounded-r-md" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Clear filters */}
      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-8 text-xs text-muted-foreground"
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}

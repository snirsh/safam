"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface CategoryGroup {
  id: string;
  name: string;
  icon: string | null;
  children: { id: string; name: string; icon: string | null }[];
}

interface CategorySelectorProps {
  transactionId: string;
  currentCategoryName: string | null;
  currentCategoryIcon: string | null;
  categories: CategoryGroup[];
}

export function CategorySelector({
  transactionId,
  currentCategoryName,
  currentCategoryIcon,
  categories,
}: CategorySelectorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSelect(categoryId: string) {
    setLoading(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent/80 disabled:opacity-50"
        >
          {currentCategoryName ? (
            <>
              {currentCategoryIcon} {currentCategoryName}
            </>
          ) : (
            <span className="italic">Set category</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>No categories found.</CommandEmpty>
            {categories.map((group) => (
              <CommandGroup
                key={group.id}
                heading={`${group.icon ?? ""} ${group.name}`}
              >
                {/* Parent as selectable if it has no children */}
                {group.children.length === 0 ? (
                  <CommandItem
                    onSelect={() => handleSelect(group.id)}
                    className="cursor-pointer"
                  >
                    {group.icon} {group.name}
                  </CommandItem>
                ) : (
                  group.children.map((child) => (
                    <CommandItem
                      key={child.id}
                      onSelect={() => handleSelect(child.id)}
                      className="cursor-pointer"
                    >
                      {child.icon} {child.name}
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PatternDeleteButton({ patternId }: { patternId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      // Auto-reset after 3 seconds if not confirmed
      setTimeout(() => setConfirming(false), 3000);
      return;
    }

    setPending(true);
    try {
      const res = await fetch(`/api/recurring/${patternId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Pattern deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete pattern");
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  return (
    <Button
      variant={confirming ? "destructive" : "ghost"}
      size="icon-xs"
      onClick={handleDelete}
      disabled={pending}
      title={confirming ? "Click again to confirm" : "Delete pattern"}
    >
      <Trash2Icon />
    </Button>
  );
}

"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-7 w-16" />;
  }

  const cycleTheme = () => {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };

  const icon = theme === "dark" ? "◗" : theme === "light" ? "◑" : "◐";
  const label = theme === "dark" ? "dark" : theme === "light" ? "light" : "auto";

  return (
    <button
      onClick={cycleTheme}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      title={`Theme: ${label}`}
    >
      <span className="font-mono">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

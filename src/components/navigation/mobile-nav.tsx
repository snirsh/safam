"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { NAV_ITEMS } from "@/lib/nav-items";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-2"
            >
              {isActive ? (
                <motion.span
                  layoutId="bottomNavIndicator"
                  className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full"
                  style={{ backgroundColor: "#C15F3C" }}
                  transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
                />
              ) : null}
              <span
                className={`font-mono text-base ${isActive ? "text-foreground" : "text-muted-foreground"}`}
              >
                {item.icon}
              </span>
              <span
                className={`text-[10px] ${isActive ? "text-foreground" : "text-muted-foreground"}`}
              >
                {item.shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

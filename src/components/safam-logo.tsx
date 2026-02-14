import { cn } from "@/lib/utils";

interface SafamLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export function SafamLogo({
  size = 24,
  className,
  showText = true,
  textClassName = "font-mono text-lg font-bold text-foreground",
}: SafamLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Wallet body */}
        <rect x="2" y="6" width="20" height="14" rx="2.5" />
        {/* Wallet flap */}
        <path d="M2 10h20" />
        {/* Card slot / coin detail */}
        <rect x="14" y="13" width="5" height="3" rx="1" />
      </svg>
      {showText ? <span className={textClassName}>safam</span> : null}
    </span>
  );
}

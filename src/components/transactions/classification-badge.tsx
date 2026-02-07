import { Badge } from "@/components/ui/badge";

const METHOD_CONFIG = {
  rule: { label: "Rule", variant: "secondary" as const },
  ai: { label: "AI", variant: "outline" as const },
  manual: { label: "Manual", variant: "default" as const },
};

interface ClassificationBadgeProps {
  method: string | null;
}

export function ClassificationBadge({ method }: ClassificationBadgeProps) {
  if (!method) return null;

  const config = METHOD_CONFIG[method as keyof typeof METHOD_CONFIG];
  if (!config) return null;

  return (
    <Badge
      variant={config.variant}
      className="ml-1 px-1 py-0 text-[10px] leading-tight opacity-60"
    >
      {config.label}
    </Badge>
  );
}

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: "good" | "warn" | "danger" | "neutral"
  children: React.ReactNode
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto px-2 py-0.5 whitespace-normal",
        tone === "good" && "border-good/30 bg-good/10 text-good",
        tone === "warn" && "border-warn/40 bg-warn/15 text-warn",
        tone === "danger" && "border-destructive/30 bg-destructive/10 text-destructive",
        className,
      )}
    >
      {children}
    </Badge>
  )
}

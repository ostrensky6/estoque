import * as React from "react";

import { cn } from "@/lib/utils";

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Tooltip({
  children,
  content,
  side = "top",
}: {
  children: React.ReactElement<{ "aria-label"?: string }>;
  content: string;
  side?: "top" | "bottom";
}) {
  return (
    <span className="group/tooltip relative inline-flex">
      {React.cloneElement(children, {
        "aria-label": children.props["aria-label"] ?? content,
      })}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 hidden max-w-64 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover/tooltip:block group-focus-within/tooltip:block",
          side === "top"
            ? "bottom-full left-1/2 mb-2 -translate-x-1/2"
            : "left-1/2 top-full mt-2 -translate-x-1/2",
        )}
      >
        {content}
      </span>
    </span>
  );
}

export { Tooltip, TooltipProvider };

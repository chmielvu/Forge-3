

"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../utils" // Updated to relative path

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#a8a29e]/20 text-[#e7e5e4] hover:bg-[#a8a29e]/30",
        secondary: "border-transparent bg-[#292524] text-[#e7e5e4] hover:bg-[#292524]/80",
        destructive: "border-transparent bg-[#7f1d1d] text-[#fecaca] hover:bg-[#7f1d1d]/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

// FIX: Explicitly define the `variant` property in the interface.
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: VariantProps<typeof badgeVariants>['variant'];
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  )
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
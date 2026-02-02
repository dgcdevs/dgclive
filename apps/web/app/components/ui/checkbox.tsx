import * as React from "react"
import { cn } from "@/app/lib/utils"
import { Check } from "lucide-react"

const Checkbox = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
    <div className="relative flex items-center">
        <input
            type="checkbox"
            className={cn(
                "peer h-5 w-5 appearance-none rounded border border-white/20 bg-white/5 checked:bg-brand-purple checked:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple/50 cursor-pointer",
                className
            )}
            ref={ref}
            {...props}
        />
        <Check className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100" />
    </div>
))
Checkbox.displayName = "Checkbox"

export { Checkbox }

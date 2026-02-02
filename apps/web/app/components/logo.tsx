import * as React from "react"
import Image from "next/image"
import LogoImage from "@/assets/images/dgclivelogo.png"

export function Logo({ className }: { className?: string }) {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <Image
                src={LogoImage}
                alt="DGCLIVE Logo"
                className="h-10 w-auto"
                priority
            />
        </div>
    )
}

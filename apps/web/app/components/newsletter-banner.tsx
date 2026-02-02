import { Button } from "./ui/button"
import { BellRing } from "lucide-react"

export function NewsletterBanner() {
    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2E0249] to-[#1A0B2E] border border-white/10 p-6 md:p-12">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF9A9E] to-[#FECFEF] shadow-lg">
                        <BellRing className="h-8 w-8 text-brand-purple" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-white">Never Miss a Moment</h3>
                        <p className="mt-2 text-white/60 max-w-md">
                            Get notified about upcoming services, special events, and powerful messages. Join our community and stay connected with what God is doing.
                        </p>
                    </div>
                </div>

                <div className="flex w-full max-w-md items-center gap-2 rounded-lg bg-black/20 p-2 border border-white/5 backdrop-blur-sm">
                    <input
                        type="email"
                        placeholder="Enter your email"
                        className="flex-1 bg-transparent px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                    <Button className="bg-[#D90368] hover:bg-[#D90368]/90 text-white shadow-lg">
                        Subscribe
                    </Button>
                </div>
            </div>

            {/* Ambient Glow */}
            <div className="absolute right-0 top-0 h-full w-1/2 bg-brand-purple/20 blur-[100px]" />
        </div>
    )
}

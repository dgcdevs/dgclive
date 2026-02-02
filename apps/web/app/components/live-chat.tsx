import { Send, MoreVertical, X } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"

interface ChatMessage {
    id: string
    user: string
    message: string
    time: string
    isModerator?: boolean
}

const DUMMY_MESSAGES: ChatMessage[] = [
    { id: "1", user: "Sarah M.", message: "Amen! God is so good!", time: "2m ago" },
    { id: "2", user: "David K.", message: "Joining from Lagos, Nigeria 🇳🇬", time: "3m ago" },
    { id: "3", user: "Grace L.", message: "This worship is so powerful 🙌", time: "5m ago" },
    { id: "4", user: "Michael T.", message: "Praying for everyone watching!", time: "7m ago" },
    { id: "5", user: "Ruth A.", message: "Can someone share the scripture reference?", time: "8m ago" },
    { id: "6", user: "Pastor John", message: "Ephesians 2:8-9 - Grace through faith", time: "9m ago", isModerator: true },
]

export function LiveChat() {
    return (
        <div className="flex bg-brand-card border border-white/5 rounded-xl overflow-hidden shadow-2xl flex-col h-full h-[600px] w-full">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] p-4">
                <div>
                    <h3 className="text-sm font-bold text-white">Live Chat</h3>
                    <p className="text-xs text-white/40">Join the conversation with 2,847 others</p>
                </div>
                <button className="text-white/40 hover:text-white transition-colors">
                    <MoreVertical className="h-4 w-4" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                {DUMMY_MESSAGES.map((msg) => (
                    <div key={msg.id} className="group flex flex-col gap-1 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-baseline gap-2">
                            <span className={`font-bold ${msg.isModerator ? 'text-brand-purple' : 'text-white'}`}>
                                {msg.user}
                            </span>
                            <span className="text-[10px] text-white/30">{msg.time}</span>
                        </div>
                        <div className="text-white/80 leading-relaxed rounded-lg p-2 bg-white/5 border border-white/5 group-hover:bg-white/10 transition-colors">
                            {msg.message}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="border-t border-white/5 bg-white/[0.02] p-4">
                <div className="relative flex gap-2">
                    <input
                        className="w-full rounded-lg border border-white/10 bg-brand-dark px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple transition-all"
                        placeholder="Send a message..."
                    />
                    <button className="flex bg-brand-purple hover:bg-brand-purple/90 text-white p-2.5 rounded-lg transition-colors items-center justify-center">
                        <Send className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}

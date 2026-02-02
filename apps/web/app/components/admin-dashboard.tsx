"use client"

import { useState, useEffect } from "react"
import { Bell, Search, Radio, Key, Users, LayoutDashboard, BarChart3, Settings, User, Copy, Hash, X, CheckCircle, AlertCircle } from "lucide-react"

export function AdminDashboard() {
    // --- STATE ---
    const [token, setToken] = useState("");
    const [users, setUsers] = useState<any[]>([]);
    const [invites, setInvites] = useState<any[]>([]);

    // Notification State
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });

    // The Pulpit State
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [isLive, setIsLive] = useState(false);

    // The Gatekeeper State
    const [memberName, setMemberName] = useState("");
    const [customCode, setCustomCode] = useState("");
    const [generatedKey, setGeneratedKey] = useState("");

    const [searchQuery, setSearchQuery] = useState("");

    // --- EFFECTS ---
    useEffect(() => {
        const storedToken = localStorage.getItem("token");
        if (storedToken) {
            setToken(storedToken);
            fetchData(storedToken);
        }
    }, []);

    // Debounce search
    useEffect(() => {
        if (!token) return;
        const delayDebounceFn = setTimeout(() => {
            fetchUsers(token, searchQuery);
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, token]);

    // Auto-dismiss notification
    useEffect(() => {
        if (notification.type) {
            const timer = setTimeout(() => {
                setNotification({ message: '', type: null });
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [notification.type]);

    const fetchData = async (authToken: string) => {
        fetchUsers(authToken);
        fetchInvites(authToken);
    };

    const fetchUsers = async (authToken: string, search: string = "") => {
        try {
            const query = search ? `?search=${encodeURIComponent(search)}` : "";
            const usersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users${query}`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });
            if (usersRes.ok) {
                const data = await usersRes.json();
                setUsers(data.users || []);
            }
        } catch (error) {
            console.error("Failed to fetch users", error);
        }
    }

    const fetchInvites = async (authToken: string) => {
        try {
            const invitesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/invites`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });
            if (invitesRes.ok) {
                const data = await invitesRes.json();
                setInvites(data.invites || []);
            }
        } catch (error) {
            console.error("Failed to fetch invites", error);
        }
    }

    // --- ACTIONS ---
    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/role`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ role: newRole }),
            });

            if (!res.ok) throw new Error("Failed to update role");

            showNotification("User role updated successfully", "success");
            fetchUsers(token, searchQuery); // Refresh list

        } catch (err: any) {
            showNotification(err.message, "error");
        }
    };

    const handleGenerateKey = async () => {
        if (!memberName) return showNotification("Please enter a Member Name", "error");

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/invite`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    issuedTo: memberName,
                    code: customCode || undefined
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setGeneratedKey(data.invite.code);
            setMemberName("");
            setCustomCode("");
            showNotification(`Key Generated: ${data.invite.code}`, "success");

            // Refresh invites list
            fetchInvites(token);

        } catch (err: any) {
            showNotification(err.message, "error");
        }
    };

    const handleStartBroadcast = async () => {
        if (!title) return showNotification("Please enter a Sermon Title", "error");

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/start`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    title,
                    description,
                    isPublic
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setIsLive(true);
            showNotification("Stream Started Successfully!", "success");

        } catch (err: any) {
            showNotification(err.message, "error");
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white pb-24 font-sans selection:bg-[#A828FF]/30 relative">
            {/* Notification Toast */}
            {notification.type && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-top-4 duration-300 ${notification.type === 'success'
                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                    {notification.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    <p className="font-bold text-sm tracking-wide">{notification.message}</p>
                    <button onClick={() => setNotification({ message: '', type: null })} className="ml-2 hover:opacity-70">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}



            <main className="px-6 py-8 space-y-12 max-w-[1600px] mx-auto">
                {/* Section 1: The Pulpit */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest">The Pulpit</h2>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${isLive ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                            <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${isLive ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isLive ? 'text-green-500' : 'text-red-500'}`}>
                                {isLive ? 'LIVE ON AIR' : 'OFFLINE'}
                            </span>
                        </div>
                    </div>

                    <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-white/50 uppercase tracking-wider ml-1">Sermon Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. The Power of Grace"
                                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#A828FF]/50 focus:ring-1 focus:ring-[#A828FF]/50 transition-all placeholder:text-white/20"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-white/50 uppercase tracking-wider ml-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Brief overview of today's service..."
                                    rows={3}
                                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#A828FF]/50 focus:ring-1 focus:ring-[#A828FF]/50 transition-all placeholder:text-white/20 resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-white/5">
                                    <Users className="h-4 w-4 text-white/70" />
                                </div>
                                <span className="font-bold text-sm">Public Broadcast</span>
                            </div>
                            {/* Custom Toggle Switch */}
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isPublic}
                                    onChange={(e) => setIsPublic(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#A828FF]"></div>
                            </label>
                        </div>

                        <button
                            onClick={handleStartBroadcast}
                            className="w-full bg-[#A828FF] hover:bg-[#9222de] text-white py-4 rounded-xl font-bold uppercase tracking-widest shadow-[0_0_40px_-10px_rgba(168,40,255,0.4)] hover:shadow-[0_0_60px_-15px_rgba(168,40,255,0.6)] transition-all active:scale-[0.99] flex items-center justify-center gap-2 group"
                        >
                            <Radio className="h-5 w-5 group-hover:scale-110 transition-transform" />
                            Start Broadcast
                        </button>
                    </div>
                </section>

                {/* Section 2: The Gatekeeper */}
                <section className="space-y-4">
                    <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest">The Gatekeeper</h2>

                    <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-white/50 uppercase tracking-wider ml-1">Member Name</label>
                                <input
                                    type="text"
                                    value={memberName}
                                    onChange={(e) => setMemberName(e.target.value)}
                                    placeholder="Enter new member name"
                                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#A828FF]/50 focus:ring-1 focus:ring-[#A828FF]/50 transition-all placeholder:text-white/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-white/50 uppercase tracking-wider ml-1">Custom Code</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={customCode}
                                        onChange={(e) => setCustomCode(e.target.value)}
                                        placeholder="Auto-generated if empty"
                                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#A828FF]/50 focus:ring-1 focus:ring-[#A828FF]/50 transition-all placeholder:text-white/20"
                                    />
                                    <Hash className="absolute right-3 top-3 h-5 w-5 text-white/20" />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleGenerateKey}
                            className="w-full bg-transparent border border-[#A828FF]/30 hover:bg-[#A828FF]/10 text-[#A828FF] py-3 rounded-xl font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                            <Key className="h-4 w-4" />
                            Generate Key
                        </button>

                        {generatedKey && (
                            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                                <span className="text-green-500 font-bold block mb-1">KEY GENERATED SUCCESSFULLY</span>
                                <span className="text-white text-lg font-mono tracking-widest">{generatedKey}</span>
                            </div>
                        )}

                        <div className="border-t border-white/5 pt-4 space-y-4">
                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Recent Invites</p>
                            <div className="space-y-2">
                                {invites.map((invite) => (
                                    <InviteItem
                                        key={invite.id}
                                        name={invite.usedBy ? invite.usedBy.fullName : (invite.issuedTo || "Unused")}
                                        code={invite.code}
                                    />
                                ))}
                                {invites.length === 0 && <p className="text-xs text-white/20 italic">No recent invites</p>}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 3: The Flock */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest">The Flock</h2>
                        <div className="px-2 py-1 bg-white/5 rounded-md border border-white/5 text-[10px] font-bold text-white/50">
                            {users.length} TOTAL
                        </div>
                    </div>

                    <div className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden">
                        {/* Search Bar */}
                        <div className="p-4 border-b border-white/5">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search members..."
                                    className="w-full bg-[#0A0A0A] border border-transparent rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:bg-white/5 transition-colors placeholder:text-white/20 text-white"
                                />
                            </div>
                        </div>

                        {/* List Header */}
                        <div className="grid grid-cols-[1fr_120px] px-6 py-3 bg-white/[0.02] border-b border-white/5">
                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Member</span>
                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Role</span>
                        </div>

                        {/* User List */}
                        {users.length > 0 ? (
                            <div className="divide-y divide-white/5">
                                {users.map((user) => (
                                    <div key={user.id} className="grid grid-cols-[1fr_120px] px-6 py-4 hover:bg-white/5 transition-colors items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-white/50">
                                                {user.fullName ? user.fullName.substring(0, 2).toUpperCase() : "??"}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-white">{user.fullName || "Unknown"}</h4>
                                                <p className="text-xs text-white/30">{user.email}</p>
                                            </div>
                                        </div>

                                        {/* Role Dropdown */}
                                        <select
                                            value={user.role}
                                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                            className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs font-bold text-white/70 focus:outline-none focus:border-[#A828FF] transition-colors"
                                        >
                                            <option value="MEMBER">MEMBER</option>
                                            <option value="MEDIA">MEDIA</option>
                                            <option value="ADMIN">ADMIN</option>
                                        </select>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-white/20 text-sm italic">
                                No members found.
                            </div>
                        )}
                    </div>
                </section>
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A]/80 backdrop-blur-xl border-t border-white/5 px-6 py-4 flex justify-between md:justify-center md:gap-12 z-50">
                <NavItem icon={<LayoutDashboard className="h-5 w-5" />} label="Dashboard" active />
                <NavItem icon={<Users className="h-5 w-5" />} label="Members" />
                <NavItem icon={<BarChart3 className="h-5 w-5" />} label="Analytics" />
                <NavItem icon={<Settings className="h-5 w-5" />} label="Settings" />
            </nav>
        </div>
    )
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
    return (
        <button className={`flex flex-col items-center gap-1 ${active ? 'text-[#A828FF]' : 'text-white/40 hover:text-white/70'} transition-colors`}>
            {icon}
            <span className="text-[10px] font-bold tracking-wide">{label}</span>
        </button>
    )
}

function InviteItem({ name, code }: { name: string, code: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group border border-transparent hover:border-white/5">
            <span className="font-bold text-sm text-white">{name}</span>
            <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-[#A828FF] bg-[#A828FF]/10 px-2 py-1 rounded">{code}</span>
                <button onClick={handleCopy} className="hover:scale-110 transition-transform">
                    {copied ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                        <Copy className="h-3 w-3 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white" />
                    )}
                </button>
            </div>
        </div>
    )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Checkbox } from "../components/ui/checkbox"
import { Logo } from "../components/logo"
import { Check, Mail, Lock, Key, Eye, EyeOff, User } from "lucide-react"

export default function AuthPage() {
    const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin")
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // State for the Form Data
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
        inviteCode: ""
    });

    // Handle Typing
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const endpoint = activeTab === "signup" ? "/register" : "/login";
            const body = activeTab === "signup"
                ? {
                    email: formData.email,
                    password: formData.password,
                    fullName: formData.fullName,
                    inviteCode: formData.inviteCode
                }
                : {
                    email: formData.email,
                    password: formData.password
                };

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Authentication failed");

            // Success handling
            if (activeTab === "signup") {
                alert("Account Created! Please Sign In.");
                setActiveTab("signin");
            } else {
                // Sign In Success
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data.user));

                // Redirect based on role - ALL go to dashboard now, as dashboard handles the view
                router.push("/dashboard");
            }

        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full bg-brand-dark">
            {/* Left Side - Hero */}
            <div className="relative hidden w-1/2 flex-col justify-between p-12 lg:flex">
                {/* Background Image / Gradient Overlay */}
                <div className="absolute inset-0 z-0">
                    {/* Placeholder for actual background image from screenshot */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-purple/20 via-brand-dark/80 to-brand-dark z-10" />
                    {/* You would place an <Image /> here if you had the asset */}
                    <div className="absolute inset-0 bg-black/40 z-0" />
                </div>

                {/* Content */}
                <div className="relative z-20 h-full flex flex-col justify-between">
                    <Logo />

                    <div className="space-y-8 max-w-lg">
                        <h1 className="text-5xl font-bold leading-tight text-white mb-6">
                            Experience God's Presence on Livestream
                        </h1>

                        <p className="text-lg text-white/80 leading-relaxed mb-8">
                            Join thousands in worship, powerful messages, and community connection from anywhere in the world.
                        </p>

                        <div className="space-y-4">
                            <FeatureItem text="Live worship services & special events" />
                            <FeatureItem text="Interactive chat & community" />
                            <FeatureItem text="On-demand sermon archives" />
                        </div>
                    </div>

                    <div className="relative">
                        <blockquote className="text-white/60 italic text-lg mb-2">
                            "For where two or three gather in my name, there am I with them."
                        </blockquote>
                        <cite className="text-white/40 not-italic block">
                            - Matthew 18:20
                        </cite>
                    </div>
                </div>
            </div>

            {/* Right Side - Auth Form */}
            <div className="flex w-full flex-col items-center justify-center bg-brand-dark px-4 lg:w-1/2">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-semibold text-white">
                            {activeTab === "signin" ? "Welcome Back" : "Create Account"}
                        </h2>
                        <p className="mt-2 text-white/60">
                            {activeTab === "signin" ? "Sign in to your account" : "Join our community today"}
                        </p>
                    </div>

                    {/* Auth Card */}
                    <div className="bg-brand-card/50 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">

                        {/* Toggle */}
                        <div className="grid grid-cols-2 gap-2 mb-8 bg-black/20 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab("signin")}
                                className={`text-sm font-medium py-2 rounded-md transition-colors ${activeTab === "signin" ? "bg-brand-purple text-white shadow-sm" : "text-white/60 hover:text-white"
                                    }`}
                            >
                                Sign In
                            </button>
                            <button
                                onClick={() => setActiveTab("signup")}
                                className={`text-sm font-medium py-2 rounded-md transition-colors ${activeTab === "signup" ? "bg-brand-purple text-white shadow-sm" : "text-white/60 hover:text-white"
                                    }`}
                            >
                                Sign Up
                            </button>
                        </div>

                        <form className="space-y-5" onSubmit={handleAuth}>
                            {/* Full Name - Signup Only */}
                            {activeTab === "signup" && (
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input
                                        id="name"
                                        name="fullName"
                                        type="text"
                                        value={formData.fullName}
                                        onChange={handleChange}
                                        placeholder="Enter your full name"
                                        icon={<User className="w-4 h-4" />}
                                    />
                                </div>
                            )}

                            {/* Email - Both */}
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="Enter your email"
                                    icon={<Mail className="w-4 h-4" />}
                                />
                            </div>

                            {/* Password - Both */}
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="Enter your password"
                                        className="pr-10"
                                        icon={<Lock className="w-4 h-4" />}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors z-10"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Service Access Code - Signup Only */}
                            {activeTab === "signup" && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="access-code">Service Access Code</Label>
                                        <span className="text-xs text-white/30">Required for live services</span>
                                    </div>
                                    <Input
                                        id="access-code"
                                        name="inviteCode"
                                        type="text"
                                        value={formData.inviteCode}
                                        onChange={handleChange}
                                        placeholder="ENTER YOUR ACCESS CODE"
                                        className="tracking-wider uppercase"
                                        icon={<Key className="w-4 h-4" />}
                                    />
                                    <p className="text-xs text-white/30">Access codes are sent via email before each service</p>
                                </div>
                            )}

                            {/* Remember Me / Forgot Password - Signin Only */}
                            {activeTab === "signin" && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="remember" />
                                        <label
                                            htmlFor="remember"
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-white/70"
                                        >
                                            Remember me
                                        </label>
                                    </div>
                                    <a href="#" className="text-sm font-medium text-brand-purple hover:text-brand-purple/80">
                                        Forgot password?
                                    </a>
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-brand-purple hover:bg-brand-purple/90 h-12 text-base shadow-[0_0_20px_rgba(157,0,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? "Processing..." : (activeTab === "signin" ? "Sign In" : "Create Account")}
                            </Button>
                        </form>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/10" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-brand-card px-2 text-white/40">
                                    or continue with
                                </span>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            className="w-full h-12 bg-white text-black hover:bg-white/90 border-transparent hover:text-black"
                            onClick={() => router.push("/")}
                        >
                            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Continue with Google
                        </Button>

                    </div>
                </div>
            </div>
        </div>
    )
}

function FeatureItem({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-brand-purple/50 bg-brand-purple/10">
                <Check className="h-3.5 w-3.5 text-brand-purple" />
            </div>
            <span className="text-white/90 font-medium">{text}</span>
        </div>
    )
}

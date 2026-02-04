"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Logo } from "../components/logo"
import { Check, Mail, Lock, Eye, EyeOff, User, AlertCircle } from "lucide-react"
import BokehDots from "../components/BokehDots"

type SignupStep = "form" | "verification" | "error"
type ForgotPasswordStep = "email" | "code" | null

export default function AuthPage() {
	const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin")
	const [signupStep, setSignupStep] = useState<SignupStep>("form")
	const [forgotPasswordStep, setForgotPasswordStep] = useState<ForgotPasswordStep>(null)
	const router = useRouter()
	const [isLoading, setIsLoading] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [errorMessage, setErrorMessage] = useState("")
	const [showErrorModal, setShowErrorModal] = useState(false)
	const [pendingEmail, setPendingEmail] = useState("")
	const [forgotPasswordEmail, setForgotPasswordEmail] = useState("")

	const [formData, setFormData] = useState({
		fullName: "",
		email: "",
		password: "",
		confirmPassword: "",
		resetCode: "",
		newPassword: "",
		confirmNewPassword: "",
		verificationCode: ""
	})

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFormData({ ...formData, [e.target.name]: e.target.value })
	}

	const handleSignup = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsLoading(true)
		setErrorMessage("")

		// Validate passwords match
		if (formData.password !== formData.confirmPassword) {
			setErrorMessage("Passwords do not match")
			setIsLoading(false)
			return
		}

		try {
			const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/register`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: formData.email,
					password: formData.password,
					fullName: formData.fullName
				})
			})

			const data = await res.json()

			if (!res.ok) {
				// Not registered in Google Sheet
				if (data.status === "not_registered") {
					setErrorMessage(data.message)
					setShowErrorModal(true)
				} else {
					throw new Error(data.error || "Sign up failed")
				}
			} else {
				// Verification code sent
				setPendingEmail(formData.email)
				setSignupStep("verification")
				setFormData({ ...formData, verificationCode: "" })
			}
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : "Failed to send verification code"
			setErrorMessage(errorMessage)
			setShowErrorModal(true)
		} finally {
			setIsLoading(false)
		}
	}

	const handleVerifyEmail = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsLoading(true)
		setErrorMessage("")

		try {
			const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/verify-email`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: pendingEmail,
					code: formData.verificationCode,
					password: formData.password,
					fullName: formData.fullName
				})
			})

			const data = await res.json()

			if (!res.ok) {
				throw new Error(data.error || "Verification failed")
			}

			// Success! Store token and redirect
			localStorage.setItem("token", data.token)
			localStorage.setItem("user", JSON.stringify(data.user))
			alert("Account created successfully! Welcome!")
			setActiveTab("signin")
			setSignupStep("form")
		setFormData({ fullName: "", email: "", password: "", confirmPassword: "", resetCode: "", newPassword: "", confirmNewPassword: "", verificationCode: "" })
		router.push("/dashboard")
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : "Unknown error"
		setErrorMessage(errorMessage)
		} finally {
			setIsLoading(false)
		}
	}

	const handleSignin = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsLoading(true)
		setErrorMessage("")

		try {
			const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: formData.email,
					password: formData.password
				})
			})

			const data = await res.json()
			if (!res.ok) throw new Error(data.error || "Authentication failed")

			localStorage.setItem("token", data.token)
			localStorage.setItem("user", JSON.stringify(data.user))
			router.push("/dashboard")
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : "Authentication failed"
		setErrorMessage(errorMessage)
		} finally {
			setIsLoading(false)
		}
	}

	const handleAuth = activeTab === "signin" ? handleSignin : handleSignup

	const handleForgotPasswordEmail = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsLoading(true)
		setErrorMessage("")

		try {
			const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/forgot-password`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: forgotPasswordEmail })
			})

			const data = await res.json()

			if (!res.ok) {
				throw new Error(data.error || "Failed to send reset code")
			}

			setForgotPasswordStep("code")
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : "Failed to send reset code"
		setErrorMessage(errorMessage)
		} finally {
			setIsLoading(false)
		}
	}

	const handleResetPassword = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsLoading(true)
		setErrorMessage("")

		if (formData.newPassword !== formData.confirmNewPassword) {
			setErrorMessage("Passwords do not match")
			setIsLoading(false)
			return
		}

		try {
			const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reset-password`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: forgotPasswordEmail,
					code: formData.resetCode,
					newPassword: formData.newPassword,
					confirmPassword: formData.confirmNewPassword
				})
			})

			const data = await res.json()

			if (!res.ok) {
				throw new Error(data.error || "Failed to reset password")
			}

			alert("Password reset successfully! Please sign in with your new password.")
			setForgotPasswordStep(null)
			setForgotPasswordEmail("")
			setFormData({ ...formData, resetCode: "", newPassword: "", confirmNewPassword: "" })
			setActiveTab("signin")
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : "Failed to reset password"
		setErrorMessage(errorMessage)
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className="relative min-h-screen w-full overflow-hidden bg-brand-dark">
			{/* GLOBAL FULL-SCREEN BACKGROUND */}
			<div className="absolute inset-0 z-0">
				<Image
					src="/images/authscreen.png"
					alt="Auth background"
					fill
					priority
					className="object-cover"
				/>
			</div>

			{/* CONTENT LAYER */}
			<div className="relative z-10 flex min-h-screen w-full">
				{/* LEFT SIDE - HERO */}
				<div className="relative hidden w-3/5 flex-col justify-between p-12 lg:flex">
                    <BokehDots className="blur-[1px]" opacity={0.18} />
                    {/* Light overlay */}
				<div className="absolute inset-0 z-5 bg-brand-dark/80" />
				{/* Content */}
				<div className="relative z-10 h-full flex flex-col justify-between pl-5 space-y-4">
						<Logo />

						<div className="space-y-8 max-w-lg">
							<h1 className="text-5xl font-bold leading-tight text-white mb-6">
								Experience God&apos;s Presence on Livestream
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

						<div>
							<blockquote className="text-white/60 italic text-lg mb-2">
								&quot;For where two or three gather in my name, there am I with them.&quot;
							</blockquote>
							<cite className="text-white/40 not-italic block">
								- Matthew 18:20
							</cite>
						</div>
					</div>
				</div>

				{/* RIGHT SIDE - AUTH */}
				<div className="relative flex w-full flex-col items-center justify-center px-4 lg:w-2/5">
                    <BokehDots className="blur-[2px] mix-blend-screen" opacity={0.4} />
                    {/* Strong overlay */}
				<div className="absolute inset-0 z-5 bg-brand-dark" />
				{/* Foreground */}
				<div className="relative z-20 w-full max-w-md space-y-8">
						<div className="text-center lg:text-left">
							<h2 className="text-3xl font-semibold text-white">
								{activeTab === "signin" ? "Welcome Back" : "Create Account"}
							</h2>
							<p className="mt-2 text-white/60">
								{activeTab === "signin" 
									? "Sign in to your account" 
									: signupStep === "verification" 
										? "Enter the code sent to your email"
										: "Join our community today"}
							</p>
						</div>

						<div className="bg-brand-card/20 border border-white/40 rounded-2xl p-6 backdrop-blur-sm">
							{/* Toggle (only show on signin/signup form, not verification/error) */}
							{(activeTab === "signin" || (activeTab === "signup" && signupStep === "form")) && (
								<div className="relative grid grid-cols-2 gap-2 mb-8 bg-black p-1 rounded-lg">
									{/* Sliding background */}
									<div
										className="absolute inset-y-0 left-0 w-1/2 bg-brand-purple rounded-md transition-transform duration-300"
										style={{
											transform: activeTab === "signup" ? "translateX(100%)" : "translateX(0)"
										}}
									/>
									<button
										onClick={() => {
											setActiveTab("signin")
											setErrorMessage("")
											setSignupStep("form")
										}}
										className={`relative z-10 text-sm font-medium py-2 rounded-md transition-colors duration-300 cursor-pointer ${
											activeTab === "signin"
												? "text-white"
												: "text-white/60 hover:text-white"
										}`}
									>
										Sign In
									</button>
									<button
										onClick={() => {
											setActiveTab("signup")
											setErrorMessage("")
											setSignupStep("form")
										}}
										className={`relative z-10 text-sm font-medium py-2 rounded-md transition-colors duration-300 cursor-pointer ${
											activeTab === "signup"
												? "text-white"
												: "text-white/60 hover:text-white"
										}`}
									>
										Sign Up
									</button>
								</div>
							)}

							{/* Verification Code Input */}
							{signupStep === "verification" && (
								<form className="space-y-5" onSubmit={handleVerifyEmail}>
									<div className="space-y-2">
										<Label>Verification Code</Label>
										<Input
											name="verificationCode"
											value={formData.verificationCode}
											onChange={handleChange}
											placeholder="Enter 6-digit code"
											maxLength={6}
											className="bg-black text-center tracking-widest text-2xl"
										/>
										<p className="text-xs text-white/50">
											Code sent to <span className="text-white/70">{pendingEmail}</span>
										</p>
									</div>

									{errorMessage && (
										<div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
											<p className="text-red-300 text-sm">{errorMessage}</p>
										</div>
									)}

									<Button
										type="submit"
										disabled={isLoading || formData.verificationCode.length !== 6}
										className="w-full bg-brand-purple hover:bg-brand-purple/90 h-12"
									>
										{isLoading ? "Verifying..." : "Verify & Create Account"}
									</Button>

									<Button
										type="button"
										onClick={() => {
											setSignupStep("form")
											setErrorMessage("")
										}}
										variant="outline"
										className="w-full border-white/20 text-white hover:bg-white/5"
									>
										Back to Sign Up
									</Button>
								</form>
							)}

							{/* Sign In / Sign Up Form */}
							{(activeTab === "signin" || (activeTab === "signup" && signupStep === "form")) && (
								<form className="space-y-5" onSubmit={handleAuth}>
									{activeTab === "signup" && (
										<div className="space-y-2">
											<Label>Full Name</Label>
											<Input
												name="fullName"
												value={formData.fullName}
												onChange={handleChange}
												placeholder="Enter your full name"
                                            	className="bg-black"
												icon={<User className="w-4 h-4" />}
											/>
										</div>
									)}

									<div className="space-y-2">
										<Label>Email</Label>
										<Input
											name="email"
											type="email"
											value={formData.email}
											onChange={handleChange}
											placeholder="Enter your email"
                                        	className="bg-black"
											icon={<Mail className="w-4 h-4" />}
										/>
									</div>

									<div className="space-y-2">
										<div className="flex justify-between items-center">
											<Label>Password</Label>
											{activeTab === "signin" && (
												<button
													type="button"
													onClick={() => {
														setForgotPasswordStep("email")
														setActiveTab("signin")
														setErrorMessage("")
													}}
													className="text-xs text-brand-purple hover:text-brand-purple/80 transition-colors"
												>
													Forgot?
												</button>
											)}
										</div>
										<div className="relative">
											<Input
												name="password"
												type={showPassword ? "text" : "password"}
												value={formData.password}
												onChange={handleChange}
												placeholder="Enter your password"
												className="pr-10 bg-black"
												icon={<Lock className="w-4 h-4" />}
											/>
											<button
												type="button"
												onClick={() => setShowPassword(!showPassword)}
											className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
											>
												{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
											</button>
										</div>
									</div>

									{activeTab === "signup" && (
										<div className="space-y-2">
											<Label>Confirm Password</Label>
											<div className="relative">
												<Input
													name="confirmPassword"
													type={showConfirmPassword ? "text" : "password"}
													value={formData.confirmPassword}
													onChange={handleChange}
													placeholder="Confirm your password"
													className="pr-10 bg-black"
													icon={<Lock className="w-4 h-4" />}
												/>
												<button
													type="button"
													onClick={() => setShowConfirmPassword(!showConfirmPassword)}
												className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
												>
													{showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
												</button>
											</div>
										</div>
									)}

									{errorMessage && (
										<div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
											<p className="text-red-300 text-sm">{errorMessage}</p>
										</div>
									)}

									<Button
										type="submit"
										disabled={isLoading}
										className="w-full bg-brand-purple hover:bg-brand-purple/90 h-12"
									>
										{isLoading
											? "Processing..."
											: activeTab === "signin"
												? "Sign In"
												: "Continue"}
									</Button>
								</form>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Forgot Password Modal */}
		{forgotPasswordStep && (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
				<div className="relative w-full max-w-md mx-4 bg-brand-dark border border-white/20 rounded-2xl p-8 space-y-6">
					{/* Close Button */}
					<button
						onClick={() => {
							setForgotPasswordStep(null)
							setForgotPasswordEmail("")
							setFormData({ ...formData, resetCode: "", newPassword: "", confirmNewPassword: "" })
							setErrorMessage("")
						}}
						className="absolute top-4 right-4 text-white/40 hover:text-white"
					>
						✕
					</button>

					{/* Email Step */}
					{forgotPasswordStep === "email" && (
						<form className="space-y-5" onSubmit={handleForgotPasswordEmail}>
							<div className="text-center space-y-2">
								<h2 className="text-2xl font-semibold text-white">Reset Password</h2>
								<p className="text-white/60 text-sm">Enter your email to receive a reset code</p>
							</div>

							<div className="space-y-2">
								<Label>Email</Label>
								<Input
									type="email"
									value={forgotPasswordEmail}
									onChange={(e) => setForgotPasswordEmail(e.target.value)}
									placeholder="Enter your email"
									className="bg-black"
									icon={<Mail className="w-4 h-4" />}
								/>
							</div>

							{errorMessage && (
								<div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
									<p className="text-red-300 text-sm">{errorMessage}</p>
								</div>
							)}

							<Button
								type="submit"
								disabled={isLoading || !forgotPasswordEmail}
								className="w-full bg-brand-purple hover:bg-brand-purple/90 h-12"
							>
								{isLoading ? "Sending..." : "Send Reset Code"}
							</Button>
						</form>
					)}

					{/* Code & New Password Step */}
					{forgotPasswordStep === "code" && (
						<form className="space-y-5" onSubmit={handleResetPassword}>
							<div className="text-center space-y-2">
								<h2 className="text-2xl font-semibold text-white">Enter Reset Code</h2>
								<p className="text-white/60 text-sm">
									Code sent to <span className="text-white/80">{forgotPasswordEmail}</span>
								</p>
							</div>

							<div className="space-y-2">
								<Label>Reset Code</Label>
								<Input
									name="resetCode"
									value={formData.resetCode}
									onChange={handleChange}
									placeholder="Enter 6-digit code"
									maxLength={6}
									className="bg-black text-center tracking-widest text-2xl"
								/>
							</div>

							<div className="space-y-2">
								<Label>New Password</Label>
								<Input
									name="newPassword"
									type="password"
									value={formData.newPassword}
									onChange={handleChange}
									placeholder="Enter new password"
									className="bg-black"
									icon={<Lock className="w-4 h-4" />}
								/>
							</div>

							<div className="space-y-2">
								<Label>Confirm New Password</Label>
								<Input
									name="confirmNewPassword"
									type="password"
									value={formData.confirmNewPassword}
									onChange={handleChange}
									placeholder="Confirm new password"
									className="bg-black"
									icon={<Lock className="w-4 h-4" />}
								/>
							</div>

							{errorMessage && (
								<div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
									<p className="text-red-300 text-sm">{errorMessage}</p>
								</div>
							)}

							<Button
								type="submit"
								disabled={isLoading || formData.resetCode.length !== 6}
								className="w-full bg-brand-purple hover:bg-brand-purple/90 h-12"
							>
								{isLoading ? "Resetting..." : "Reset Password"}
							</Button>

							<Button
								type="button"
								onClick={() => setForgotPasswordStep("email")}
								variant="outline"
								className="w-full border-white/20 text-white hover:bg-white/5"
							>
								Back
							</Button>
						</form>
					)}
				</div>
			</div>
		)}

		{/* Error Modal - Not Registered */}
			{showErrorModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="relative w-full max-w-md mx-4 bg-brand-dark border border-white/20 rounded-2xl p-8 space-y-6">
						{/* Header */}
						<div className="text-center space-y-3">
							<div className="flex justify-center">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 border border-red-500/50">
									<AlertCircle className="w-6 h-6 text-red-500" />
								</div>
							</div>
							<h2 className="text-2xl font-semibold text-white">Not a Registered Member</h2>
						</div>

						{/* Message */}
						<div className="space-y-3">
							<p className="text-white/80 text-center">
								{errorMessage || "We couldn't find your email in our registered members list."}
							</p>
							<p className="text-white/60 text-sm text-center">
								To gain access, please reach out to the protocol team at your local or online church.
							</p>
						</div>

						{/* Contact Info */}
						<div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
							<p className="text-xs uppercase tracking-wide text-white/40">Protocol Team</p>
							<p className="text-white font-medium break-all">kingobiomaeze2020@gmail.com</p>
						</div>

						{/* Button */}
						<Button
							onClick={() => {
								setShowErrorModal(false)
								setErrorMessage("")
								setFormData({ fullName: "", email: "", password: "", confirmPassword: "", resetCode: "", newPassword: "", confirmNewPassword: "", verificationCode: "" })
								setActiveTab("signin")
							}}
							className="w-full bg-brand-purple hover:bg-brand-purple/90 h-12"
						>
							Back to Sign In
						</Button>
					</div>
				</div>
			)}
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

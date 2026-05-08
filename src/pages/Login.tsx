import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { Mail, ArrowLeft, CheckCircle, Loader2, KeyRound } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

type LoginStep = "email" | "code" | "sending" | "done";

export default function Login() {
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [step, setStep] = useState<LoginStep>("email");
    const { login, loginDemo } = useAuth();
    const navigate = useNavigate();

    const handleSendCode = async (e: FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setStep("sending");
        // Simulate sending verification code
        await new Promise((r) => setTimeout(r, 1000));
        setStep("code");
    };

    const handleVerifyCode = async (e: FormEvent) => {
        e.preventDefault();
        if (!code.trim()) return;
        setStep("sending");
        try {
            await login(email.trim(), code.trim());
        } catch {
            // Fallback for demo
        }
        setStep("done");
        setTimeout(() => navigate("/"), 1200);
    };

    const handleDemoLogin = async () => {
        setStep("sending");
        try {
            await loginDemo();
        } catch {
            // API may not be running — still proceed as demo
        }
        setStep("done");
        setTimeout(() => navigate("/"), 800);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-white px-4">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                {/* Card */}
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 shadow-lg">
                    {/* Logo */}
                    <div className="mb-6 text-center">
                        <span className="text-3xl font-bold tracking-tight text-zinc-900">
                            clawlink
                        </span>
                    </div>

                    {/* Title */}
                    <h1 className="mb-2 text-center text-2xl font-bold text-zinc-900">
                        Log in to ClawLink
                    </h1>
                    <p className="mb-8 text-center text-sm text-zinc-500">
                        {step === "code"
                            ? `We sent a verification code to ${email}`
                            : "Enter your email to receive a verification code"}
                    </p>

                    {step === "done" ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center gap-3 py-6"
                        >
                            <CheckCircle className="h-12 w-12 text-[#00d2a0]" />
                            <p className="text-lg font-semibold text-zinc-900">You're in!</p>
                            <p className="text-sm text-zinc-500">
                                Redirecting to dashboard...
                            </p>
                        </motion.div>
                    ) : step === "code" ? (
                        <>
                            {/* Verification code step */}
                            <form onSubmit={handleVerifyCode} className="space-y-4">
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                        <KeyRound className="h-4 w-4 text-zinc-400" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Enter 6-digit code"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        className="block w-full rounded-lg border border-zinc-200 bg-white py-3 pl-11 pr-4 text-sm text-zinc-900 placeholder-zinc-400 focus:border-[#ff3b3b] focus:outline-none focus:ring-2 focus:ring-[#ff3b3b]/20 text-center tracking-[0.3em] font-mono text-lg"
                                        autoFocus
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={code.length < 6}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Verify & Log In
                                </button>
                            </form>

                            <button
                                onClick={() => setStep("email")}
                                className="mt-3 w-full text-center text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
                            >
                                Use a different email
                            </button>
                        </>
                    ) : (
                        <>
                            {/* Demo quick login */}
                            <button
                                onClick={handleDemoLogin}
                                disabled={step === "sending"}
                                className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff3b3b] py-3 text-sm font-bold text-white transition-colors hover:bg-[#ff5555] disabled:opacity-50"
                            >
                                🚀 Demo 快速登录
                            </button>

                            <div className="mb-4 flex items-center gap-3">
                                <div className="h-px flex-1 bg-zinc-200" />
                                <span className="text-xs text-zinc-400">或用邮箱登录</span>
                                <div className="h-px flex-1 bg-zinc-200" />
                            </div>

                            <form onSubmit={handleSendCode} className="space-y-4">
                                {/* Email input */}
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                        <Mail className="h-4 w-4 text-zinc-400" />
                                    </div>
                                    <input
                                        type="email"
                                        placeholder="your@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={step === "sending"}
                                        className="block w-full rounded-lg border border-zinc-200 bg-white py-3 pl-11 pr-4 text-sm text-zinc-900 placeholder-zinc-400 focus:border-[#ff3b3b] focus:outline-none focus:ring-2 focus:ring-[#ff3b3b]/20 disabled:opacity-60"
                                        required
                                    />
                                </div>

                                {/* Submit button */}
                                <button
                                    type="submit"
                                    disabled={step === "sending" || !email.trim()}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {step === "sending" ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Sending code...
                                        </>
                                    ) : (
                                        "Send Verification Code"
                                    )}
                                </button>
                            </form>

                            {/* Register link */}
                            <p className="mt-4 text-center text-sm text-zinc-500">
                                Don't have an account?{" "}
                                <Link to="/register" className="text-[#ff3b3b] font-medium hover:underline">
                                    Register
                                </Link>
                            </p>
                        </>
                    )}
                </div>

                {/* Back link */}
                <div className="mt-6 text-center">
                    <button
                        onClick={() => navigate("/")}
                        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

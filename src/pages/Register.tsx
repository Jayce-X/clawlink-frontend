import { useState, FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { claimAgent } from "../services/api";


type RegState = "idle" | "sending" | "sent" | "error";
type ResendState = "idle" | "sending" | "sent" | "error";

export default function Register() {
    const { token } = useParams();
    const [email, setEmail] = useState("");
    const [state, setState] = useState<RegState>("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const [resendState, setResendState] = useState<ResendState>("idle");
    const navigate = useNavigate();

    const isClaimFlow = Boolean(token);

    const handleResend = async () => {
        if (!email.trim()) return;
        setResendState("sending");
        try {
            const res = await fetch("/api/auth/resend-verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim() }),
            });
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json?.error?.message || "Resend failed");
            }
            setResendState("sent");
        } catch {
            setResendState("error");
            setTimeout(() => setResendState("idle"), 3000);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        setState("sending");
        setErrorMessage("");

        try {
            if (isClaimFlow && token) {
                // Claim flow: bind email to the agent via claim token
                const result = await claimAgent(token, email.trim());
                setErrorMessage(result.message || "");
                setState("sent");
            } else {
                // Regular login-link flow
                await new Promise((r) => setTimeout(r, 1200));

                if (email.includes("notfound")) {
                    setErrorMessage(
                        "No account found with this email. If you already have a bot, ask it to set up your account."
                    );
                    setState("error");
                    return;
                }
                setState("sent");
            }
        } catch (err: any) {
            setErrorMessage(err?.message || "Something went wrong. Please try again.");
            setState("error");
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-white px-4">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 shadow-lg">
                    {/* Logo */}
                    <div className="mb-4 flex justify-center">
                        <img src="/claw-mascot.png" alt="claw" className="w-14 h-14" />
                    </div>

                    <h1 className="mb-2 text-center text-2xl font-bold text-zinc-900">
                        {isClaimFlow ? "Claim Your Agent" : "Log in to ClawLink"}
                    </h1>
                    <p className="mb-8 text-center text-sm text-zinc-500">
                        {isClaimFlow
                            ? "Enter your email to bind this agent to your account"
                            : "Manage your bot from the owner dashboard"}
                    </p>

                    {state === "sent" ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center gap-3 py-6"
                        >
                            <CheckCircle className="h-12 w-12 text-[#00d2a0]" />
                            <p className="text-lg font-semibold text-zinc-900">
                                {isClaimFlow ? "Claim Submitted!" : "Check your inbox!"}
                            </p>
                            <p className="text-sm text-zinc-500 text-center">
                                {isClaimFlow
                                    ? (<>Verification email sent to <strong className="text-zinc-900">{email}</strong>. Please check your inbox to complete registration.</>)
                                    : (<>We sent a login link to <strong className="text-zinc-900">{email}</strong></>)}
                            </p>
                            {isClaimFlow && (
                                <button
                                    onClick={handleResend}
                                    disabled={resendState === "sending" || resendState === "sent"}
                                    className="mt-2 text-sm font-medium text-[#ff3b3b] hover:text-[#ff5555] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {resendState === "sending" ? "Sending..." :
                                        resendState === "sent" ? "✓ Email resent!" :
                                            resendState === "error" ? "Failed, try again" :
                                                "Didn't receive the email? Resend"}
                                </button>
                            )}
                        </motion.div>
                    ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Email input */}
                            <input
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (state === "error") setState("idle");
                                }}
                                disabled={state === "sending"}
                                className="block w-full rounded-lg border border-zinc-200 bg-white py-3.5 px-4 text-sm text-zinc-900 placeholder-zinc-400 focus:border-[#ff3b3b] focus:outline-none focus:ring-2 focus:ring-[#ff3b3b]/20 disabled:opacity-60"
                                required
                            />

                            {/* Error message */}
                            {state === "error" && errorMessage && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="rounded-lg border border-[#ff3b3b]/30 bg-[#ff3b3b]/10 px-4 py-3 text-sm text-[#ff3b3b] leading-relaxed"
                                >
                                    {errorMessage}
                                </motion.div>
                            )}

                            {/* Submit button */}
                            <button
                                type="submit"
                                disabled={state === "sending" || !email.trim()}
                                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ff3b3b] py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#ff5555] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {state === "sending" ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {isClaimFlow ? "Binding..." : "Sending..."}
                                    </>
                                ) : (
                                    isClaimFlow ? "Bind Email & Claim" : "Send Login Link"
                                )}
                            </button>
                        </form>
                    )}

                    {/* Info note */}
                    <p className="mt-6 text-xs text-zinc-400 leading-relaxed text-center">
                        You'll receive an email with a link. After clicking it, you'll verify your email address to prove you own the bot.
                    </p>
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

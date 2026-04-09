import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { CheckCircle, XCircle, Loader2, ArrowLeft, Copy, Check } from "lucide-react";

type VerifyState = "loading" | "success" | "error";

interface VerifyResult {
    agent_id?: string;
    email?: string;
    message?: string;
}

export default function Verify() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [state, setState] = useState<VerifyState>("loading");
    const [result, setResult] = useState<VerifyResult>({});
    const [errorMsg, setErrorMsg] = useState("");
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText("Claim completed");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Robust token extraction — handles URL-encoded "=" (%3D)
    const getToken = (): string | null => {
        // Try standard way first
        const t = searchParams.get("token");
        if (t) return t;

        // Fallback: parse from raw URL (handles %3D encoding)
        const raw = decodeURIComponent(window.location.search);
        const match = raw.match(/[?&]token=([^&]+)/);
        if (match) return match[1];

        // Another fallback: check full href
        const hrefMatch = decodeURIComponent(window.location.href).match(/[?&]token=([^&]+)/);
        return hrefMatch ? hrefMatch[1] : null;
    };

    const token = getToken();

    useEffect(() => {
        if (!token) {
            setState("error");
            setErrorMsg("Missing verification token.");
            return;
        }

        const verify = async () => {
            try {
                const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
                const json = await res.json();

                if (!res.ok) {
                    setState("error");
                    setErrorMsg(json?.error?.message || "Verification failed.");
                    return;
                }

                setResult(json.data || {});
                setState("success");
            } catch {
                setState("error");
                setErrorMsg("Network error. Please try again.");
            }
        };

        verify();
    }, [token]);

    return (
        <div className="flex min-h-[80vh] items-center justify-center px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg"
            >
                <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-zinc-100">
                    {/* Loading */}
                    {state === "loading" && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <Loader2 className="h-12 w-12 animate-spin text-zinc-400" />
                            <p className="text-sm text-zinc-500">Verifying your email...</p>
                        </div>
                    )}

                    {/* Success */}
                    {state === "success" && (
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                                <CheckCircle className="h-10 w-10 text-emerald-500" />
                            </div>

                            <h1 className="text-2xl font-bold text-zinc-900">
                                Claim Successful!
                            </h1>

                            <p className="text-sm text-zinc-500 leading-relaxed">
                                Your email <strong className="text-zinc-700">{result.email}</strong> has been verified and the Agent has been claimed.
                            </p>

                            {/* Step-by-step guide */}
                            <div className="mt-2 w-full rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-5 text-left">
                                <div className="flex items-start gap-3 mb-4">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                                    <div>
                                        <h3 className="text-[15px] font-bold text-zinc-900">Copy the message below</h3>
                                        <p className="text-xs text-zinc-500 mt-0.5">Click the button to copy it to your clipboard</p>
                                    </div>
                                </div>

                                {/* Copy block */}
                                <div
                                    className="rounded-lg bg-zinc-900 px-5 py-3.5 font-mono text-sm text-[#00d2a0] flex items-center justify-between cursor-pointer hover:bg-zinc-800 transition-all active:scale-[0.98] mb-4"
                                    onClick={handleCopy}
                                    title="Click to copy"
                                >
                                    <span className="font-semibold">Claim completed</span>
                                    <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}>
                                        {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                                    </button>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                                    <div>
                                        <h3 className="text-[15px] font-bold text-zinc-900">Send it to your Agent to finish the claim</h3>
                                        <p className="text-xs text-zinc-500 mt-0.5">Your Agent will then set up your profile and generate your avatar.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {state === "error" && (
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                                <XCircle className="h-10 w-10 text-red-400" />
                            </div>

                            <h1 className="text-2xl font-bold text-zinc-900">
                                Verification Failed
                            </h1>

                            <p className="text-sm text-red-500 leading-relaxed">
                                {errorMsg}
                            </p>

                            <p className="text-xs text-zinc-400 leading-relaxed">
                                This link may have expired or already been used. Please ask your Agent to register again.
                            </p>
                        </div>
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

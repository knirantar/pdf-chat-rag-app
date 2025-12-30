import { GoogleLogin } from "@react-oauth/google";
import { useEffect, useState } from "react";

export default function LandingPage({ onLoginSuccess }) {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        setReady(true); // ensures client-side render
    }, []);

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <h1 className="text-lg font-semibold tracking-wide">📄 PDF Chat</h1>
                <span className="text-sm text-white/50">
                    AI-powered document assistant
                </span>
            </header>

            {/* Hero */}
            <main className="flex-1 flex items-center justify-center px-6">
                <div className="max-w-3xl text-center space-y-6">

                    <h2 className="text-4xl font-bold leading-tight">
                        Chat with your PDFs.
                        <br />
                        <span className="text-indigo-400">
                            Ask questions. Get answers instantly.
                        </span>
                    </h2>

                    <p className="text-white/70 text-lg">
                        Upload PDFs and interact with them using AI.
                        Get summaries, explanations, references, and precise answers.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mt-8">
                        <Feature title="🔍 Ask Anything" desc="Natural language questions" />
                        <Feature title="📌 Source-aware" desc="Exact PDF references" />
                        <Feature title="🔐 Secure" desc="Private Google login sessions" />
                    </div>

                    {/* CTA */}
                    <div className="pt-8 flex justify-center min-h-[44px]">
                        {ready && (
                            <GoogleLogin
                                onSuccess={onLoginSuccess}
                                onError={() => alert("Login failed")}
                            />
                        )}
                    </div>

                    <p className="text-xs text-white/40 pt-4">
                        Your PDFs stay private.
                    </p>
                </div>
            </main>

            <footer className="text-center text-xs text-white/40 py-4 border-t border-white/10">
                Built with ❤️ using FastAPI, FAISS & LLMs
            </footer>
        </div>
    );
}

function Feature({ title, desc }) {
    return (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-white/60 mt-1">{desc}</p>
        </div>
    );
}

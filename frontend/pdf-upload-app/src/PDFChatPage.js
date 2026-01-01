import React, { useState, useRef, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Upload } from "lucide-react";
import { jwtDecode } from "jwt-decode";

import Sidebar from "./components/Sidebar";
import MessageList from "./components/MessageList";
import InputBar from "./components/InputBar";

export default function ChatPdf({ onLogout }) {
    const token = localStorage.getItem("app_token");
    const user = token ? jwtDecode(token) : null;

    const conversationId = useRef(uuidv4());
    const messagesEndRef = useRef(null);
    const summaryStartedRef = useRef(null);

    const [activePdf, setActivePdf] = useState(null);
    const [pdfs, setPdfs] = useState([]);

    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]);

    const [uploading, setUploading] = useState(false);
    const [asking, setAsking] = useState(false);
    const [answerMode, setAnswerMode] = useState("strict");
    const [expandedSources, setExpandedSources] = useState({});
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Suggestions
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);

    const chatKey = user ? `chatSession_${user.email}` : null;
    const API_URL = process.env.REACT_APP_API_URL;

    /* ---------------- RESTORE CHAT ---------------- */
    useEffect(() => {
        if (!chatKey) return;
        const saved = localStorage.getItem(chatKey);
        if (!saved) return;

        const parsed = JSON.parse(saved);
        setMessages(parsed.messages || []);
        conversationId.current = parsed.conversationId || uuidv4();

        if (parsed.activePdfId) {
            setActivePdf({ id: parsed.activePdfId });
        }
    }, [chatKey]);

    useEffect(() => {
        if (!chatKey) return;
        localStorage.setItem(chatKey, JSON.stringify({
            messages,
            conversationId: conversationId.current,
            activePdfId: activePdf?.id || null
        }));
    }, [messages, activePdf, chatKey]);

    /* ---------------- LOAD PDFs ---------------- */
    useEffect(() => {
        if (!token) return;

        fetch(`${API_URL}/pdfs/`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                const mapped = data.map(p => ({
                    id: p.id,
                    name: p.name,
                    indexed: p.indexed,
                    indexing: p.indexing ?? false
                }));

                setPdfs(mapped);

                // 🔥 Restore active PDF correctly AFTER pdfs are loaded
                const saved = localStorage.getItem(chatKey);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.activePdfId) {
                        const restored = mapped.find(p => p.id === parsed.activePdfId);
                        if (restored) {
                            setActivePdf(restored); // now has full object including 'indexed'
                        }
                    }
                }
            })
            .catch(console.error);
    }, [API_URL, chatKey, token]);


    /* ---------------- RESET CHAT ---------------- */
    const resetChat = () => {
        conversationId.current = uuidv4();
        setMessages([]);
        setLoadingSummary(false);
        summaryStartedRef.current = null;
    };

    /* ---------------- UPLOAD PDF ---------------- */
    const uploadPdf = async (file) => {
        if (!file) return;
        setUploading(true);

        const tempId = `pending-${uuidv4()}`;
        setPdfs(p => [...p, { id: tempId, name: file.name, indexing: true }]);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch(`${API_URL}/upload-pdf`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();

            const newPdf = {
                id: data.pdf_id,
                name: file.name,
                indexed: true,
                indexing: false
            };

            setPdfs(p => p.map(x => x.id === tempId ? newPdf : x));
            setActivePdf(newPdf);
            resetChat();

        } finally {
            setUploading(false);
        }
    };

    /* ---------------- ASK QUESTION ---------------- */
    const askQuestion = async () => {
        if (!question.trim() || !activePdf) return;

        const q = question;
        setQuestion("");
        setMessages(p => [...p, { role: "user", content: q }]);
        setAsking(true);

        try {
            const res = await fetch(`${API_URL}/ask`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    question: q,
                    pdf_id: activePdf.id,
                    conversation_id: conversationId.current,
                    answer_mode: answerMode
                })
            });

            const data = await res.json();
            setMessages(p => [...p, {
                role: "assistant",
                content: data.messages?.[0]?.content || "No answer",
                sources: data.sources || []
            }]);
        } finally {
            setAsking(false);
        }
    };

    /* ---------------- SUMMARY APIs ---------------- */
    const getPdfSummary = useCallback(async (id) => {
        const res = await fetch(`${API_URL}/summaries/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Not ready");
        return res.json();
    }, [API_URL, token]);

    const generatePdfSummary = useCallback(async (id) => {
        await fetch(`${API_URL}/summaries/${id}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        });
    }, [API_URL, token]);

    const refreshSuggestions = async () => {
        if (!activePdf) return;

        setLoadingSummary(true);
        try {
            // ✅ Call the regenerate endpoint
            await fetch(`${API_URL}/summaries/${activePdf.id}/regenerate`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            // Fetch updated suggestions from GET endpoint
            const res = await fetch(`${API_URL}/summaries/${activePdf.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Failed to fetch suggestions after regeneration");

            const data = await res.json();
            setSuggestions(data.suggested_questions || []);
        } catch (err) {
            console.error("Failed to refresh suggestions", err);
        } finally {
            setLoadingSummary(false);
        }
    };



    /* ---------------- SUMMARY FLOW ---------------- */
    useEffect(() => {
        if (!activePdf) return;
        if (!showSuggestions) return;

        const fullPdf = pdfs.find(p => p.id === activePdf.id);
        if (!fullPdf?.indexed) return; // only proceed if the PDF is actually indexed

        setLoadingSummary(true);

        getPdfSummary(activePdf.id)
            .then(res => setSuggestions(res.suggested_questions || []))
            .catch(async () => {
                await generatePdfSummary(activePdf.id);
                const res = await getPdfSummary(activePdf.id);
                setSuggestions(res.suggested_questions || []);
            })
            .finally(() => setLoadingSummary(false));

    }, [activePdf, activePdf?.id, pdfs, showSuggestions, getPdfSummary, generatePdfSummary]);



    /* ---------------- UI ---------------- */
    return (
        <div className="flex h-[100dvh] bg-zinc-900 text-white overflow-hidden">

            <Sidebar
                files={pdfs}
                activePdf={activePdf}
                setActivePdf={(pdf) => {
                    if (pdf.indexing) return;
                    setActivePdf(pdf);
                    resetChat();
                    setSidebarOpen(false);
                }}
                answerMode={answerMode}
                setAnswerMode={setAnswerMode}
                uploading={uploading}
                user={user}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                resetChat={resetChat}
            />

            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-30 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <main className="flex-1 flex flex-col">

                {/* HEADER */}
                <header className="p-4 border-b border-white/10 flex gap-4">
                    <button className="md:hidden" onClick={() => setSidebarOpen(true)}>☰</button>

                    <label className="cursor-pointer flex items-center gap-2 bg-white/10 px-3 py-2 rounded">
                        <Upload size={16} /> Upload PDF
                        <input hidden type="file" accept="application/pdf"
                            onChange={(e) => uploadPdf(e.target.files[0])} />
                    </label>

                    <div className="ml-auto flex items-center gap-3">
                        <img src={user.picture} className="w-8 h-8 rounded-full" />
                        <div className="text-xs text-right">
                            <div className="font-semibold">{user.name}</div>
                            <div>{user.email}</div>
                        </div>
                        <button onClick={onLogout} className="bg-red-600 px-3 py-1 rounded text-xs">
                            Logout
                        </button>
                    </div>
                </header>

                <section className="flex-1 overflow-y-auto p-4 pb-28">
                    <MessageList
                        messages={messages}
                        expandedSources={expandedSources}
                        toggleSources={(i) =>
                            setExpandedSources(p => ({ ...p, [i]: !p[i] }))
                        }
                    />

                    {loadingSummary && (
                        <div className="mt-6 text-sm text-white/50">
                            🧠 Generating smart questions…
                        </div>
                    )}

                    {suggestions.length > 0 && (
                        <>
                            <div className="flex gap-2 mt-6">
                                <button
                                    className="text-xs text-purple-400"
                                    onClick={() => setShowSuggestions(v => !v)}
                                >
                                    {showSuggestions ? "Hide Smart Suggestions" : "Show Smart Suggestions"}
                                </button>

                                <button
                                    className="text-xs text-green-400 flex items-center gap-1"
                                    onClick={refreshSuggestions}
                                    disabled={loadingSummary}
                                >
                                    {loadingSummary ? (
                                        <>
                                            <svg
                                                className="animate-spin h-4 w-4 text-green-400"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                ></circle>
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                                ></path>
                                            </svg>
                                            Refreshing...
                                        </>
                                    ) : (
                                        <>🔄 Refresh Suggestions</>
                                    )}
                                </button>
                            </div>

                            {showSuggestions && (
                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {suggestions.map((q, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setQuestion(q)}
                                            className="bg-white/10 px-3 py-2 rounded text-left text-sm"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}



                    <div ref={messagesEndRef} />
                </section>

                <footer className="border-t border-white/10 p-3">
                    <InputBar
                        question={question}
                        setQuestion={setQuestion}
                        asking={asking}
                        askQuestion={askQuestion}
                    />
                </footer>

            </main>
        </div>
    );
}

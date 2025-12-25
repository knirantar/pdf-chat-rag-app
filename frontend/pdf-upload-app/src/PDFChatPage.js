import React, { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Upload, Send, Plus, FileText, Loader2 } from "lucide-react";
import { jwtDecode } from "jwt-decode";



export default function ChatPdf({ onLogout }) {
    const getAuthHeaders = () => ({
        Authorization: `Bearer ${localStorage.getItem("app_token")}`,
    });
    const token = localStorage.getItem("app_token");
    const user = token ? jwtDecode(token) : null;

    const conversationId = useRef(uuidv4());
    const messagesEndRef = useRef(null);

    const [file, setFile] = useState(null);
    const [activePdf, setActivePdf] = useState(null);
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [asking, setAsking] = useState(false);
    const [answerMode, setAnswerMode] = useState("strict");
    const [expandedSources, setExpandedSources] = useState({});
    const API_URL = process.env.REACT_APP_API_URL;
    const chatKey = user ? `chatSession_${user.email}` : null;

    // Load saved session on mount
    useEffect(() => {
        if (!chatKey) return;
        const savedSession = localStorage.getItem(chatKey);
        if (savedSession) {
            const { activePdf: pdf, messages: msgs, conversationId: convId } = JSON.parse(savedSession);
            if (pdf) setActivePdf(pdf);
            if (msgs) setMessages(msgs);
            if (convId) conversationId.current = convId;
        }
    }, [chatKey]);

    // Save session to localStorage whenever messages or activePdf change
    useEffect(() => {
        if (!chatKey) return;
        localStorage.setItem(
            chatKey,
            JSON.stringify({
                activePdf,
                messages,
                conversationId: conversationId.current,
            })
        );
    }, [activePdf, messages, chatKey]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const uploadPdf = async () => {
        if (!file) return;
        setUploading(true);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch(`${API_URL}/upload-pdf`, {
                method: "POST",
                headers: {
                    ...getAuthHeaders()
                },
                body: formData,
            });

            const data = await res.json();
            setActivePdf({ id: data.pdf_id, name: file.name });
            setMessages([]); // clear previous messages on new PDF
            setFile(null);
        } catch {
            alert("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const askQuestion = async () => {
        if (!question.trim() || !activePdf) return;

        const userMsg = { role: "user", content: question };
        setMessages((m) => [...m, userMsg]);

        const assistantIndex = messages.length + 1;
        setMessages((m) => [...m, { role: "assistant", content: "" }]);

        setQuestion("");
        setAsking(true);

        const res = await fetch(`/api/ask-stream`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("app_token")}`,
            },
            body: JSON.stringify({
                question,
                pdf_id: activePdf.id,
                conversation_id: conversationId.current,
                answer_mode: answerMode,
            }),
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const parts = buffer.split("\n\n");
            buffer = parts.pop();

            for (const part of parts) {
                if (!part.startsWith("data:")) continue;

                const token = part.replace("data:", "");

                if (token === "[DONE]") {
                    setAsking(false);
                    return;
                }

                setMessages((prev) => {
                    const updated = [...prev];
                    updated[assistantIndex] = {
                        ...updated[assistantIndex],
                        content: updated[assistantIndex].content + token,
                    };
                    return updated;
                });
            }
        }

        setAsking(false);
    };


    const resetChat = () => {
        conversationId.current = uuidv4();
        setMessages([]);
    };

    const toggleSources = (index) => {
        setExpandedSources((prev) => ({
            ...prev,
            [index]: !prev[index],
        }));
    };

    useEffect(() => {
        // On fresh login, start clean
        setMessages([]);
        setActivePdf(null);
        conversationId.current = uuidv4();
    }, []);


    return (
        <div className="flex h-screen bg-zinc-900 text-white">
            <aside className="w-64 bg-zinc-800 border-r border-white/10 flex flex-col">
                <div className="p-4 border-b border-white/10">
                    <button
                        onClick={resetChat}
                        className="w-full flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
                    >
                        <Plus size={18} /> New Chat
                    </button>
                </div>

                <div className="flex-1 p-4 overflow-y-auto text-sm">
                    <p className="text-white/40 mb-2">Active Document</p>
                    {activePdf ? (
                        <div className="flex items-start gap-2 bg-white/10 p-2 rounded">
                            <FileText size={16} className="text-emerald-400" />
                            <span className="break-words">{activePdf.name}</span>
                        </div>
                    ) : (
                        <p className="text-white/40">No document loaded</p>
                    )}
                </div>

                <div className="p-4 border-t border-white/10">
                    <p className="text-white/40 text-xs mb-2">Answer Mode</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setAnswerMode("strict")}
                            className={`flex-1 py-1 rounded text-xs ${answerMode === "strict" ? "bg-blue-600" : "bg-white/10 hover:bg-white/20"
                                }`}
                        >
                            📄 Document
                        </button>
                        <button
                            onClick={() => setAnswerMode("hybrid")}
                            className={`flex-1 py-1 rounded text-xs ${answerMode === "hybrid" ? "bg-purple-600" : "bg-white/10 hover:bg-white/20"
                                }`}
                        >
                            🧠 Hybrid
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col">
                {/* Header */}
                <header className="p-4 border-b border-white/10 flex items-center gap-4">
                    {/* Upload */}
                    <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-white/10 rounded hover:bg-white/20">
                        <Upload size={16} /> Upload PDF
                        <input
                            type="file"
                            accept="application/pdf"
                            hidden
                            onChange={(e) => setFile(e.target.files[0])}
                        />
                    </label>

                    {file && !uploading && (
                        <button
                            onClick={uploadPdf}
                            className="px-4 py-2 bg-emerald-600 rounded hover:bg-emerald-700"
                        >
                            Index PDF
                        </button>
                    )}

                    {uploading && (
                        <span className="flex items-center gap-2 text-sm text-white/60">
                            <Loader2 className="animate-spin" size={16} /> Indexing...
                        </span>
                    )}

                    {/* Spacer */}
                    <div className="ml-auto flex items-center gap-3">
                        {user && (
                            <>
                                <img
                                    src={user.picture}
                                    alt="profile"
                                    className="w-8 h-8 rounded-full border border-white/20"
                                />
                                <div className="text-right text-xs leading-tight">
                                    <div className="font-medium">{user.name}</div>
                                    <div className="text-white/50">{user.email}</div>
                                </div>
                            </>
                        )}

                        <button
                            onClick={onLogout}
                            className="ml-3 px-3 py-1 text-xs bg-red-600 rounded hover:bg-red-700"
                        >
                            Logout
                        </button>
                    </div>
                </header>



                <section className="flex-1 overflow-y-auto scrollbar p-6">
                    <div className="mx-auto max-w-3xl space-y-4">
                        {messages.length === 0 && (
                            <div className="text-center text-white/40 mt-20">
                                <p className="text-lg">Upload a PDF to get started</p>
                            </div>
                        )}

                        {messages.map((m, i) => (
                            <div
                                key={i}
                                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[80%] px-4 py-3 rounded-lg ${m.role === "user" ? "bg-blue-600 text-white" : "bg-zinc-800 text-white"
                                        }`}
                                >
                                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>

                                    {m.role === "assistant" && m.confidence !== undefined && (
                                        <div className="mt-3 text-xs text-white/60">
                                            Confidence:{" "}
                                            <span className="font-medium">{(m.confidence * 100).toFixed(1)}%</span>
                                        </div>
                                    )}

                                    {m.role === "assistant" && Array.isArray(m.sources) && m.sources.length > 0 && (
                                        <div className="mt-2">
                                            <button
                                                onClick={() => toggleSources(i)}
                                                className="text-xs text-blue-400 hover:underline"
                                            >
                                                {expandedSources[i] ? "Hide sources ▼" : "Show sources ▲"}
                                            </button>

                                            {expandedSources[i] && (
                                                <div className="mt-2 space-y-2 text-xs text-white/70 border-l border-white/10 pl-3">
                                                    {m.sources.map((src, sIdx) => (
                                                        <div key={sIdx} className="leading-snug">
                                                            <div className="italic">{src.text ?? JSON.stringify(src)}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {asking && (
                            <div className="flex items-center gap-2 text-white/40">
                                <Loader2 className="animate-spin" size={16} /> Thinking...
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </section>

                {/* Input */}
                <footer className="p-4 border-t border-white/10 flex gap-2">
                    <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                askQuestion();
                            }
                        }}
                        placeholder="Ask something about the PDF..."
                        className="flex-1 min-h-[44px] resize-none rounded-lg bg-zinc-800 p-3 leading-6 outline-none"
                        rows={1}
                    />
                    <button
                        onClick={askQuestion}
                        disabled={asking}
                        className="w-10 h-10 bg-white text-black rounded-lg flex items-center justify-center hover:bg-white/90"
                    >
                        <Send size={18} />
                    </button>
                </footer>
            </main>
        </div>
    );
}
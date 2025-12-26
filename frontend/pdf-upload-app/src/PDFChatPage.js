import React, { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Upload } from "lucide-react";
import { jwtDecode } from "jwt-decode";

import Sidebar from "./components/Sidebar";
import MessageList from "./components/MessageList";
import InputBar from "./components/InputBar";

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
    const assistantIndexRef = useRef(null);
    const [pdfs, setPdfs] = useState([]);

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

    const uploadPdf = async (selectedFile = file) => {
        if (!selectedFile) return;
        setUploading(true);

        // create placeholder entry so sidebar shows indexing state immediately
        const tempId = `pending-${uuidv4()}`;
        setPdfs((prev) => [...prev, { id: tempId, name: selectedFile.name, indexing: true }]);

        try {
            const formData = new FormData();
            formData.append("file", selectedFile);

            const res = await fetch(`${API_URL}/upload-pdf`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: formData,
            });

            const data = await res.json();

            // update placeholder entry with actual pdf_id and indexing status
            const indexed = typeof data.message === "string" && (data.message.toLowerCase().includes("indexed successfully") || data.message.toLowerCase().includes("reusing existing index"));
            setPdfs((prev) =>
                prev.map((p) =>
                    p.id === tempId
                        ? { id: data.pdf_id, name: selectedFile.name, indexing: false, indexed }
                        : p
                )
            );

            // if indexed immediately, set active
            if (indexed) {
                setActivePdf({ id: data.pdf_id, name: selectedFile.name });
                setMessages([]);
            } else {
                // leave as not-active until indexing completes (server returned message that indicates background indexing)
                alert("PDF uploaded. Indexing in background — it will appear in Documents when ready.");
            }

            setFile(null);
        } catch {
            alert("Upload failed");
            setPdfs((prev) => prev.filter((p) => p.id !== tempId));
        } finally {
            setUploading(false);
        }
    };

    const askQuestion = async () => {
        if (!question.trim() || !activePdf) return;

        const userMsg = { role: "user", content: question };

        let assistantIdx;

        setMessages((prev) => {
            const next = [...prev, userMsg, { role: "assistant", content: "" }];
            assistantIdx = next.length - 1;
            assistantIndexRef.current = assistantIdx;
            return next;
        });

        setQuestion("");
        setAsking(true);

        try {
            const res = await fetch(`${API_URL}/ask-stream`, {
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
                const parts = buffer.split("\n");
                buffer = parts.pop();

                for (const part of parts) {
                    if (!part.startsWith("data:")) continue;

                    let token = part.replace(/^data:\s?/, "").trim();

                    if (token === "[DONE]") {
                        // stream finished
                        break;
                    }

                    // If backend sends JSON metadata events, parse and attach
                    let parsed = null;
                    try {
                        parsed = JSON.parse(token);
                    } catch (e) {
                        parsed = null;
                    }

                    if (parsed && typeof parsed === "object") {
                        setMessages((prev) => {
                            const updated = [...prev];
                            const cur = updated[assistantIndexRef.current] || { role: "assistant", content: "" };

                            if (parsed.text) {
                                cur.content = (cur.content || "") + parsed.text;
                            }

                            if (parsed.sources) {
                                cur.sources = parsed.sources;
                            }

                            if (parsed.confidence !== undefined) {
                                cur.confidence = parsed.confidence;
                            }

                            updated[assistantIndexRef.current] = cur;
                            return updated;
                        });
                        continue;
                    }
                    else {
                        // treat as normal token text
                        setMessages((prev) => {
                            const updated = [...prev];
                            const cur = updated[assistantIndexRef.current] || { role: "assistant", content: "" };
                            cur.content = (cur.content || "") + token;
                            updated[assistantIndexRef.current] = cur;
                            return updated;
                        });
                    }
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setAsking(false);
        }
    };

    const resetChat = () => {
        conversationId.current = uuidv4();
        setMessages([]);
        setActivePdf(null);
    };


    const toggleSources = (index) => {
        setExpandedSources((prev) => ({
            ...prev,
            [index]: !prev[index],
        }));
    };


    return (
        <div className="flex h-screen bg-zinc-900 text-white">
            <Sidebar
                files={pdfs}
                activePdf={activePdf}
                setActivePdf={(pdf) => {
                    setActivePdf(pdf);
                    conversationId.current = uuidv4();
                    setMessages([]);
                }}
                answerMode={answerMode}
                setAnswerMode={setAnswerMode}
                uploading={uploading}
                resetChat={resetChat}
                user={user}
            />

            <main className="flex-1 flex flex-col">
                {/* Header */}
                <header className="p-4 border-b border-white/10 flex items-center gap-4">
                    {/* left header group kept minimal - you can move more here if desired */}
                    <div className="flex items-center gap-2">
                        <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-white/10 rounded hover:bg-white/20">
                            <Upload size={16} /> Upload PDF
                            <input
                                type="file"
                                accept="application/pdf"
                                hidden
                                onChange={(e) => {
                                    const selected = e.target.files[0];
                                    if (!selected) return;
                                    setFile(selected);
                                    uploadPdf(selected);
                                }}
                            />
                        </label>
                    </div>

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
                        <MessageList
                            messages={messages}
                            expandedSources={expandedSources}
                            toggleSources={toggleSources}
                        />
                    </div>
                    <div ref={messagesEndRef} />
                </section>

                <footer className="p-4 border-t border-white/10">
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

import React, { useState, useRef, useEffect } from "react";
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

    const [file, setFile] = useState(null);
    const [activePdf, setActivePdf] = useState(null);
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [asking, setAsking] = useState(false);
    const [answerMode, setAnswerMode] = useState("strict");
    const [expandedSources, setExpandedSources] = useState({});
    const [pdfs, setPdfs] = useState([]);

    const API_URL = process.env.REACT_APP_API_URL;
    const chatKey = user ? `chatSession_${user.email}` : null;

    /* -------------------- SESSION RESTORE -------------------- */
    useEffect(() => {
        if (!chatKey) return;
        const saved = localStorage.getItem(chatKey);
        if (saved) {
            const { activePdf, messages, conversationId: cid } = JSON.parse(saved);
            if (activePdf) setActivePdf(activePdf);
            if (messages) setMessages(messages);
            if (cid) conversationId.current = cid;
        }
    }, [chatKey]);

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

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    /* -------------------- LOAD PDFs -------------------- */
    useEffect(() => {
        if (!token) return;

        fetch(`${API_URL}/pdfs/`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) =>
                setPdfs(
                    data.map((p) => ({
                        id: p.id,
                        name: p.name,
                        indexing: !p.indexed, // 🔥 THIS IS THE FIX
                    }))
                )
            )
            .catch(console.error);
    }, [API_URL, token]);


    /* -------------------- UPLOAD -------------------- */
    const uploadPdf = async (selectedFile) => {
        if (!selectedFile) return;
        setUploading(true);

        const tempId = `pending-${uuidv4()}`;
        setPdfs((p) => [...p, { id: tempId, name: selectedFile.name, indexing: true }]);

        try {
            const formData = new FormData();
            formData.append("file", selectedFile);

            const res = await fetch(`${API_URL}/upload-pdf`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            const data = await res.json();
            const indexed = data.message?.toLowerCase().includes("indexed");

            setPdfs((prev) =>
                prev.map((p) =>
                    p.id === tempId
                        ? { id: data.pdf_id, name: selectedFile.name, indexing: false }
                        : p
                )
            );


            if (indexed) {
                setActivePdf({ id: data.pdf_id, name: selectedFile.name });
                setMessages([]);
            }
        } catch {
            alert("Upload failed");
            setPdfs((p) => p.filter((x) => x.id !== tempId));
        } finally {
            setUploading(false);
        }
    };

    /* -------------------- ASK (NON-STREAM) -------------------- */
    const askQuestion = async () => {
        if (!question.trim() || !activePdf) return;

        const userMsg = { role: "user", content: question };
        setMessages((prev) => [...prev, userMsg]);
        setQuestion("");
        setAsking(true);

        try {
            const res = await fetch(`${API_URL}/ask`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    question,
                    pdf_id: activePdf.id,
                    conversation_id: conversationId.current,
                    answer_mode: answerMode,
                }),
            });

            const data = await res.json();

            const assistantMsg = {
                role: "assistant",
                content: data.messages?.[0]?.content || "No answer",
                sources: data.sources || [],
                confidence: data.confidence ?? null,
            };

            setMessages((prev) => [...prev, assistantMsg]);
        } catch (err) {
            console.error(err);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Something went wrong." },
            ]);
        } finally {
            setAsking(false);
        }
    };

    /* -------------------- RESET -------------------- */
    const resetChat = () => {
        conversationId.current = uuidv4();
        setMessages([]);
        setActivePdf(null);
    };

    const toggleSources = (index) => {
        setExpandedSources((p) => ({ ...p, [index]: !p[index] }));
    };

    /* -------------------- UI -------------------- */
    return (
        <div className="flex h-screen bg-zinc-900 text-white">
            <Sidebar
                files={pdfs}
                activePdf={activePdf}
                setActivePdf={(pdf) => {
                    if (pdf.indexing) return;
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
                <header className="p-4 border-b border-white/10 flex items-center gap-4">
                    <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-white/10 rounded">
                        <Upload size={16} /> Upload PDF
                        <input
                            type="file"
                            accept="application/pdf"
                            hidden
                            onChange={(e) => uploadPdf(e.target.files[0])}
                        />
                    </label>

                    <div className="ml-auto flex items-center gap-3">
                        {user && (
                            <>
                                <img src={user.picture} alt="profile" className="w-8 h-8 rounded-full" />
                                <div className="text-xs text-right">
                                    <div>{user.name}</div>
                                    <div className="text-white/50">{user.email}</div>
                                </div>
                            </>
                        )}
                        <button onClick={onLogout} className="px-3 py-1 text-xs bg-red-600 rounded">
                            Logout
                        </button>
                    </div>
                </header>

                <section className="flex-1 overflow-y-auto p-6">
                    <MessageList
                        messages={messages}
                        expandedSources={expandedSources}
                        toggleSources={toggleSources}
                    />
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

import { Plus, FileText, Loader2 } from "lucide-react";

export default function Sidebar({
    files = [],
    activePdf,
    setActivePdf,
    uploadPdf,
    uploading,
    resetChat,
    user,
    answerMode,
    setAnswerMode,
}) {
    return (
        <aside className="w-64 bg-zinc-800 border-r border-white/10 flex flex-col">
            <div className="p-4 border-b border-white/10 space-y-2">
                <button
                    onClick={resetChat}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
                >
                    <Plus size={18} /> New Chat
                </button>

                <div className="flex gap-2">
                    <button
                        onClick={() => setAnswerMode("strict")}
                        className={`flex-1 px-2 py-1 rounded text-xs border ${
                            answerMode === "strict"
                                ? "bg-blue-600 border-blue-500 text-white"
                                : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                        }`}
                    >
                        📄 Document
                    </button>

                    <button
                        onClick={() => setAnswerMode("hybrid")}
                        className={`flex-1 px-2 py-1 rounded text-xs border ${
                            answerMode === "hybrid"
                                ? "bg-purple-600 border-purple-500 text-white"
                                : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                        }`}
                    >
                        🧠 Hybrid
                    </button>
                </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto text-sm">
                <p className="text-white/40 mb-2">Documents</p>

                {files.length === 0 && <p className="text-white/40">No documents yet</p>}

                <div className="space-y-2">
                    {files.map((pdf) => (
                        <div key={pdf.id} className={`w-full flex items-start gap-2 p-2 rounded text-left ${activePdf?.id === pdf.id ? "bg-white/20" : "hover:bg-white/10"}`}>
                            <FileText size={16} />
                            <div className="flex-1">
                                <div className="break-words text-sm">{pdf.name}</div>
                                {pdf.indexing ? (
                                    <div className="text-xs text-white/60 mt-1 flex items-center gap-2">
                                        <Loader2 className="animate-spin" size={14} /> Indexing...
                                    </div>
                                ) : pdf.indexed ? (
                                    <div className="text-xs text-white/60 mt-1">Ready</div>
                                ) : (
                                    <div className="text-xs text-amber-300 mt-1">Uploaded (awaiting index)</div>
                                )}
                            </div>

                            <div>
                                <button
                                    onClick={() => {
                                        if (pdf.indexing) return;
                                        if (!pdf.indexed) {
                                            // If the PDF exists on server but index wasn't present, try selecting (some backends reindex automatically)
                                            alert("Indexing may still be in progress on the server. If this PDF was uploaded before, re-uploading the same file will trigger indexing.");
                                        }
                                        setActivePdf(pdf.indexed ? pdf : null);
                                    }}
                                    disabled={pdf.indexing}
                                    className={`px-2 py-1 text-xs rounded ${pdf.indexing ? "bg-white/5 text-white/40" : "bg-white/10 hover:bg-white/20"}`}
                                >
                                    {pdf.indexing ? "..." : "Open"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const fixMarkdown = (text) => {
    return text
        .replace(/([^\n])(#{1,6}\s)/g, "$1\n\n$2")
        .replace(/([^\n])(-\s)/g, "$1\n\n$2");
};

export default function MessageBubble({ message, index, expanded, toggleSources }) {
    const isAssistant = message.role === "assistant";
    return (
        <div className={`max-w-[90%] md:max-w-[80%] px-4 py-3 rounded-lg ${message.role === "user" ? "bg-blue-600 text-white" : "bg-zinc-800 text-white"}`}>
            {isAssistant ? (
                <>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{fixMarkdown(message.content)}</ReactMarkdown>

                    {message.sources && message.sources.length > 0 && (
                        <div className="mt-2">
                            <button onClick={toggleSources} className="text-xs text-blue-400 hover:underline">
                                {expanded ? "Hide sources ▼" : "Show sources ▲"}
                            </button>

                            {expanded && (
                                <div className="mt-2 space-y-2 text-xs text-white/70 border-l border-white/10 pl-3">
                                    {message.sources.map((src, sIdx) => (
                                        <div key={sIdx} className="leading-snug italic">
                                            {src.text ?? JSON.stringify(src)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {message.confidence !== undefined && (
                        <div className="mt-3 text-xs text-white/60">
                            Confidence: <span className="font-medium">{(message.confidence * 100).toFixed(1)}%</span>
                        </div>
                    )}
                </>
            ) : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
            )}
        </div>
    );
}
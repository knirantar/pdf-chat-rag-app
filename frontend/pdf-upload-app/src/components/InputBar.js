import { Send, Loader2 } from "lucide-react";

export default function InputBar({ question, setQuestion, asking, askQuestion }) {
    return (
        <div className="flex gap-2">
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
                {asking ? <Loader2 className="animate-spin" size={16} /> : <Send size={18} />}
            </button>
        </div>
    );
}
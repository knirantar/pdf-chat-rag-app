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
                className="flex-1 min-h-[40px] max-h-[120px]
             resize-none rounded-lg bg-zinc-800
             p-2 md:p-3 text-sm md:text-base"
                rows={1}
            />
            <button
                onClick={askQuestion}
                disabled={asking}
                className="w-12 h-12 md:w-10 md:h-10
             bg-white text-black rounded-lg
             flex items-center justify-center"
            >
                {asking ? <Loader2 className="animate-spin" size={16} /> : <Send size={18} />}
            </button>
        </div>
    );
}
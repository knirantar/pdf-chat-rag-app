Streaming GPT tokens with citations UI
Chat memory per conversation - DONE
Cost optimization + caching - Done
Enterprise security hardening - Done added google Oauth2
Improve chunking (semantic / page-based) - Done
Stream answers (SSE) - Done
Docker Compose deployment - Done
Multi-PDF selector + per-PDF filtering
Docker + Azure deployment - cant be done requires money
Per-user authentication memory - maybe in future
Multi-PDF isolated chats - maybe in future
Full Agent architecture - need to check how we can 

🥇 LAYER 1 — WOW FEATURES (people instantly notice)
1️⃣ Citation-aware inline highlights (HUGE WOW)
What users see
Click a citation → PDF opens → highlighted text scrolls into view
Like Perplexity + ChatGPT combined
How
Store page + char_start + char_end during chunking
Return citations as structured objects
Frontend:
Render citations clickable
Use PDF.js text layer to highlight ranges
📈 Impact: Instant credibility + academic trust
💡 This alone makes people choose your app.

2️⃣ “Ask this PDF” smart suggestions
Auto-generate:
“What is the main argument?”
“Summarize chapter 3”
“What evidence supports X?”
“What does the author conclude?”
How
On upload → run a summary agent
Store suggested questions per PDF
📈 Impact: Reduces blank-screen anxiety

3️⃣ Confidence-aware answer labeling
You already compute confidence — surface it properly
Example UI:
🟢 Strongly supported by document
🟡 Partially supported
🔴 General knowledge
Do NOT show raw numbers
Humans understand labels better than percentages.

4️⃣ “Explain like I’m 5 / Expert / Exam-ready”
One answer → multiple modes
Backend
answer_style: "simple" | "detailed" | "exam"
📈 Students + professionals LOVE this.

5️⃣ Multi-PDF reasoning (killer feature)
Ask:
“Compare Ashoka’s dhamma with Arthashastra”
Implementation
Allow selecting multiple PDFs
Run retrieval per PDF
Merge context with PDF IDs
Ask LLM to compare sources explicitly
📈 This is where your app beats ChatGPT.

6️⃣ Auto-fact verification agent (trust bomb)
After answer:
Run verifier
Highlight unsupported sentences in ⚠️ yellow
Add note: “This sentence is inferred”
📈 Academic & legal users will trust you.

8️⃣ Question decomposition agent
For complex questions:
“Why did Ashoka change his policy after Kalinga?”
Agent:
Identify sub-questions
Retrieve per sub-question
Synthesize final answer
📈 Answers feel human-expert-level

9️⃣ Timeline & map views (history killer feature)
For historical PDFs:
Auto-extract dates
Render timeline
Optional map pins (e.g., Mauryan empire)
📈 No one else does this well.

🔟 Reading-mode chat (UX gold)
Split screen:
Left: PDF
Right: chat
Auto-scroll PDF when answer references a page
Feels like Notion + ChatGPT + Kindle.

1️⃣1️⃣ Export everything
Export chat → Markdown / PDF
Export citations
“Create study notes”
📈 Students & researchers = ❤️

🚀 NEXT-LEVEL (optional but insane)
🔮 Full Agent Architecture (your last TODO)
Yes — and you’re ready for it

Suggested agents:
📄 Retriever Agent
🧠 Reasoning Agent
🔍 Verification Agent
✂️ Compression Agent
📚 Citation Agent
Use simple orchestration first (no LangGraph yet).
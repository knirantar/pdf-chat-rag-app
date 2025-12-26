import React from "react";
import MessageBubble from "./MessageBubble";

export default function MessageList({ messages, expandedSources, toggleSources }) {
    if (!messages || messages.length === 0) {
        return <div className="text-center text-white/40 mt-20"><p className="text-lg">Upload a PDF to get started</p></div>;
    }

    return (
        <>
            {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <MessageBubble
                        message={m}
                        index={i}
                        expanded={!!expandedSources[i]}
                        toggleSources={() => toggleSources(i)}
                    />
                </div>
            ))}
        </>
    );
}
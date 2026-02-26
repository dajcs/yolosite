"use client";

import { useState, useRef, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Send, Bot, User } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  "What's your telecom background?",
  "Tell me about your space technologies work",
  "What are you studying at 42?",
  "What technologies do you know?",
];

export default function DigitalTwin() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok || !res.body) {
        setMessages((m) => [...m, { role: "assistant", content: "Something went wrong. Please try again." }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content ?? "";
            assistantText += delta;
            setMessages((m) => {
              const updated = [...m];
              updated[updated.length - 1] = { role: "assistant", content: assistantText };
              return updated;
            });
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <section id="digital-twin" className="py-24 px-6">
      <div className="max-w-3xl mx-auto" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center"
        >
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: "#ecad0a" }}>
            AI-Powered
          </p>
          <h2 className="text-4xl font-black mb-4" style={{ color: "#e8edf5" }}>
            Digital <span style={{ color: "#209dd7" }}>Twin</span>
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: "#888888" }}>
            Ask me anything about my career, skills, or background.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: "#0a1a30", border: "1px solid rgba(32,157,215,0.2)" }}
        >
          {/* Chat header */}
          <div
            className="flex items-center gap-3 px-5 py-4"
            style={{ borderBottom: "1px solid rgba(32,157,215,0.1)" }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(32,157,215,0.15)" }}
            >
              <Bot size={18} style={{ color: "#209dd7" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#e8edf5" }}>Attila&apos;s Digital Twin</p>
              <p className="text-xs" style={{ color: "#888888" }}>Powered by OpenRouter AI</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "#ecad0a" }} />
              <span className="text-xs" style={{ color: "#888888" }}>online</span>
            </div>
          </div>

          {/* Messages area */}
          <div className="h-80 overflow-y-auto px-5 py-5 flex flex-col gap-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-5">
                <p className="text-sm text-center" style={{ color: "#888888" }}>
                  Ask a question or choose a suggestion:
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs px-4 py-2 rounded-full transition-all hover:opacity-90 hover:scale-105"
                      style={{ background: "rgba(32,157,215,0.12)", color: "#209dd7", border: "1px solid rgba(32,157,215,0.25)" }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: m.role === "user" ? "rgba(117,57,145,0.2)" : "rgba(32,157,215,0.15)",
                    }}
                  >
                    {m.role === "user"
                      ? <User size={14} style={{ color: "#753991" }} />
                      : <Bot size={14} style={{ color: "#209dd7" }} />
                    }
                  </div>
                  <div
                    className="max-w-[80%] text-sm leading-relaxed rounded-2xl px-4 py-2.5"
                    style={{
                      background: m.role === "user" ? "rgba(117,57,145,0.15)" : "#0d2040",
                      color: "#e8edf5",
                    }}
                  >
                    {m.content
                      ? m.content
                      : <span style={{ color: "#888888" }}>...</span>
                    }
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(32,157,215,0.15)" }}
                >
                  <Bot size={14} style={{ color: "#209dd7" }} />
                </div>
                <div className="text-sm px-4 py-2.5 rounded-2xl" style={{ background: "#0d2040", color: "#888888" }}>
                  ...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-3 px-4 py-4"
            style={{ borderTop: "1px solid rgba(32,157,215,0.1)" }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask something about my career..."
              disabled={loading}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-600"
              style={{ color: "#e8edf5" }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "#753991" }}
            >
              <Send size={15} style={{ color: "white" }} />
            </button>
          </form>
        </motion.div>
      </div>
    </section>
  );
}

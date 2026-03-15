"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useMemo } from "react";
import { Send, Bot, User, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMessageText(msg: any): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((p: { type: string }) => p.type === "text")
      .map((p: { text: string }) => p.text)
      .join("");
  }
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p: { type: string }) => p.type === "text")
      .map((p: { text: string }) => p.text)
      .join("");
  }
  return String(msg.content ?? "");
}

function parseCitations(text: string): number[] {
  const matches = text.matchAll(/\[p\.(\d+)\]/g);
  const pages = [...new Set([...matches].map((m) => parseInt(m[1], 10)))];
  return pages.sort((a, b) => a - b);
}

function stripCitations(text: string): string {
  return text.replace(/\s*\[p\.\d+\]/g, "");
}

interface ChatInterfaceProps {
  tenderId: string;
  documentContext?: string;
  onCitationClick?: (page: number) => void;
}

export function ChatInterface({ tenderId, documentContext, onCitationClick }: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          tenderId,
          documentContext,
        },
      }),
    [tenderId, documentContext]
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const isReady = !!documentContext;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading || !isReady) return;
    setInputValue("");
    sendMessage({ text });
  };

  return (
    <div className="flex flex-col h-full border-t border-gray-200">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          AI Assistant
        </h3>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
            Error: {error.message}
          </div>
        )}
        {messages.length === 0 && !error && (
          <div className="text-center py-8 text-gray-400">
            {!documentContext ? (
              <>
                <Loader2 size={32} className="mx-auto mb-2 opacity-50 animate-spin text-indigo-400" />
                <p className="text-sm text-indigo-500">Extracting document text…</p>
                <p className="text-xs mt-1">
                  Please wait while I read the document
                </p>
              </>
            ) : (
              <>
                <Bot size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Ask about this tender</p>
                <p className="text-xs mt-1">
                  I can help with eligibility, requirements, bid preparation
                </p>
              </>
            )}
          </div>
        )}

        {messages.map((msg) => {
          const rawText = getMessageText(msg);
          const citations = msg.role === "assistant" ? parseCitations(rawText) : [];
          const displayText = msg.role === "assistant" ? stripCitations(rawText) : rawText;

          return (
            <div
              key={msg.id}
              className={`flex gap-2 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-1">
                  <Bot size={14} className="text-indigo-600" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {msg.role === "assistant" ? (
                  <>
                    <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
                      <ReactMarkdown>{displayText}</ReactMarkdown>
                    </div>
                    {citations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-200/60">
                        {citations.map((page) => (
                          <button
                            key={page}
                            onClick={() => onCitationClick?.(page)}
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer"
                          >
                            <FileText size={10} />
                            Page {page}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  displayText
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-1">
                  <User size={14} className="text-gray-600" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-indigo-600" />
            </div>
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-gray-100 flex gap-2"
      >
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={isReady ? "Ask about this tender..." : "Extracting document…"}
          className="h-9 text-sm"
          disabled={isLoading || !isReady}
        />
        <Button
          type="submit"
          size="sm"
          disabled={isLoading || !isReady || !inputValue.trim()}
          className="h-9 px-3"
        >
          <Send size={14} />
        </Button>
      </form>
    </div>
  );
}

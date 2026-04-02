import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, GitCompare, FileSearch, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatMessage from "./ChatMessage";
import { retrieveRelevantChunks } from "@/lib/pdf-utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ChatMessage as ChatMessageType, DocumentChunk, Document, Source, ThinkingStep } from "@/lib/types";

interface EnhancedChatPanelProps {
  chunks: DocumentChunk[];
  allChunks: DocumentChunk[];
  documents: Document[];
  selectedDocument: Document;
  workspaceId: string;
  roleMode: string;
  onHighlightPage?: (page: number) => void;
}

/**
 * Detect user intent from query text.
 * Used client-side for quick UI feedback; the edge function also classifies intent.
 */
function detectIntent(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('compare') || q.includes('difference') || q.includes('vs') || q.includes('contrast')) return 'comparison';
  if (q.includes('extract') || q.includes('list all') || q.includes('give me all') || q.includes('table')) return 'extraction';
  if (q.includes('risk') || q.includes('issue') || q.includes('problem') || q.includes('missing') || q.includes('unclear')) return 'analysis';
  if (q.includes('summarize') || q.includes('summary') || q.includes('overview') || q.includes('tldr')) return 'summary';
  return 'question';
}

function getThinkingSteps(intent: string): ThinkingStep[] {
  const base: ThinkingStep[] = [
    { step: 'Understanding query', status: 'done' },
    { step: 'Searching documents', status: 'active' },
  ];
  switch (intent) {
    case 'comparison': return [...base, { step: 'Comparing sections', status: 'pending' }, { step: 'Generating response', status: 'pending' }];
    case 'extraction': return [...base, { step: 'Extracting data', status: 'pending' }, { step: 'Formatting output', status: 'pending' }];
    case 'analysis': return [...base, { step: 'Analyzing content', status: 'pending' }, { step: 'Identifying risks', status: 'pending' }];
    default: return [...base, { step: 'Generating response', status: 'pending' }];
  }
}

const EnhancedChatPanel = ({
  chunks, allChunks, documents, selectedDocument, workspaceId, roleMode, onHighlightPage,
}: EnhancedChatPanelProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load summary as first message
  useEffect(() => {
    if (selectedDocument.summary && messages.length === 0) {
      setMessages([{
        id: "summary",
        role: "assistant",
        content: `📄 **Document Summary**\n\n${selectedDocument.summary}\n\n---\n\nI've analyzed "${selectedDocument.name}". Ask me anything!`,
        metadata: { intent: 'summary' as any },
      }]);
    }
  }, [selectedDocument]);

  // Load persisted messages
  useEffect(() => {
    loadMessages();
  }, [workspaceId]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at");
    if (data && data.length > 0) {
      setMessages(data.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources,
        metadata: m.metadata,
      })));
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !user) return;

    const intent = detectIntent(trimmed);
    const thinkingSteps = getThinkingSteps(intent);

    const userMsg: ChatMessageType = { id: `user-${Date.now()}`, role: "user", content: trimmed };
    const loadingId = `loading-${Date.now()}`;
    const loadingMsg: ChatMessageType = {
      id: loadingId,
      role: "assistant",
      content: "",
      isLoading: true,
      metadata: { intent: intent as any, thinkingSteps },
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setIsLoading(true);

    const startTime = Date.now();

    try {
      // RAG retrieval: use selected doc chunks + cross-document if comparison
      const searchChunks = intent === 'comparison' ? allChunks : chunks;
      const relevant = retrieveRelevantChunks(trimmed, searchChunks, 8);
      const context = relevant.length > 0
        ? relevant.map((c) => `[Doc: ${documents.find(d => d.id === c.document_id)?.name || 'Unknown'}, Page ${c.page_number}]: ${c.text}`).join("\n\n")
        : chunks.slice(0, 5).map((c) => `[Page ${c.page_number}]: ${c.text}`).join("\n\n");

      // Build chat history (last 10 messages)
      const chatHistory = messages
        .filter((m) => !m.isLoading && m.id !== "summary")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      // Update thinking steps
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { ...m, metadata: { ...m.metadata, thinkingSteps: thinkingSteps.map((s, i) => ({ ...s, status: i <= 1 ? 'done' as const : i === 2 ? 'active' as const : 'pending' as const })) } }
            : m
        )
      );

      const { data, error } = await supabase.functions.invoke("doc-chat", {
        body: {
          messages: [...chatHistory, { role: "user", content: trimmed }],
          context,
          documentName: selectedDocument.name,
          intent,
          roleMode,
          documentsInfo: documents.map((d) => ({ name: d.name, pages: d.total_pages })),
        },
      });

      if (error) throw error;

      const latencyMs = Date.now() - startTime;

      const sources: Source[] = relevant.map((c) => ({
        text: c.text.slice(0, 150),
        pageNumber: c.page_number,
        documentName: documents.find(d => d.id === c.document_id)?.name,
        relevanceScore: 0.85, // placeholder; real scoring would come from reranker
      }));

      if (sources.length > 0 && onHighlightPage) {
        onHighlightPage(sources[0].pageNumber);
      }

      const finalSteps = thinkingSteps.map((s) => ({ ...s, status: 'done' as const }));

      const assistantMsg: ChatMessageType = {
        id: loadingId,
        role: "assistant",
        content: data.response,
        sources,
        isLoading: false,
        metadata: {
          intent: data.intent || intent,
          confidence: data.confidence || 0.85,
          thinkingSteps: finalSteps,
          toolsUsed: data.toolsUsed || [],
          latencyMs,
        },
      };

      setMessages((prev) => prev.map((m) => m.id === loadingId ? assistantMsg : m));

      // Persist messages
      await supabase.from("messages").insert([
        { workspace_id: workspaceId, user_id: user.id, role: "user", content: trimmed },
        {
          workspace_id: workspaceId,
          user_id: user.id,
          role: "assistant",
          content: data.response,
          sources: sources as any,
          metadata: assistantMsg.metadata as any,
        },
      ]);

      // Log query for observability
      await supabase.from("query_logs").insert({
        workspace_id: workspaceId,
        user_id: user.id,
        query: trimmed,
        intent,
        chunks_retrieved: relevant.length,
        response_length: data.response?.length || 0,
        latency_ms: latencyMs,
        relevance_score: data.confidence || 0.85,
      });
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { ...m, content: "Sorry, I encountered an error. Please try again.", isLoading: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { label: "Summarize key points", icon: Sparkles },
    { label: "Compare documents", icon: GitCompare },
    { label: "Extract structured data", icon: FileSearch },
    { label: "Find risks or issues", icon: Lightbulb },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-shrink-0 px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">AI Chat</h2>
        <p className="text-xs text-muted-foreground truncate">
          {selectedDocument.name} • {documents.length} doc{documents.length !== 1 ? 's' : ''} loaded
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Ready to analyze</p>
              <p className="text-xs text-muted-foreground">Ask questions, compare docs, extract data</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => { setInput(a.label); inputRef.current?.focus(); }}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/30 hover:bg-surface-hover transition-colors text-muted-foreground"
                >
                  <a.icon className="h-3 w-3" /> {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 p-4 border-t border-border">
        <div className="flex items-end gap-2 bg-card rounded-xl border border-border p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the document..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none px-2 py-1.5 max-h-32"
            style={{ minHeight: "36px" }}
          />
          <Button size="sm" onClick={sendMessage} disabled={!input.trim() || isLoading} className="flex-shrink-0 h-8 w-8 p-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedChatPanel;

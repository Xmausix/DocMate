import ReactMarkdown from "react-markdown";
import { Brain, User, FileText, ChevronDown, ChevronUp, Gauge } from "lucide-react";
import { useState } from "react";
import type { ChatMessage as ChatMessageType, ThinkingStep } from "@/lib/types";

const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 py-1">
    <div className="typing-dot" />
    <div className="typing-dot" />
    <div className="typing-dot" />
  </div>
);

const ThinkingSteps = ({ steps }: { steps: ThinkingStep[] }) => (
  <div className="flex flex-wrap gap-1.5 mb-2">
    {steps.map((s, i) => (
      <span
        key={i}
        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
          s.status === 'done'
            ? 'bg-primary/10 text-primary'
            : s.status === 'active'
            ? 'bg-primary/20 text-primary animate-pulse'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {s.status === 'done' ? '✓' : s.status === 'active' ? '⟳' : '○'} {s.step}
      </span>
    ))}
  </div>
);

const ConfidenceBadge = ({ score }: { score: number }) => {
  const color = score >= 0.8 ? 'text-green-600 bg-green-50' : score >= 0.5 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${color}`}>
      <Gauge className="h-3 w-3" /> {Math.round(score * 100)}% confidence
    </span>
  );
};

const ChatMessage = ({ message }: { message: ChatMessageType }) => {
  const isUser = message.role === "user";
  const [showSources, setShowSources] = useState(false);
  const hasSources = message.sources && message.sources.length > 0;
  const hasSteps = message.metadata?.thinkingSteps && message.metadata.thinkingSteps.length > 0;

  return (
    <div className={`flex gap-3 animate-fade-in-up ${isUser ? "flex-row-reverse" : ""}`}>
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        {isUser ? <User className="h-4 w-4 text-primary" /> : <Brain className="h-4 w-4 text-primary" />}
      </div>
      <div className={`flex-1 min-w-0 ${isUser ? "text-right" : ""}`}>
        {/* Thinking steps */}
        {!isUser && hasSteps && <ThinkingSteps steps={message.metadata!.thinkingSteps!} />}

        <div
          className={`inline-block max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-card border border-border text-card-foreground rounded-bl-md"
          }`}
        >
          {message.isLoading ? (
            <TypingIndicator />
          ) : (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:bg-muted prose-pre:text-foreground prose-code:text-primary">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Metadata bar */}
        {!isUser && !message.isLoading && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {message.metadata?.confidence != null && (
              <ConfidenceBadge score={message.metadata.confidence} />
            )}
            {message.metadata?.intent && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                {message.metadata.intent}
              </span>
            )}
            {message.metadata?.toolsUsed?.map((t) => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/50 text-accent-foreground font-medium">
                🔧 {t}
              </span>
            ))}
            {message.metadata?.latencyMs != null && (
              <span className="text-[10px] text-muted-foreground">
                {(message.metadata.latencyMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        )}

        {/* Source citations */}
        {hasSources && (
          <div className="mt-2">
            <button
              onClick={() => setShowSources(!showSources)}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <FileText className="h-3 w-3" />
              {message.sources!.length} source{message.sources!.length !== 1 ? 's' : ''}
              {showSources ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showSources && (
              <div className="mt-1.5 space-y-1.5">
                {message.sources!.map((src, i) => (
                  <div key={i} className="text-xs p-2 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-primary">Page {src.pageNumber}</span>
                      {src.documentName && (
                        <span className="text-muted-foreground truncate">{src.documentName}</span>
                      )}
                      {src.relevanceScore != null && (
                        <span className="text-muted-foreground">
                          {Math.round(src.relevanceScore * 100)}% match
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground line-clamp-2 italic">"{src.text}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;

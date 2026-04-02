import { useState } from "react";
import { Database, Shield, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Document, DocumentChunk, Extraction } from "@/lib/types";

interface ExtractionPanelProps {
  document: Document;
  chunks: DocumentChunk[];
  roleMode: string;
  mode?: 'extract' | 'risk';
}

const ExtractionPanel = ({ document, chunks, roleMode, mode = 'extract' }: ExtractionPanelProps) => {
  const { user } = useAuth();
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runExtraction = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    try {
      const context = chunks.slice(0, 15).map((c) => `[Page ${c.page_number}]: ${c.text}`).join("\n\n");

      const prompt = mode === 'risk'
        ? `Analyze this document for risks, unclear clauses, missing elements, and potential issues. Return a structured analysis with: 1) Key risks found, 2) Unclear or ambiguous sections, 3) Missing elements, 4) Recommendations. Be specific and cite page numbers.`
        : `Extract all structured data from this document. Based on the document type, extract relevant fields. For CVs: skills, experience, education, years of experience. For contracts: parties, dates, obligations, penalties, termination clauses. For reports: key findings, metrics, conclusions. Return the extracted data in a well-organized format with clear headings.`;

      const { data, error: fnError } = await supabase.functions.invoke("doc-chat", {
        body: {
          messages: [{ role: "user", content: prompt }],
          context,
          documentName: document.name,
          intent: mode === 'risk' ? 'analysis' : 'extraction',
          roleMode,
        },
      });

      if (fnError) throw fnError;
      setResult(data.response);

      // Persist extraction
      await supabase.from("extractions").insert({
        document_id: document.id,
        user_id: user.id,
        extraction_type: mode,
        data: { result: data.response },
        confidence: data.confidence || 0.8,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const Icon = mode === 'risk' ? Shield : Database;
  const title = mode === 'risk' ? 'Risk & Issue Analysis' : 'Structured Data Extraction';
  const description = mode === 'risk'
    ? 'Detect risks, unclear clauses, and missing elements'
    : 'Extract structured data based on document type';

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-shrink-0 px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </h2>
        <p className="text-xs text-muted-foreground">{document.name}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!result && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Icon className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">{title}</p>
              <p className="text-xs text-muted-foreground max-w-sm">{description}</p>
            </div>
            <Button onClick={runExtraction} disabled={chunks.length === 0}>
              <Icon className="h-4 w-4 mr-2" />
              {mode === 'risk' ? 'Analyze Document' : 'Extract Data'}
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-primary">
                <div className="typing-dot" /> <span>Reading document...</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="typing-dot" style={{ animationDelay: '0.5s' }} />
                <span>{mode === 'risk' ? 'Analyzing for risks...' : 'Extracting structured data...'}</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Results</span>
              </div>
              <Button variant="outline" size="sm" onClick={runExtraction}>
                Re-run
              </Button>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border prose prose-sm max-w-none text-card-foreground">
              {typeof result === 'string' ? (
                <div dangerouslySetInnerHTML={{ __html: result.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/#{1,3}\s(.*?)(?:\n|$)/g, '<h3>$1</h3>') }} />
              ) : (
                <pre className="text-xs overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExtractionPanel;

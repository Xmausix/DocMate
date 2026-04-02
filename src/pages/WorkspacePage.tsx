import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Brain, ArrowLeft, Upload, FileText, Trash2, Loader2, Shield, Database, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { parsePdf } from "@/lib/pdf-utils";
import FileUploadZone from "@/components/FileUploadZone";
import PdfViewer from "@/components/PdfViewer";
import EnhancedChatPanel from "@/components/EnhancedChatPanel";
import ExtractionPanel from "@/components/ExtractionPanel";
import type { Document, DocumentChunk, Workspace } from "@/lib/types";

const WorkspacePage = () => {
  const { id: workspaceId } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [allChunks, setAllChunks] = useState<Map<string, DocumentChunk[]>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const [highlightPage, setHighlightPage] = useState<number | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePanel, setActivePanel] = useState<'chat' | 'extract' | 'risk'>('chat');

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && workspaceId) {
      loadWorkspace();
      loadDocuments();
    }
  }, [user, workspaceId]);

  const loadWorkspace = async () => {
    const { data } = await supabase.from("workspaces").select("*").eq("id", workspaceId!).single();
    if (data) setWorkspace(data as any);
  };

  const loadDocuments = async () => {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("workspace_id", workspaceId!)
      .order("created_at", { ascending: false });
    if (data) setDocuments(data as any);
  };

  const loadChunksForDoc = async (docId: string) => {
    if (allChunks.has(docId)) {
      setChunks(allChunks.get(docId)!);
      return;
    }
    const { data } = await supabase
      .from("document_chunks")
      .select("id, document_id, text, page_number, chunk_index")
      .eq("document_id", docId)
      .order("chunk_index");
    if (data) {
      const typed = data as any as DocumentChunk[];
      setChunks(typed);
      setAllChunks((prev) => new Map(prev).set(docId, typed));
    }
  };

  const selectDocument = async (doc: Document) => {
    setSelectedDoc(doc);
    await loadChunksForDoc(doc.id);

    // Load the PDF file from storage for viewing
    if (doc.file_path) {
      const { data } = await supabase.storage.from("documents").download(doc.file_path);
      if (data) {
        const file = new File([data], doc.name, { type: "application/pdf" });
        setSelectedFile(file);
      }
    }
  };

  const handleFileUpload = useCallback(async (file: File) => {
    if (!user || !workspaceId) return;
    setIsUploading(true);

    try {
      // 1. Parse PDF client-side
      const parsed = await parsePdf(file);

      // 2. Upload to storage
      const filePath = `${user.id}/${workspaceId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
      if (uploadError) throw uploadError;

      // 3. Create document record
      const { data: docData, error: docError } = await supabase
        .from("documents")
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          name: file.name,
          file_path: filePath,
          status: "processing",
          total_pages: parsed.totalPages,
          chunk_count: parsed.chunks.length,
        })
        .select()
        .single();

      if (docError || !docData) throw docError;

      // 4. Store chunks in DB for persistence & search
      const chunkRows = parsed.chunks.map((c) => ({
        document_id: docData.id,
        user_id: user.id,
        text: c.text,
        page_number: c.page_number,
        chunk_index: c.chunk_index,
      }));

      // Insert in batches of 50
      for (let i = 0; i < chunkRows.length; i += 50) {
        const batch = chunkRows.slice(i, i + 50);
        await supabase.from("document_chunks").insert(batch);
      }

      // 5. Generate summary via edge function
      const contextForSummary = parsed.chunks.slice(0, 10).map((c) => c.text).join("\n\n");
      const { data: summaryData } = await supabase.functions.invoke("doc-chat", {
        body: {
          messages: [{ role: "user", content: "Provide a concise summary in 3-5 sentences." }],
          context: contextForSummary,
          documentName: file.name,
          isSummary: true,
          roleMode: workspace?.role_mode || "analyst",
        },
      });

      // 6. Update document status
      await supabase
        .from("documents")
        .update({
          status: "ready",
          summary: summaryData?.response || null,
        })
        .eq("id", docData.id);

      toast({ title: "Document processed", description: `${parsed.totalPages} pages, ${parsed.chunks.length} chunks` });
      loadDocuments();

      // Auto-select the new document
      const updatedDoc = { ...(docData as any), status: "ready", summary: summaryData?.response || null };
      await selectDocument(updatedDoc);
      setSelectedFile(file);
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  }, [user, workspaceId, workspace]);

  const deleteDocument = async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (doc?.file_path) {
      await supabase.storage.from("documents").remove([doc.file_path]);
    }
    await supabase.from("documents").delete().eq("id", docId);
    if (selectedDoc?.id === docId) {
      setSelectedDoc(null);
      setSelectedFile(null);
      setChunks([]);
    }
    loadDocuments();
  };

  // Gather all chunks across all loaded documents for cross-document queries
  const getAllLoadedChunks = (): DocumentChunk[] => {
    const all: DocumentChunk[] = [];
    allChunks.forEach((c) => all.push(...c));
    return all;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <nav className="flex-shrink-0 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="h-8">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div className="h-5 w-px bg-border" />
            <Brain className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">
              {workspace?.name || "Workspace"}
            </span>
            {workspace?.role_mode && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {workspace.role_mode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={activePanel === 'chat' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActivePanel('chat')}
              className="text-xs h-7"
            >
              Chat
            </Button>
            <Button
              variant={activePanel === 'extract' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActivePanel('extract')}
              className="text-xs h-7"
            >
              <Database className="h-3 w-3 mr-1" /> Extract
            </Button>
            <Button
              variant={activePanel === 'risk' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActivePanel('risk')}
              className="text-xs h-7"
            >
              <Shield className="h-3 w-3 mr-1" /> Analyze
            </Button>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* Document sidebar */}
        <div className={`flex-shrink-0 border-r border-border bg-card transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0'} overflow-hidden`}>
          <div className="w-64 h-full flex flex-col">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documents</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSidebarOpen(false)}>
                <ChevronLeft className="h-3 w-3" />
              </Button>
            </div>
            <div className="p-3">
              <FileUploadZone onFileAccepted={handleFileUpload} isLoading={isUploading} compact />
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => selectDocument(doc)}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors mb-1 ${
                    selectedDoc?.id === doc.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-surface-hover text-foreground'
                  }`}
                >
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{doc.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {doc.total_pages}p • {doc.status === 'ready' ? 'Ready' : doc.status}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar toggle when closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex-shrink-0 w-8 border-r border-border bg-card hover:bg-surface-hover flex items-center justify-center transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}

        {/* Main content area */}
        {!selectedDoc ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-6">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">Select or upload a document</h2>
              <p className="text-sm text-muted-foreground">
                Upload PDFs to your workspace and start analyzing them with AI
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* PDF Viewer - Left */}
            <div className="hidden lg:flex w-1/2 border-r border-border">
              {selectedFile && <PdfViewer file={selectedFile} highlightPage={highlightPage} />}
            </div>
            {/* Right panel */}
            <div className="flex-1 min-w-0">
              {activePanel === 'chat' && (
                <EnhancedChatPanel
                  chunks={chunks}
                  allChunks={getAllLoadedChunks()}
                  documents={documents}
                  selectedDocument={selectedDoc}
                  workspaceId={workspaceId!}
                  roleMode={workspace?.role_mode || 'analyst'}
                  onHighlightPage={setHighlightPage}
                />
              )}
              {activePanel === 'extract' && (
                <ExtractionPanel
                  document={selectedDoc}
                  chunks={chunks}
                  roleMode={workspace?.role_mode || 'analyst'}
                />
              )}
              {activePanel === 'risk' && (
                <ExtractionPanel
                  document={selectedDoc}
                  chunks={chunks}
                  roleMode={workspace?.role_mode || 'analyst'}
                  mode="risk"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspacePage;

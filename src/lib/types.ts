// Core types for DocMind AI

export type Intent = 'question' | 'comparison' | 'extraction' | 'analysis' | 'summary';

export interface ThinkingStep {
  step: string;
  status: 'pending' | 'active' | 'done';
  detail?: string;
}

export interface Source {
  text: string;
  pageNumber: number;
  documentName?: string;
  documentId?: string;
  relevanceScore?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: Source[];
  metadata?: {
    intent?: Intent;
    confidence?: number;
    thinkingSteps?: ThinkingStep[];
    toolsUsed?: string[];
    latencyMs?: number;
    model?: string;
  };
  isLoading?: boolean;
  isStreaming?: boolean;
  created_at?: string;
}

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  role_mode: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  file_path: string | null;
  status: string;
  total_pages: number;
  chunk_count: number;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  text: string;
  page_number: number;
  chunk_index: number;
}

export interface Extraction {
  id: string;
  document_id: string;
  extraction_type: string;
  data: Record<string, any>;
  confidence: number | null;
  created_at: string;
}

export type RoleMode = 'analyst' | 'lawyer' | 'recruiter';

export const ROLE_MODES: { value: RoleMode; label: string; description: string }[] = [
  { value: 'analyst', label: 'Analyst', description: 'General document analysis and Q&A' },
  { value: 'lawyer', label: 'Legal Advisor', description: 'Focus on contracts, clauses, and legal risks' },
  { value: 'recruiter', label: 'Recruiter', description: 'Focus on CVs, skills, and candidate assessment' },
];

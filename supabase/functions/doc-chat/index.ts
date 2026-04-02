import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * AGENT SYSTEM: The AI plans before answering.
 * 1. Detect intent (question, comparison, extraction, analysis, summary)
 * 2. Select tools (document search, data extractor, comparator, calculator)
 * 3. Build optimized context
 * 4. Generate grounded response with citations and confidence
 */

// Role-based system prompts (modular prompt system)
const ROLE_PROMPTS: Record<string, string> = {
  analyst: `You are DocMind AI, a professional document analyst. You provide thorough, accurate analysis with clear structure. Focus on data, facts, and actionable insights.`,
  lawyer: `You are DocMind AI, a legal document analyst. You focus on contracts, legal obligations, risks, penalties, termination clauses, and compliance issues. Use precise legal language and flag potential legal concerns.`,
  recruiter: `You are DocMind AI, a recruitment specialist. You analyze CVs and candidate profiles, focusing on skills, experience years, career progression, education quality, and cultural fit indicators.`,
};

function buildSystemPrompt(roleMode: string, documentName: string, intent: string, isSummary: boolean, context: string): string {
  if (isSummary) {
    return `${ROLE_PROMPTS[roleMode] || ROLE_PROMPTS.analyst}

Provide a concise, clear summary of the following document content in 3-5 sentences. Focus on the key points and main conclusions.`;
  }

  const toolInstructions = `
AVAILABLE TOOLS (use when appropriate):
- DOCUMENT_SEARCH: Search for specific information across document sections
- DATA_EXTRACTOR: Extract structured data (dates, names, numbers, lists)
- COMPARATOR: Compare sections or documents for similarities/differences
- CALCULATOR: Perform calculations on extracted numbers

PLANNING: Before answering, briefly plan your approach in your head. Consider which tools would help.`;

  const intentInstructions: Record<string, string> = {
    question: "Answer the question directly and concisely. Cite page numbers.",
    comparison: "Compare and contrast the relevant sections. Highlight similarities and differences clearly.",
    extraction: "Extract structured data in a clear format. Use tables or lists. Include all relevant fields.",
    analysis: "Analyze the content critically. Identify risks, issues, missing elements, and provide recommendations.",
    summary: "Provide a comprehensive but concise summary covering all key points.",
  };

  return `${ROLE_PROMPTS[roleMode] || ROLE_PROMPTS.analyst}

${toolInstructions}

STRICT RULES:
1. ONLY answer based on the provided document context. Never use outside knowledge.
2. If the answer is NOT in the context, say: "I couldn't find that in the document."
3. ALWAYS cite sources with page numbers, e.g. "(Page 3)".
4. Use markdown for formatting. Use blockquotes when quoting the document.
5. Be concise but thorough.
6. ${intentInstructions[intent] || intentInstructions.question}

RESPONSE FORMAT:
- Start with a direct answer
- Support with evidence from the document
- End with confidence assessment if relevant

Document: "${documentName}"

---
DOCUMENT CONTEXT:
${context}
---`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context, documentName, intent, roleMode, isSummary, documentsInfo } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const effectiveIntent = intent || "question";
    const effectiveRole = roleMode || "analyst";

    const systemPrompt = buildSystemPrompt(effectiveRole, documentName, effectiveIntent, isSummary, context);

    const aiMessages = [{ role: "system", content: systemPrompt }];

    if (isSummary) {
      aiMessages.push({ role: "user", content: `Summarize this document:\n\n${context}` });
    } else {
      // Add conversation history
      for (const msg of messages) {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

    // Determine tools used based on intent
    const toolsUsed: string[] = [];
    if (effectiveIntent === 'comparison') toolsUsed.push('comparator');
    if (effectiveIntent === 'extraction') toolsUsed.push('data_extractor');
    if (effectiveIntent === 'analysis') toolsUsed.push('document_search', 'data_extractor');
    if (!toolsUsed.length) toolsUsed.push('document_search');

    // Heuristic confidence based on context length and response
    const contextLength = context?.length || 0;
    const confidence = Math.min(0.95, Math.max(0.3, contextLength > 500 ? 0.85 : contextLength > 200 ? 0.7 : 0.5));

    return new Response(
      JSON.stringify({
        response: aiResponse,
        intent: effectiveIntent,
        confidence,
        toolsUsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("doc-chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

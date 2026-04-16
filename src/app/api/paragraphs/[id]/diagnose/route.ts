import { NextResponse } from "next/server";
import { createClient } from "@/infrastructure/database/supabase/server";
import { generateStructuredOutput } from "@/infrastructure/llm/groq/service";
import { DiagnosisSchema } from "@/domain/types/schemas";

// Vercel Serverless Function timeout extension
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paragraphId } = await params;
    const supabase = await createClient();

    // 1. Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch Paragraph
    const { data: paragraph, error: paragraphError } = await supabase
      .from("paragraphs")
      .select("*, documents(language, discipline)")
      .eq("id", paragraphId)
      .single();

    if (paragraphError || !paragraph) {
      return NextResponse.json({ error: "Paragraph not found" }, { status: 404 });
    }

    const { current_text } = paragraph;

    // 3. Prepare Prompt for Diagnosis
    const systemPrompt = `
      You are an expert academic writing diagnostician. 
      Your task is to analyze the provided academic paragraph and identify writing risks.
      Do NOT judge if it is AI-generated; focus strictly on academic quality and authorship markers.
      
      You must return a JSON object that strictly conforms to the following schema:
      {
        "paragraph_id": "string",
        "tags": ["T1", "T2", ...], // Risk tags
        "severity": "low|medium|high|critical",
        "evidence_spans": [{"text": "exact quote from paragraph", "reason": "brief explanation"}],
        "explanation": "A concise explanation of the main issues in 1-2 sentences.",
        "revision_priority": "low|medium|high"
      }

      Available Risk Tags (use exact codes):
      - T1: Template-like phrasing
      - T2: Low information density
      - T3: Weak evidence support
      - T4: Weak author stance
      - T5: Over-uniform syntax/rhythm
      - T6: Generic term usage
      - T7: Paragraph function imbalance
      - T8: Citation-claim mismatch
    `;

    const userPrompt = `
      Analyze the following academic paragraph:
      
      "${current_text}"
      
      Paragraph ID: ${paragraphId}
    `;

    // 4. Call Groq LLM (Llama 3.3 70B recommended for Planning/Diagnosis)
    const { result: diagnosis, rawOutput } = await generateStructuredOutput({
      systemPrompt,
      userPrompt,
      schema: DiagnosisSchema,
      model: "llama-3.3-70b-versatile",
    });

    // 5. Save Diagnosis to DB
    const { data: savedDiagnosis, error: diagnosisError } = await supabase
      .from("diagnoses")
      .insert({
        paragraph_id: paragraphId,
        tags_json: diagnosis.tags,
        severity: diagnosis.severity,
        evidence_spans_json: diagnosis.evidence_spans,
        explanation: diagnosis.explanation,
        revision_priority: diagnosis.revision_priority,
        model_name: "llama-3.3-70b-versatile",
        prompt_version: "v1.0",
      })
      .select()
      .single();

    if (diagnosisError) {
      throw new Error(`Failed to save diagnosis: ${diagnosisError.message}`);
    }

    return NextResponse.json({ diagnosis: savedDiagnosis });
  } catch (error: any) {
    console.error(`[POST /api/paragraphs/diagnose] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

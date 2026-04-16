import { NextResponse } from "next/server";
import { createClient } from "@/infrastructure/database/supabase/server";
import { generateStructuredOutput } from "@/infrastructure/llm/groq/service";
import { RevisionPlanSchema } from "@/domain/types/schemas";

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

    // 2. Fetch Paragraph & its latest Diagnosis
    const { data: paragraph, error: paragraphError } = await supabase
      .from("paragraphs")
      .select(`
        *,
        documents (language, discipline),
        diagnoses (tags_json, evidence_spans_json, severity, explanation)
      `)
      .eq("id", paragraphId)
      .single();

    if (paragraphError || !paragraph) {
      return NextResponse.json({ error: "Paragraph not found" }, { status: 404 });
    }

    const { current_text, diagnoses } = paragraph;
    // We assume the most recent diagnosis is the first one if sorted, or we can just pick the last one.
    // For MVP, we take the last generated diagnosis.
    const latestDiagnosis = diagnoses && diagnoses.length > 0 
      ? diagnoses[diagnoses.length - 1] 
      : null;

    if (!latestDiagnosis) {
      return NextResponse.json({ error: "No diagnosis found for this paragraph. Please diagnose first." }, { status: 400 });
    }

    // 3. Prepare Prompt for Planning
    const systemPrompt = `
      You are an expert academic writing planner.
      Your task is to transform identified writing risks into an actionable "Revision Plan" for a paragraph.
      Do NOT rewrite the paragraph. Only output the plan in the requested JSON structure.

      CRITICAL INSTRUCTIONS FOR CONSTRAINTS & STYLE:
      - Under 'preserve_constraints', explicitly extract and list ALL specific numbers, statistics, percentages, dates, proper nouns, and specialized terminology found in the original text.
      - Under 'suggested_actions', provide structural editing advice (e.g., "Combine sentences to increase information density").
      - Under 'voice_seeds', provide 1-2 stylistic or perspective seeds to introduce semantic redundancy and human-like fluctuation. You MUST choose or adapt from these human persona templates:
          * "The Skeptic": Emphasize limitations of experimental conditions, use cautious tone, prefer "might be" over "is".
          * "The Practicalist": Focus on the legwork and practical application, use concrete action verbs.
          * "The Minimalist": Favor short sentences for conclusions, avoid flowery rhetoric entirely.

      The JSON schema you must follow:
      {
        "revision_goals": ["string"],
        "preserve_constraints": ["string"],
        "suggested_actions": ["string"],
        "voice_seeds": ["string"],
        "optional_evidence_slots": ["string"],
        "rewrite_mode_candidates": ["academic_rigorous", "clarity_enhanced", "authorial_analysis"],
        "style_alignment_notes": ["string"]
      }

      Context:
      - revision_goals: What we want to achieve (e.g. "Increase specific evidence", "Enhance author stance").
      - preserve_constraints: What MUST NOT change.
      - suggested_actions: Concrete steps for the rewriter.
      - voice_seeds: Hints for human-like unpredictability or specific academic persona perspectives.
      - rewrite_mode_candidates: Return 1-3 modes from the exact list provided above.
    `;

    const userPrompt = `
      Paragraph Text:
      "${current_text}"

      Diagnosis Report:
      Tags: ${JSON.stringify(latestDiagnosis.tags_json)}
      Severity: ${latestDiagnosis.severity}
      Explanation: ${latestDiagnosis.explanation}
      Evidence: ${JSON.stringify(latestDiagnosis.evidence_spans_json)}

      Create a detailed revision plan for the rewriter agent.
    `;

    // 4. Call Groq LLM
    const { result: revisionPlan, rawOutput } = await generateStructuredOutput({
      systemPrompt,
      userPrompt,
      schema: RevisionPlanSchema,
      model: "llama-3.3-70b-versatile",
    });

    // 5. Save Plan to DB
    const { data: savedPlan, error: planError } = await supabase
      .from("revision_plans")
      .insert({
        paragraph_id: paragraphId,
        goals_json: revisionPlan.revision_goals,
        constraints_json: revisionPlan.preserve_constraints,
        suggested_actions_json: revisionPlan.suggested_actions,
        evidence_slots_json: revisionPlan.optional_evidence_slots,
        recommended_modes_json: revisionPlan.rewrite_mode_candidates,
        style_alignment_notes_json: revisionPlan.voice_seeds, // Reusing column for MVP or consider it mapped to voice_seeds
        model_name: "llama-3.3-70b-versatile",
        prompt_version: "v1.0",
      })
      .select()
      .single();

    if (planError) {
      throw new Error(`Failed to save revision plan: ${planError.message}`);
    }

    return NextResponse.json({ revisionPlan: savedPlan });
  } catch (error: any) {
    console.error(`[POST /api/paragraphs/plan] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

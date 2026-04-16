import { NextResponse } from "next/server";
import { createClient } from "@/infrastructure/database/supabase/server";
import { generateStructuredOutput } from "@/infrastructure/llm/groq/service";
import { z } from "zod";

// Vercel Serverless Function timeout extension
export const maxDuration = 60;

const SingleCandidateSchema = z.object({
  rewritten_text: z.string(),
  mode: z.string().optional(),
  candidate_id: z.string().optional(),
});

const RewriteCandidatesResponseSchema = z.object({
  candidates: z.array(SingleCandidateSchema).min(1).max(3),
});

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

    const body = await request.json();
    const mode = body.mode || "academic_rigorous";

    // 2. Fetch Paragraph & its latest Revision Plan
    const { data: paragraph, error: paragraphError } = await supabase
      .from("paragraphs")
      .select(`
        *,
        documents (language, discipline),
        revision_plans (id, goals_json, constraints_json, suggested_actions_json)
      `)
      .eq("id", paragraphId)
      .single();

    if (paragraphError || !paragraph) {
      return NextResponse.json({ error: "Paragraph not found" }, { status: 404 });
    }

    const { current_text, revision_plans } = paragraph;
    const latestPlan = revision_plans && revision_plans.length > 0 
      ? revision_plans[revision_plans.length - 1] 
      : null;

    if (!latestPlan) {
      return NextResponse.json({ error: "No revision plan found. Please generate a plan first." }, { status: 400 });
    }

    // 3. Prepare Prompt for Rewriting
    const systemPrompt = `
      You are an expert academic editor performing "Constrained Rewriting".
      Your primary goal is to improve the academic tone and authorship of the text WITHOUT altering the core meaning, numerical values, or citations.

      CRITICAL CONSTRAINTS (ABSOLUTE RULES):
      1. FAITHFULNESS: You MUST preserve the exact original meaning and original subjects.
      2. NUMBERS & DATA: You MUST perfectly preserve all numbers, statistics, percentages, dates, and mathematical relationships.
      3. CITATIONS: You MUST preserve all citation anchors. Do not move them away from the claims they support.
      4. LOCKED TERMS: You MUST NOT alter or paraphrase any terminology listed in 'preserve_constraints'. You MAY change their part of speech or position if it helps flow.
      
      HUMAN-LIKE FLUCTUATION & ANTI-SMOOTHING RULES:
      1. SYNTAX DIVERSITY: Avoid rhythmic consistency. Mix short, punchy sentences with complex, nested ones. At least 30% of sentences must be structurally simple.
      2. THE BLACKLIST (FORBIDDEN TRANSITIONS): You MUST NEVER use the following AI-typical transitions: "Notably,", "Moreover,", "Furthermore,", "In conclusion,", "Additionally,", "Consequently,", "Specifically,", "Ultimately,". 
         - Alternative Strategy: Use "Zero-transition" (start directly) or causal phrasings (e.g., "This leads to...", "The catch is...", "Then there is the issue of...").
      3. ASYMMETRY: Prohibit starting three consecutive sentences with the same structure. Incorporate occasional concessive clauses or parenthetical insertions (e.g., ", which was unexpected," or ", though limited,").
      4. VOICE SEEDS: Incorporate the 'voice_seeds' provided in the plan to inject semantic redundancy or a specific academic persona.

      The JSON schema you must follow:
      {
        "candidates": [
          {
            "rewritten_text": "string",
            "mode": "${mode}",
            "candidate_id": "c1"
          },
          {
            "rewritten_text": "string",
            "mode": "${mode}",
            "candidate_id": "c2"
          }
        ]
      }
    `;

    const userPrompt = `
      Original Text:
      "${current_text}"

      Revision Plan:
      Goals: ${JSON.stringify(latestPlan.goals_json)}
      Constraints: ${JSON.stringify(latestPlan.constraints_json)}
      Suggested Actions: ${JSON.stringify(latestPlan.suggested_actions_json)}
      Voice Seeds: ${JSON.stringify(latestPlan.style_alignment_notes_json)}

      Rewrite Mode: ${mode}

      Generate 2 high-quality candidate rewrites. Do NOT output a rationale.
    `;

    // 4. Call Groq LLM (Preferably switch to Claude/Gemma in the future, using Llama for MVP)
    const { result, rawOutput } = await generateStructuredOutput({
      systemPrompt,
      userPrompt,
      schema: RewriteCandidatesResponseSchema,
      model: "llama-3.3-70b-versatile",
    });

    // 5. Save Candidates to DB
    const candidatesToInsert = result.candidates.map((c) => ({
      paragraph_id: paragraphId,
      plan_id: latestPlan.id,
      mode: mode,
      rewritten_text: c.rewritten_text,
      rationale: "Rationale disabled to prevent JSON-logic alignment.",
      model_name: "llama-3.3-70b-versatile",
      prompt_version: "v1.1-anti-ai-smoothing",
    }));

    const { data: savedCandidates, error: candidatesError } = await supabase
      .from("rewrite_candidates")
      .insert(candidatesToInsert)
      .select();

    if (candidatesError) {
      throw new Error(`Failed to save candidates: ${candidatesError.message}`);
    }

    return NextResponse.json({ candidates: savedCandidates });
  } catch (error: any) {
    console.error(`[POST /api/paragraphs/rewrite] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

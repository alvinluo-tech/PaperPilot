import { NextResponse } from "next/server";
import { createClient } from "@/infrastructure/database/supabase/server";
import { generateStructuredOutput } from "@/infrastructure/llm/groq/service";
import { ValidationReportSchema } from "@/domain/types/schemas";
import { z } from "zod";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: candidateId } = await params;
    const supabase = await createClient();

    // 1. Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch Candidate & Original Paragraph
    const { data: candidate, error: candidateError } = await supabase
      .from("rewrite_candidates")
      .select(`
        *,
        paragraphs (id, current_text),
        revision_plans (constraints_json)
      `)
      .eq("id", candidateId)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const { rewritten_text, paragraphs, revision_plans } = candidate;
    const originalText = paragraphs?.current_text;
    const constraints = revision_plans?.constraints_json || [];

    if (!originalText) {
      return NextResponse.json({ error: "Original paragraph text missing" }, { status: 400 });
    }

    // 3. (NEW STEP) Perturbation / Random Noise Step
    // Introduce a lightweight "humanization" step before validation to break the AI probability distribution.
    const perturbationPrompt = `
      You are an expert human academic editor whose goal is "De-perfection" (Imperfection Injection). 
      Your task is to introduce 1-2 VERY MINOR, slightly informal or asymmetric structural changes to the text below to make it sound less like a machine and more like a real human drafting a manuscript.
      
      Examples of allowed changes:
      - Punctuation shifts: Use an em-dash (—) instead of a colon or parenthesis in an informal context, or use a semicolon to connect two related sentences.
      - Redundant human phrasing: Add a conversational filler at the start of a sentence like "To be fair," or "As it turns out," or "Interestingly,".
      - Change an active voice to a passive voice (or vice versa) in exactly one place.

      DO NOT CHANGE THE CORE MEANING. DO NOT CHANGE ANY NUMBERS, DATES, OR NAMES.
      Return ONLY the final perturbed text in JSON format:
      {
        "perturbed_text": "string"
      }
    `;

    const { result: perturbationResult } = await generateStructuredOutput({
      systemPrompt: perturbationPrompt,
      userPrompt: `Text to perturb:\n"${rewritten_text}"`,
      schema: z.object({ perturbed_text: z.string() }),
      model: "llama-3.1-8b-instant", // Using a smaller/faster model for just adding noise
    });

    const finalRewrittenText = perturbationResult.perturbed_text || rewritten_text;

    // 4. Prepare Prompt for Validation
    // According to PRD: Use heterogeneous model for validation. If rewrite=Llama, validate=Qwen.
    // Since Groq provides Gemma or Mixtral, let's use `mixtral-8x7b-32768` or `gemma2-9b-it` as the heterogeneous validator.
    const systemPrompt = `
      You are a strict academic integrity validator.
      Compare the 'Original Text' and the 'Rewritten Text'.
      Check for:
      - Semantic Shift (does it change the core meaning or the subject of any sentence?)
      - Number/Data Mismatch (did any specific numbers, percentages, dates, or mathematical relationships change, disappear, or get added?)
      - Overclaim (does it state things more strongly than the original?)
      - Unsupported Additions (did it invent facts/citations?)
      - Terminology Preservation (were locked terms altered?)

      CRITICAL TOLERANCE INSTRUCTION:
      Allow for minor stylistic variations, human-like conversational fillers (e.g., "To be fair"), and informal structural shifts (e.g., em-dashes, semicolons), as long as the core numerical data and the primary claim remain intact. We are looking for "semantic loyalty", not "syntactic identity".

      If ANY numbers or facts differ between the Original Text and the Rewritten Text, you MUST set validation_status to "fail".

      Return a strict JSON output following the schema:
      {
        "validation_status": "pass|fail|needs_review",
        "semantic_consistency": "Brief explanation of meaning changes.",
        "terminology_preserved": true|false,
        "citation_alignment": true|false,
        "deterministic_check_report": { "numbers_match": true, "citations_match": true },
        "blocked_reasons": ["List any specific reasons it fails (empty if pass)"],
        "validator_notes": "Final verdict notes."
      }
    `;

    const userPrompt = `
      Original Text:
      "${originalText}"

      Rewritten Text:
      "${finalRewrittenText}"

      Constraints that were supposed to be preserved:
      ${JSON.stringify(constraints)}

      Validate the rewrite strictly.
    `;

    // 5. Call Groq LLM (Heterogeneous model)
    const { result: validationResult } = await generateStructuredOutput({
      systemPrompt,
      userPrompt,
      schema: ValidationReportSchema,
      model: "mixtral-8x7b-32768", // using Mixtral for cross-validation
    });

    // 6. Save Validation Report to DB
    const { data: savedReport, error: reportError } = await supabase
      .from("validation_reports")
      .insert({
        candidate_id: candidateId,
        semantic_consistency: validationResult.semantic_consistency,
        terminology_preserved: validationResult.terminology_preserved,
        citation_alignment: validationResult.citation_alignment,
        deterministic_report_json: validationResult.deterministic_check_report,
        blocked_reasons_json: validationResult.blocked_reasons,
        validator_notes: validationResult.validator_notes,
        model_name: "mixtral-8x7b-32768",
        prompt_version: "v1.1-perturbation-added",
      })
      .select()
      .single();

    if (reportError) {
      throw new Error(`Failed to save validation report: ${reportError.message}`);
    }

    // Optional: If you wanted to update the candidate text with the perturbed text, you would do an UPDATE on rewrite_candidates here.
    // For now, we validate the perturbed text.
    await supabase.from('rewrite_candidates').update({ rewritten_text: finalRewrittenText }).eq('id', candidateId);

    return NextResponse.json({ validation: savedReport, perturbedText: finalRewrittenText });
  } catch (error: any) {
    console.error(`[POST /api/candidates/validate] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

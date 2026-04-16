import { z } from "zod";

// Risk Tags defined in PRD
export const RiskTagSchema = z.enum([
  "T1", // Template-like phrasing
  "T2", // Low information density
  "T3", // Weak evidence support
  "T4", // Weak author stance
  "T5", // Over-uniform syntax/rhythm
  "T6", // Generic term usage
  "T7", // Paragraph function imbalance
  "T8", // Citation-claim mismatch
]);

// Structural Parsing Layer Schemas
export const ParagraphRoleSchema = z.enum([
  "topic_sentence",
  "evidence",
  "explanation",
  "comparison",
  "transition",
  "claim",
  "conclusion",
]);

export const SectionTypeSchema = z.enum([
  "title",
  "abstract",
  "introduction",
  "literature_review",
  "methods",
  "results",
  "discussion",
  "conclusion",
  "unknown",
]);

export const StructuralParsingSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string(),
      type: SectionTypeSchema,
      startIndex: z.number(),
      endIndex: z.number(),
    })
  ),
  paragraphs: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      role_guess: ParagraphRoleSchema.optional(),
      section_type: SectionTypeSchema.optional(),
      citation_spans: z.array(
        z.object({
          text: z.string(),
          startIndex: z.number(),
          endIndex: z.number(),
        })
      ),
      term_candidates: z.array(z.string()),
    })
  ),
});

// Risk Diagnosis Layer Schema
export const EvidenceSpanSchema = z.object({
  text: z.string(),
  reason: z.string(),
});

export const DiagnosisSchema = z.object({
  paragraph_id: z.string(),
  tags: z.array(RiskTagSchema),
  severity: z.enum(["low", "medium", "high", "critical"]),
  evidence_spans: z.array(EvidenceSpanSchema),
  explanation: z.string(),
  revision_priority: z.enum(["low", "medium", "high"]),
});

// Enhancement Planning Layer Schema
export const RewriteModeSchema = z.enum([
  "academic_rigorous",
  "clarity_enhanced",
  "authorial_analysis",
]);

export const RevisionPlanSchema = z.object({
  revision_goals: z.array(z.string()),
  preserve_constraints: z.array(z.string()),
  suggested_actions: z.array(z.string()),
  voice_seeds: z.array(z.string()), // Added to inject human-like stylistic perspectives
  optional_evidence_slots: z.array(z.string()),
  rewrite_mode_candidates: z.array(RewriteModeSchema),
  style_alignment_notes: z.array(z.string()).optional(),
});

// Constrained Rewriting Layer Schema (Decoupled, simpler output)
export const RewriteCandidateSchema = z.object({
  candidate_id: z.string(),
  mode: RewriteModeSchema,
  rewritten_text: z.string(),
});

// Validation Layer Schema
export const ValidationReportSchema = z.object({
  validation_status: z.enum(["pass", "fail", "needs_review"]),
  semantic_consistency: z.string(),
  terminology_preserved: z.boolean(),
  citation_alignment: z.boolean(),
  deterministic_check_report: z.record(z.string(), z.any()),
  blocked_reasons: z.array(z.string()),
  validator_notes: z.string(),
});

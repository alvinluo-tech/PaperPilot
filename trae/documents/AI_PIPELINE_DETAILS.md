# PaperPilot AI Pipeline Details

This document outlines the current AI processing pipelines for both the **User-facing Editor Flow** and the **Backend Data Factory Flow**. It details the models used, the specific prompts, and the anti-AI detection strategies employed.

---

## 1. User-facing Editor Flow (Academic Rewriting)

The user-side flow focuses on **Constrained Rewriting**, ensuring that academic integrity is maintained while breaking typical AI probability distributions to bypass AI detectors.

### 1.1 Diagnosis Phase
- **Endpoint**: `/api/paragraphs/[id]/diagnose`
- **Model**: `llama-3.3-70b-versatile` (via Groq)
- **Role**: Expert academic writing diagnostician
- **Prompt Strategy**: Analyzes the paragraph and identifies specific writing risks using exact codes (e.g., `T1: Template-like phrasing`, `T5: Over-uniform syntax/rhythm`). It strictly avoids judging whether the text is AI-generated, focusing solely on academic quality and authorship markers.

### 1.2 Planning Phase
- **Endpoint**: `/api/paragraphs/[id]/plan`
- **Model**: `llama-3.3-70b-versatile`
- **Role**: Strategy generator
- **Output**: Generates a structured JSON plan containing `goals`, `constraints` (what must not be changed), `suggested_actions`, and `voice_seeds` (to inject specific academic personas).

### 1.3 Rewriting Phase
- **Endpoint**: `/api/paragraphs/[id]/rewrite`
- **Model**: `llama-3.3-70b-versatile`
- **Role**: Expert academic editor performing "Constrained Rewriting"
- **Prompt Strategy (Anti-Smoothing)**:
  - **Faithfulness & Constraints**: Absolute preservation of numerical data, citations, and locked terminology.
  - **Syntax Diversity**: Mandates a mix of short, punchy sentences and complex nested ones (at least 30% structurally simple).
  - **The Blacklist**: Strictly forbids AI-typical transitions ("Notably,", "Moreover,", "Furthermore,", "In conclusion,", "Additionally,"). Forces the use of "Zero-transition" or direct causal phrasings.
  - **Asymmetry**: Prohibits starting three consecutive sentences with the same structure. Encourages parenthetical insertions.
  - **Voice Seeds**: Injects semantic redundancy or specific academic personas to break standard LLM generation patterns.

### 1.4 Validation Phase
- **Endpoint**: `/api/candidates/[id]/validate`
- **Model**: `llama-3.3-70b-versatile`
- **Role**: Evaluator verifying the candidate against the original text.

---

## 2. Backend Data Factory Flow (LoRA Dataset Generation)

The Data Factory flow is designed to bulk-process raw AI text into high-quality "Gold Standard" segments suitable for Fine-Tuning (LoRA) or human review.

### 2.1 Ingest & Chunking
- **Action**: `ingestProjectAction` (Server Action)
- **Method**: Rule-based text processing.
- **Strategy**: Splits raw text by double newlines (`\n\n`) into paragraphs. If a paragraph has fewer than 50 words, it merges it with the subsequent paragraph to maintain contextual density.

### 2.2 Pipeline Rewrite (with Mathematical Surprisal Guidance)
- **Action**: `rewriteSegmentAction` (Server Action)
- **Models**: 
  - `meta-llama/Meta-Llama-3-8B-Instruct-Lite` (via Together AI) - For Surprisal (Log-probs) Extraction.
  - `llama-3.3-70b-versatile` (via Groq) - For the actual rewriting.
- **Role**: Expert academic editor driven by mathematical feedback
- **Prompt Strategy**:
  - **Mathematical Fluctuation Injection**: Before rewriting, the system calls the Together AI API to extract the `logprobs` of the original text. It calculates the **Variance of Surprisal ($\text{Var}(S)$)**, the **Variance of the Second-Order Derivative ($\text{Var}(\Delta^2 S)$)**, and the **Positivity Ratio of the First-Order Derivative**. Based on these mathematical metrics, it injects highly specific, dynamic constraints into the rewrite prompt (e.g., "Variance of Surprisal is too low: Please introduce 1-2 low-frequency academic terms...").
  - **Syntax Diversity**: Mix short, punchy sentences with complex ones. Avoid rhythmic consistency.
  - **Unpredictability**: Bypasses AI probability distributions by avoiding common AI transitions (The Blacklist).
  - **Human-like Fluctuation**: Intentionally allows minor stylistic variations, non-standard punctuation (like dashes), or slight informal structural shifts.
  - **Strict Output**: "NO APOLOGIES OR META-TEXT", ensuring clean dataset generation.

### 2.3 LLM Expert Evaluation (LLM-as-a-Judge)
- **Action**: `evaluateRewriteAction` (Server Action)
- **Model**: `llama-3.3-70b-versatile` (Chosen for high reliability in forced JSON object generation)
- **Role**: 严苛的学术反抄袭专家 (Strict Academic Anti-Plagiarism Expert)
- **Prompt Strategy (Anchoring & Scoring)**:
  - **Dimensions**: Evaluates Factuality (事实保真度), Syntax Diversity (句式多样性), and Imperfection/Human-likeness (人工特征).
  - **Anchoring Rule**: Explicitly instructs the model that *most AI-generated text should score between 4-6*, and only texts with "human-specific flaws and imperfections" deserve an 8+. This prevents the LLM's natural bias to give overly high scores.
  - **Temperature**: Set to `0.7` to allow for more nuanced, diverse reasoning in the generated rationale (`llm_judge_reason`).
  - **Output Metrics**: 
    - `score_llm_judge` (1-10)
    - `score_semantic` (0.0 - 1.0)
    - `score_risk` (0.0 - 1.0) - Probability of being detected as AI.

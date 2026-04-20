"use server";

import { createClient } from '@/infrastructure/database/supabase/server';
import { groq } from '@/infrastructure/llm/groq/client';
import { revalidatePath } from 'next/cache';

function getMathGuidance(tokensData: { token: string, logprob: number }[]): { guidance: string, metricsLog: string } {
  // 1. Filter out first token and punctuation
  const validTokens = tokensData.slice(1).filter(t => {
    const isPunctuation = /^[.,?!;:'"()[\]{}]+$/.test(t.token.trim());
    const isEmpty = t.token.trim() === '';
    return !isPunctuation && !isEmpty;
  });

  const surprisals = validTokens.map(t => -t.logprob);

  if (!surprisals || surprisals.length < 3) return { guidance: "", metricsLog: "Not enough valid tokens to calculate surprisal." };
  
  const meanS = surprisals.reduce((a, b) => a + b, 0) / surprisals.length;
  const varS = surprisals.reduce((a, b) => a + Math.pow(b - meanS, 2), 0) / surprisals.length;
  
  const deltaS = [];
  for (let i = 1; i < surprisals.length; i++) deltaS.push(surprisals[i] - surprisals[i-1]);
  
  const delta2S = [];
  for (let i = 1; i < deltaS.length; i++) delta2S.push(deltaS[i] - deltaS[i-1]);
  
  const meanDelta2S = delta2S.reduce((a, b) => a + b, 0) / delta2S.length;
  const varDelta2S = delta2S.reduce((a, b) => a + Math.pow(b - meanDelta2S, 2), 0) / delta2S.length;
  
  const posDeltaSCount = deltaS.filter(d => d > 0).length;
  const posDeltaSRatio = posDeltaSCount / deltaS.length;

  const metricsLog = `
=== Mathematical Surprisal Metrics ===
Valid Token Count: ${surprisals.length}
Var(S) [Surprisal Variance]: ${varS.toFixed(4)} (Threshold: < 1.0)
Var(Δ²S) [2nd Derivative Variance]: ${varDelta2S.toFixed(4)} (Threshold: < 1.5)
Positivity Ratio of ΔS: ${(posDeltaSRatio * 100).toFixed(2)}% (Threshold: > 70%)
======================================`;

  console.log(metricsLog);

  const guidance = [];
  if (varS < 1.0) {
    guidance.push("- Variance of Surprisal is too low: Please introduce 1-2 low-frequency academic terms and reduce the proportion of functional words.");
  }
  if (varDelta2S < 1.5) {
    guidance.push("- Second-order derivative of Surprisal is too smooth: Please drastically change sentence lengths: insert a short sentence of under 5 words between two long complex sentences to artificially create a surprisal cliff.");
  }
  if (posDeltaSRatio > 0.7) {
    guidance.push("- Surprisal monotonically increasing: Please break expectations at logical connections; do not use typical transition words, jump directly to the core point.");
  }
  
  return { guidance: guidance.join("\n"), metricsLog };
}

export async function rewriteSegmentAction(segmentId: string) {
  try {
    if (!segmentId) {
      return { error: 'Segment ID is required' };
    }

    const supabase = await createClient();

    // 1. Fetch the segment
    const { data: segment, error: fetchError } = await supabase
      .from('factory_segments')
      .select('*')
      .eq('id', segmentId)
      .single();

    if (fetchError || !segment) {
      return { error: 'Segment not found' };
    }

    // 1.5 Calculate Mathematical Fluctuation (Surprisal) via Together AI
    let mathGuidance = "";
    let mathMetricsLog = "";
    try {
      const togetherApiKey = process.env.TOGETHER_API_KEY || 'tgp_v1_nGUO3yq3Hl4ltQG9dsXJETpoX-MKjez1i6oQwbG3fMU';
      const togetherResponse = await fetch("https://api.together.xyz/v1/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${togetherApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-llama/Meta-Llama-3-8B-Instruct-Lite",
          prompt: segment.original_content,
          max_tokens: 0, // Request 0 tokens so the API only processes and returns the prompt
          echo: true,
          logprobs: 1
        })
      });
      
      if (togetherResponse.ok) {
        const data = await togetherResponse.json();
        
        // Log the entire choices array for debugging Together's structure
        // console.log("Together API Choices:", JSON.stringify(data.choices, null, 2));

        const logprobsObj = data.choices?.[0]?.logprobs;
        let tokensData: { token: string, logprob: number }[] = [];
        
        if (logprobsObj && Array.isArray(logprobsObj.tokens) && Array.isArray(logprobsObj.token_logprobs)) {
          // Together v1/completions echo format
          tokensData = logprobsObj.tokens.map((token: string, idx: number) => ({
            token: token,
            logprob: typeof logprobsObj.token_logprobs[idx] === 'number' ? logprobsObj.token_logprobs[idx] : 0
          }));
          
          if (tokensData.length < 5) {
            mathMetricsLog = "Warning: Together API returned very few tokens (" + tokensData.length + "). Likely it didn't echo the prompt logprobs.\nData: " + JSON.stringify(logprobsObj).substring(0, 300);
            console.log(mathMetricsLog);
          }
        } else if (logprobsObj && Array.isArray(logprobsObj.token_ids) && Array.isArray(logprobsObj.token_logprobs)) {
          // Alternative Together Format (some models return this structure)
          tokensData = logprobsObj.tokens.map((token: string, idx: number) => ({
            token: token,
            logprob: typeof logprobsObj.token_logprobs[idx] === 'number' ? logprobsObj.token_logprobs[idx] : 0
          }));
        } else {
          mathMetricsLog = "Warning: Together API returned OK, but no logprobs found in response:\n" + JSON.stringify(data).substring(0, 500);
          console.log(mathMetricsLog);
        }

        if (tokensData.length > 0) {
          const mathResult = getMathGuidance(tokensData);
          mathGuidance = mathResult.guidance;
          mathMetricsLog = mathMetricsLog || mathResult.metricsLog;
          
          if (mathGuidance) {
            console.log('[Surprisal Guidance Injected]:\n', mathGuidance);
          } else {
            console.log('[Surprisal Guidance]: Text metrics are within human-like thresholds. No extra constraints injected.');
          }
        }
      } else {
        mathMetricsLog = `Together AI logprobs error: API returned ${togetherResponse.status} - ${togetherResponse.statusText}`;
        console.error(mathMetricsLog);
      }
    } catch (e: any) {
      mathMetricsLog = `Together AI fetch error: ${e.message}`;
      console.error(mathMetricsLog);
    }

    // 2. Perform the rewrite using Groq (Llama-3.3-70b)
    let systemPrompt = `You are an expert academic editor. Your goal is to rewrite the provided academic text to be more human-like, removing typical AI-generated patterns.
Follow these strict rules:
1. SYNTAX DIVERSITY: Mix short, punchy sentences with complex ones. Avoid rhythmic consistency.
2. UNPREDICTABILITY: Do not use common AI transitions (e.g., 'Notably', 'Furthermore', 'Moreover', 'In conclusion', 'Additionally'). Use direct causal links.
3. PRESERVE MEANING: Do not change the core numerical data, facts, or the primary claim.
4. HUMAN-LIKE FLUCTUATION: Allow minor stylistic variations, non-standard punctuation (like dashes), or slight informal structural shifts to break AI probability distribution.
5. NO APOLOGIES OR META-TEXT: Return ONLY the rewritten text, nothing else.`;

    if (mathGuidance) {
      systemPrompt += `\n\nMATHEMATICAL SURPRISAL GUIDANCE (Based on Log-probs Analysis of the original text):\n${mathGuidance}`;
    }

    const promptConfig = {
      system_prompt: systemPrompt,
      model: "llama-3.3-70b-versatile",
      temperature: 0.85,
      max_tokens: 1024
    };

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: promptConfig.system_prompt },
        { role: 'user', content: `Original text:\n\n${segment.original_content}` }
      ],
      model: promptConfig.model,
      temperature: promptConfig.temperature,
      max_tokens: promptConfig.max_tokens,
    });

    const rewrittenText = completion.choices[0]?.message?.content?.trim();

    if (!rewrittenText) {
      return { error: 'Failed to generate rewrite' };
    }

    // 3. Save the rewrite to the database
    const { data: rewrite, error: insertError } = await supabase
      .from('factory_rewrites')
      .insert({
        segment_id: segment.id,
        model_version: 'Llama-3.3-v1.2-Factory',
        prompt_config: promptConfig,
        output_text: rewrittenText
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting rewrite:', insertError);
      return { error: 'Failed to save rewrite' };
    }

    revalidatePath(`/factory/project/${segment.project_id}`);
    return { rewrite, mathMetricsLog, error: null };

  } catch (error) {
    console.error('Factory Rewrite Action Error:', error);
    return { error: 'Internal Server Error' };
  }
}

export async function ingestProjectAction(prevState: { error: string | null, success?: boolean }, formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const domain = formData.get("domain") as string;
    const content = formData.get("content") as string;

    if (!name || !content) {
      return { error: "Name and content are required", success: false };
    }

    const supabase = await createClient();
    
    // Auth Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Unauthorized", success: false };
    }

    // 1. Create Project
    const { data: project, error: projError } = await supabase
      .from('factory_projects')
      .insert({
        name,
        domain: domain || 'General',
        user_id: user.id
      })
      .select()
      .single();

    if (projError) return { error: projError.message, success: false };

    // 2. Chunking Logic (M1)
    const rawParagraphs = content.split(/\n\s*\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
    
    const chunks: string[] = [];
    let currentChunk = "";

    for (const p of rawParagraphs) {
      const pWordCount = p.split(/\s+/).length;
      
      if (currentChunk) {
        const currentWordCount = currentChunk.split(/\s+/).length;
        if (currentWordCount < 50) {
          // Merge if current chunk is too short
          currentChunk += "\n\n" + p;
        } else {
          chunks.push(currentChunk);
          currentChunk = p;
        }
      } else {
        currentChunk = p;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    // 3. Save Segments
    const segmentsData = chunks.map((text, idx) => ({
      project_id: project.id,
      original_content: text,
      word_count: text.split(/\s+/).length,
      order_index: idx
    }));

    const { error: segError } = await supabase
      .from('factory_segments')
      .insert(segmentsData);

    if (segError) return { error: segError.message, success: false };

    revalidatePath('/factory');
    return { error: null, success: true };

  } catch (error: any) {
    console.error("[Factory Ingest Action Error]", error);
    return { error: error.message || "Internal Server Error", success: false };
  }
}

export async function evaluateRewriteAction(rewriteId: string, originalText: string, rewrittenText: string) {
  try {
    if (!rewriteId || !originalText || !rewrittenText) {
      return { error: 'Missing required fields' };
    }

    const supabase = await createClient();

    // 1. LLM-as-a-Judge Evaluation (Using Llama 3.3 for reliable JSON format)
    const prompt = `作为严苛的学术反抄袭专家，请仔细对比以下两段文本。

【评估维度】
1. 事实保真度：核心事实和数值是否完全保留？
2. 句式多样性：是否打破了AI典型的"八股文"平滑句式？
3. 人工特征(Imperfection)：是否存在轻微的、人类独有的非正式结构或非对称性？

【评估要求】
务必保持严苛标准，大多数AI生成的改写文本得分应在 4-6 分。只有真正具备"人类特有的瑕疵与不完美"的文本才能得 8 分以上。
根据以上维度，输出以下两个小数（范围 0.0 - 1.0）和一个整数（范围 1-10）：
- 语义相似度 (score_semantic): 核心语义的保留比例
- AI 风险值 (score_risk): 如果这是一篇期末论文，你认为它是AI生成的概率有多大？(越像AI，值越接近1.0)
- 综合得分 (score_llm_judge): 基于事实保留、非平滑感和去AI特征的1-10综合评分

输出格式必须是严格的 JSON 对象：
{
  "score_llm_judge": 5,
  "llm_judge_reason": "这里用一句话简短解释打分理由，说明它的破绽或者它的精彩之处。",
  "score_semantic": 0.95,
  "score_risk": 0.85
}

原文:
${originalText}

改写稿:
${rewrittenText}
`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const resultText = completion.choices[0]?.message?.content || '{}';
    let evaluationData;
    
    try {
      evaluationData = JSON.parse(resultText);
    } catch (e) {
      console.error('Failed to parse LLM evaluation JSON:', resultText);
      return { error: 'Evaluation format error' };
    }

    // 2. Save evaluation results to DB
    const { data: evaluation, error: insertError } = await supabase
      .from('factory_evaluations')
      .insert({
        rewrite_id: rewriteId,
        score_semantic: evaluationData.score_semantic || 0,
        score_risk: evaluationData.score_risk || 0,
        score_llm_judge: evaluationData.score_llm_judge || 0,
        llm_judge_reason: evaluationData.llm_judge_reason || 'No rationale provided.',
        human_vote: null,
        is_gold_standard: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting evaluation:', insertError);
      return { error: 'Failed to save evaluation' };
    }

    return { evaluation, error: null };

  } catch (error) {
    console.error('Factory Evaluate Action Error:', error);
    return { error: 'Internal Server Error' };
  }
}

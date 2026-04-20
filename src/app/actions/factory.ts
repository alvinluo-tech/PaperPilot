"use server";

import { createClient } from '@/infrastructure/database/supabase/server';
import { groq } from '@/infrastructure/llm/groq/client';
import { revalidatePath } from 'next/cache';

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

    // 2. Perform the rewrite using Groq (Llama-3.3-70b)
    const promptConfig = {
      system_prompt: `You are an expert academic editor. Your goal is to rewrite the provided academic text to be more human-like, removing typical AI-generated patterns.
Follow these strict rules:
1. SYNTAX DIVERSITY: Mix short, punchy sentences with complex ones. Avoid rhythmic consistency.
2. UNPREDICTABILITY: Do not use common AI transitions (e.g., 'Notably', 'Furthermore', 'Moreover', 'In conclusion', 'Additionally'). Use direct causal links.
3. PRESERVE MEANING: Do not change the core numerical data, facts, or the primary claim.
4. HUMAN-LIKE FLUCTUATION: Allow minor stylistic variations, non-standard punctuation (like dashes), or slight informal structural shifts to break AI probability distribution.
5. NO APOLOGIES OR META-TEXT: Return ONLY the rewritten text, nothing else.`,
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
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
    return { rewrite, error: null };

  } catch (error) {
    console.error('Factory Rewrite Action Error:', error);
    return { error: 'Internal Server Error' };
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

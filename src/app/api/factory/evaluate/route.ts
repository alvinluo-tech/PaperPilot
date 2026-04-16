import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/database/supabase/server';
import { groq } from '@/infrastructure/llm/groq/client';

export async function POST(request: Request) {
  try {
    const { rewrite_id, original_text, rewritten_text } = await request.json();
    
    if (!rewrite_id || !original_text || !rewritten_text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. LLM-as-a-Judge Evaluation (Using Mixtral for heterogeneous evaluation)
    const prompt = `作为学术审稿人，请对比原文与改写稿。
从以下三个维度给改写稿进行综合打分（1-10分）：
- 事实保真 (Factuality)
- 句式多样性 (Syntax Diversity)
- 去 AI 特征 (Human-likeness / Imperfections)

请同时估算以下两个数值（0.0 到 1.0 之间）：
- 语义相似度 (Semantic Similarity)：改写前后保留的核心语义比例
- AI 风险值 (AI Risk Score)：这段文本被检测为 AI 生成的概率

输出格式必须是严格的 JSON 对象：
{
  "score_llm_judge": 8,
  "llm_judge_reason": "简短的中文打分理由...",
  "score_semantic": 0.95,
  "score_risk": 0.12
}

原文:
${original_text}

改写稿:
${rewritten_text}
`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: "mixtral-8x7b-32768",
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const resultText = completion.choices[0]?.message?.content || '{}';
    let evaluationData;
    
    try {
      evaluationData = JSON.parse(resultText);
    } catch (e) {
      console.error('Failed to parse LLM evaluation JSON:', resultText);
      return NextResponse.json({ error: 'Evaluation format error' }, { status: 500 });
    }

    // 2. Save evaluation results to DB
    const { data: evaluation, error: insertError } = await supabase
      .from('factory_evaluations')
      .insert({
        rewrite_id,
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
      return NextResponse.json({ error: 'Failed to save evaluation' }, { status: 500 });
    }

    return NextResponse.json({ evaluation });

  } catch (error) {
    console.error('Factory Evaluate Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

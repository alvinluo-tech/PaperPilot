import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/database/supabase/server';
import { groq } from '@/infrastructure/llm/groq/client';

export async function POST(request: Request) {
  try {
    const { segment_id } = await request.json();
    
    if (!segment_id) {
      return NextResponse.json({ error: 'Segment ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // 1. Fetch the segment
    const { data: segment, error: fetchError } = await supabase
      .from('factory_segments')
      .select('*')
      .eq('id', segment_id)
      .single();

    if (fetchError || !segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
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
      return NextResponse.json({ error: 'Failed to generate rewrite' }, { status: 500 });
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
      return NextResponse.json({ error: 'Failed to save rewrite' }, { status: 500 });
    }

    return NextResponse.json({ rewrite });

  } catch (error) {
    console.error('Factory Rewrite Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

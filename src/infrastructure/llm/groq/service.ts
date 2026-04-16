import { groq } from "./client";
import { z } from "zod";

interface StructuredOutputParams<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function generateStructuredOutput<T>({
  systemPrompt,
  userPrompt,
  schema,
  model = "llama-3.3-70b-versatile",
  temperature = 0.2,
  maxTokens = 2048,
}: StructuredOutputParams<T>): Promise<{ result: T; rawOutput: string }> {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content returned from Groq API.");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch (parseError) {
      throw new Error(`Failed to parse LLM output as JSON. Output: ${content}`);
    }

    const validatedData = schema.parse(parsedJson);

    return {
      result: validatedData,
      rawOutput: content,
    };
  } catch (error) {
    console.error("[generateStructuredOutput] Error:", error);
    throw error;
  }
}

import { aiProxy } from './aiProxy';
import { Question } from './mockDatabase';
import { groqService } from './groqService';
import { BUILT_IN_GEMINI_KEYS, getGeminiApiKeys, getGroqApiKeys } from './apiKeyPool';

export const DEFAULT_GEMINI_KEY = BUILT_IN_GEMINI_KEYS[0];

// Balanced defaults for free/developer-tier use. These still provide strong
// structured reasoning without paying the latency/token cost of 3.6 Flash on
// every interview question, evaluation, and report.
const PRIMARY_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

const getGeminiAttempts = (preferredKey?: string) =>
  getGeminiApiKeys(preferredKey).flatMap(activeKey =>
    [PRIMARY_MODEL, FALLBACK_MODEL].map(modelName => ({ activeKey, modelName }))
  );

export interface EvaluationResult {
  score: number;
  technicalScore: number;
  communicationScore: number;
  structureScore: number;
  strengths: string;
  weaknesses: string;
  feedback: string;
  modelAnswer: string;
}

export interface AdaptiveQuestionResult {
  shouldContinue: boolean;
  nextQuestion?: Partial<Question>;
}

export interface ResumeRatingResult {
  overallScore: number;
  atsScore: number;
  contentScore: number;
  formattingScore: number;
  impactScore: number;
  strengths: string[];
  improvements: string[];
  missingKeywords: string[];
  summary: string;
}

const cleanJson = (value: string): string => {
  let text = value.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    const lastBrace = text.lastIndexOf('}');
    if (lastBrace > firstBrace) {
      return text.slice(firstBrace, lastBrace + 1);
    }
  } else if (firstBracket !== -1) {
    const lastBracket = text.lastIndexOf(']');
    if (lastBracket > firstBracket) {
      return text.slice(firstBracket, lastBracket + 1);
    }
  }
  return text;
};

const parseJson = (content: string): unknown => {
  try {
    return JSON.parse(cleanJson(content));
  } catch {
    throw new Error('Gemini returned invalid JSON format.');
  }
};

const parseScore = (value: Record<string, unknown>, keys: string[], defaultScore = 50): number => {
  for (const k of keys) {
    const raw = value[k];
    if (typeof raw === 'number') {
      return Math.min(100, Math.max(0, Math.round(raw)));
    }
    if (typeof raw === 'string') {
      const parsed = parseFloat(raw.replace(/[^\d.]/g, ''));
      if (!isNaN(parsed)) {
        return Math.min(100, Math.max(0, Math.round(parsed)));
      }
    }
  }
  return defaultScore;
};

const parseText = (value: Record<string, unknown>, keys: string[], defaultText = ''): string => {
  for (const k of keys) {
    const raw = value[k];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map(item => `• ${String(item).trim().replace(/^[-•*]\s*/, '')}`).filter(Boolean).join('\n');
    }
  }
  return defaultText;
};

const getGenAIModel = (apiKey: string, modelName: string, jsonMode = false) => {
  void apiKey;
  return { async generateContent(prompt: string) {
    const response = await aiProxy('gemini', modelName, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(jsonMode ? { generationConfig: { responseMimeType: 'application/json' } } : {})
    });
    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('');
    if (!text) throw new Error('AI returned an empty response.');
    return { response: { text: () => text as string } };
  } };
};

export const geminiService = {
  async generateQuestions(
    roleTitle: string,
    difficulty: string,
    type: string,
    jobDescription: string,
    count: number,
    apiKey?: string
  ): Promise<Partial<Question>[]> {
    const attempts = getGeminiAttempts(apiKey);

    const prompt = `
      You are an expert recruiter and technical interviewer.
      Generate a list of exactly ${count} interview questions for a candidate preparing for the following position:
      - Role: ${roleTitle}
      - Seniority/Difficulty: ${difficulty}
      - Interview Type: ${type}
      ${jobDescription ? `- Additional Context (Job Description): ${jobDescription}` : ''}

      Return a JSON array of objects matching this structure:
      [
        {
          "id": "q_1",
          "text": "The interview question text",
          "type": "technical",
          "difficulty": "senior",
          "modelAnswer": "A concise, high-quality model answer to guide the candidate",
          "keywords": ["5-8 key technical terms or concepts that should appear in a good response"]
        }
      ]
      Ensure questions are realistic, challenging, and tailored precisely to the seniority and job description if provided.
      Output valid JSON array only.
    `;

    for (const { activeKey, modelName } of attempts) {
      try {
        const model = getGenAIModel(activeKey, modelName, true);
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsed = parseJson(responseText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as Partial<Question>[];
        }
      } catch (err) {
        console.warn(`Gemini (${modelName}) question generation error:`, err);
      }
    }

    // Fallback to Groq if Gemini fails
    try {
      console.warn("Falling back to Groq for question generation...");
      for (const groqKey of getGroqApiKeys()) {
        try {
          return await groqService.generateQuestions(roleTitle, difficulty, type, jobDescription, count, groqKey);
        } catch (error) {
          console.warn('Groq key failed for question generation, rotating:', error);
        }
      }
    } catch (groqErr) {
      console.error("Groq fallback also failed:", groqErr);
    }

    throw new Error("Unable to generate interview questions with Google AI. Please verify connection.");
  },

  async evaluateResponse(
    questionText: string,
    userResponse: string,
    apiKey?: string
  ): Promise<EvaluationResult> {
    const trimmed = userResponse.trim();

    if (!trimmed) {
      return {
        score: 0,
        technicalScore: 0,
        communicationScore: 0,
        structureScore: 0,
        strengths: "None demonstrated.",
        weaknesses: "No response was provided for this question.",
        feedback: "You submitted an empty response. In an interview, always attempt an answer even if partial.",
        modelAnswer: "A high-performing candidate directly answers the question with relevant principles, real-world examples, and trade-offs."
      };
    }

    const attempts = getGeminiAttempts(apiKey);

    const prompt = `
      You are a strict, authentic Senior Technical Hiring Manager evaluating a candidate's response to an interview question.
      
      Question: "${questionText}"
      Candidate's Response: "${userResponse}"

      Analyze the response with high human-level realism. Return a JSON object with this exact structure:
      {
        "score": number, // Whole percentage rating from 0 to 100
        "technicalScore": number, // Accuracy and technical depth from 0 to 100
        "communicationScore": number, // Clarity, confidence, and articulation from 0 to 100
        "structureScore": number, // Logical flow and structure from 0 to 100
        "strengths": string, // Direct summary of genuine strengths (or "None demonstrated" if answer is off-topic)
        "weaknesses": string, // Direct summary of gaps, misconceptions, or missing depth
        "feedback": string, // Honest, constructive hiring-manager feedback (2-3 sentences)
        "modelAnswer": string // Clear, concise model answer demonstrating how a top 5% candidate would answer
      }

      CRITICAL REALISTIC SCORING RULES:
      - If the candidate's response contains profanity, vulgarity, insults, abusive language, non-answers, or jokes: award score: 0, technicalScore: 0, communicationScore: 0, and structureScore: 0. Explicitly call out the inappropriate and unprofessional conduct in weaknesses and feedback.
      - If the candidate does not answer the question, gives off-topic chatter, trivial small-talk, or asks the interviewer questions: award score: 0, technicalScore: 0, communicationScore: 0, structureScore: 0. Never award pity marks (like 5% or 10%) for non-answers or insults.
      - 0%: Inappropriate or profane remarks, off-topic chatter, non-answers, or completely wrong.
      - 1–15%: Very weak, extremely superficial, significant misconceptions.
      - 16–39%: Weak, barely touches basics, lacks depth and practical examples.
      - 40–59%: Beginner / partial answer, grasps basics but lacks depth and practical examples.
      - 60–75%: Competent, covers the core points well with reasonable clarity.
      - 76–89%: Strong senior candidate, accurate depth, trade-offs, and practical insights.
      - 90–100%: Exceptional, master-level depth, clear metrics, and architectural leadership.
      Output valid JSON only.
    `;

    for (const { activeKey, modelName } of attempts) {
      try {
        const model = getGenAIModel(activeKey, modelName, true);
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsed = parseJson(responseText) as Record<string, unknown>;

        const overall = parseScore(parsed, ['score', 'overallScore', 'overall_score'], 50);
        return {
          score: overall,
          technicalScore: parseScore(parsed, ['technicalScore', 'technical_score', 'technical'], overall),
          communicationScore: parseScore(parsed, ['communicationScore', 'communication_score', 'communication'], overall),
          structureScore: parseScore(parsed, ['structureScore', 'structure_score', 'structure'], overall),
          strengths: parseText(parsed, ['strengths', 'strength'], 'Addressed aspects of the question.'),
          weaknesses: parseText(parsed, ['weaknesses', 'weakness'], 'Could elaborate with deeper technical depth and specific examples.'),
          feedback: parseText(parsed, ['feedback', 'coaching'], 'Good effort. Focus on providing structured examples and technical precision.'),
          modelAnswer: parseText(parsed, ['modelAnswer', 'model_answer'], 'A top candidate explains foundational principles followed by real-world trade-offs.')
        };
      } catch (err) {
        console.warn(`Gemini (${modelName}) evaluation error:`, err);
      }
    }

    // Fallback to Groq if needed
    try {
      for (const groqKey of getGroqApiKeys()) {
        try {
          return await groqService.evaluateResponse(questionText, userResponse, groqKey);
        } catch (error) {
          console.warn('Groq key failed for evaluation, rotating:', error);
        }
      }
    } catch (groqErr) {
      console.error("Groq fallback also failed for evaluation:", groqErr);
    }

    throw new Error("Unable to evaluate response with Google AI. Please try again.");
  },

  async generateNextAdaptiveQuestion(
    roleTitle: string,
    difficulty: string,
    type: string,
    jobDescription: string,
    history: { questionText: string; userResponse: string; score: number }[],
    apiKey?: string
  ): Promise<AdaptiveQuestionResult> {
    const attempts = getGeminiAttempts(apiKey);

    const prompt = `
      You are an expert technical interviewer conducting an adaptive interview for a candidate.
      - Role: ${roleTitle}
      - Seniority/Difficulty: ${difficulty}
      - Focus Type: ${type}
      ${jobDescription ? `- Job Description: ${jobDescription}` : ''}

      Interview history so far:
      ${JSON.stringify(history, null, 2)}

      Decide whether to continue the interview with another question, or conclude:
      - If score >= 70, continue to probe deeper depth with a more advanced question.
      - If score < 70, continue with an easier question to gauge baseline knowledge.
      - Conclude (shouldContinue: false) if candidate completed 4-6 questions or consistently struggled.
      - Max questions: 6. Min questions: 2.

      Return JSON:
      {
        "shouldContinue": boolean,
        "nextQuestion": {
          "id": string,
          "text": string,
          "type": "technical" | "behavioral" | "system_design" | "general",
          "difficulty": "junior" | "mid" | "senior" | "lead",
          "modelAnswer": string,
          "keywords": string[]
        }
      }
    `;

    for (const { activeKey, modelName } of attempts) {
      try {
        const model = getGenAIModel(activeKey, modelName, true);
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsed = parseJson(responseText) as { shouldContinue: boolean; nextQuestion?: Partial<Question> };
        if (typeof parsed?.shouldContinue === 'boolean') {
          return parsed;
        }
      } catch (err) {
        console.warn(`Gemini (${modelName}) adaptive question error:`, err);
      }
    }

    return { shouldContinue: false };
  },

  async generateChatResponse(
    roleTitle: string,
    difficulty: string,
    type: string,
    jobDescription: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    apiKey?: string
  ): Promise<string> {
    const attempts = getGeminiAttempts(apiKey);

    const systemInstruction = `
You are Sophia, an expert, professional, and friendly technical interviewer.
You are conducting a live conversational mock interview for:
- Role: ${roleTitle}
- Seniority/Difficulty: ${difficulty}
- Focus Type: ${type}
${jobDescription ? `- Job Description context: ${jobDescription}` : ''}

CRITICAL RULES:
1. Act like a real human interviewer. Ask only ONE question at a time.
2. If this is the start of the interview (history is empty), warmly welcome the candidate, mention the role, and ask them to introduce themselves and their core experience.
3. Pay close attention to the candidate's latest answer. Probe deeper into their specific decisions, challenges, and technical stack.
4. Keep your responses concise, conversational, and encouraging before asking your question.
5. DO NOT provide grades, scores, or evaluations during the chat. Save that for the end feedback report.
    `.trim();

    let fullPrompt = `${systemInstruction}\n\nCONVERSATION TRANSCRIPT:\n`;
    if (history.length === 0) {
      fullPrompt += `[Starting the interview now. Greet the candidate warmly and ask your opening question.]`;
    } else {
      for (const msg of history) {
        fullPrompt += `${msg.role === 'assistant' ? 'Sophia (Interviewer)' : 'Candidate'}: ${msg.content}\n\n`;
      }
      fullPrompt += `Sophia (Interviewer):`;
    }

    for (const { activeKey, modelName } of attempts) {
      try {
        const model = getGenAIModel(activeKey, modelName, false);
        const result = await model.generateContent(fullPrompt);
        const responseText = result.response.text().trim();
        if (responseText) {
          return responseText;
        }
      } catch (err) {
        console.warn(`Gemini (${modelName}) chat response error:`, err);
      }
    }

    // Fallback to Groq if needed
    try {
      for (const groqKey of getGroqApiKeys()) {
        try {
          return await groqService.generateChatResponse(roleTitle, difficulty, type, jobDescription, history, groqKey);
        } catch (error) {
          console.warn('Groq key failed for chat response, rotating:', error);
        }
      }
    } catch (groqErr) {
      console.error("Groq fallback also failed for chat response:", groqErr);
    }

    return "Thank you for sharing. Could you elaborate on a key technical challenge you encountered in that project and how you solved it?";
  },

  async evaluateChatSession(
    roleTitle: string,
    difficulty: string,
    type: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    apiKey?: string
  ): Promise<EvaluationResult> {
    const userMessages = history.filter(m => m.role === 'user').map(m => m.content.trim());
    const combinedUserText = userMessages.join(' ').trim();

    if (!userMessages.length || !combinedUserText) {
      return {
        score: 0,
        technicalScore: 0,
        communicationScore: 0,
        structureScore: 0,
        strengths: "None demonstrated.",
        weaknesses: "No candidate answers were found in this conversation.",
        feedback: "You did not provide responses during this practice conversation. Practice giving direct answers to the interviewer.",
        modelAnswer: "When the interviewer opens the session, a strong candidate introduces themselves, summarizes their core tech stack, and highlights 1-2 major technical achievements."
      };
    }

    const attempts = getGeminiAttempts(apiKey);

    const prompt = `
      You are an authentic, strict Senior Technical Hiring Manager evaluating a candidate's performance in a conversational mock interview.
      Here is the interview transcript:
      ${JSON.stringify(history, null, 2)}

      Analyze the candidate's answers throughout the conversation for:
      - Role: ${roleTitle}
      - Difficulty: ${difficulty}
      - Interview Type: ${type}

      Provide an honest, realistic human-level evaluation. Return a JSON object with this exact structure:
      {
        "score": number, // Whole-number percentage from 0 to 100
        "technicalScore": number, // Whole-number percentage from 0 to 100
        "communicationScore": number, // Whole-number percentage from 0 to 100
        "structureScore": number, // Whole-number percentage from 0 to 100
        "strengths": string, // Direct summary of genuine strengths (or "None demonstrated" if non-answers)
        "weaknesses": string, // Direct summary of weaknesses, gaps, or missed concepts
        "feedback": string, // Constructive, realistic hiring-manager coaching paragraph (2-3 sentences)
        "modelAnswer": string // Clear summary of what an elite candidate would discuss for the topics covered
      }

      CRITICAL REALISTIC HUMAN-LEVEL SCORING RULES:
      - If the candidate provided no substantive technical answers (e.g. only asked the interviewer questions, said small talk, or gave 1-2 word replies), score and technicalScore MUST be 0% to 5%. Never give 20% or 30% for non-answers.
      - 0–10%: Non-answers, trivial small-talk, asking the interviewer questions, or completely off-topic.
      - 15–35%: Very weak, extremely superficial, almost no domain substance.
      - 40–59%: Beginner / partial, grasps some basics but lacks depth and practical examples.
      - 60–75%: Competent, answers the core questions with good understanding.
      - 76–89%: Strong senior candidate, accurate depth, architectural trade-offs, and practical insights.
      - 90–100%: Exceptional, master-level depth, clear metrics, and architectural leadership.
      Output valid JSON only.
    `;

    for (const { activeKey, modelName } of attempts) {
      try {
        const model = getGenAIModel(activeKey, modelName, true);
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsed = parseJson(responseText) as Record<string, unknown>;

        const overall = parseScore(parsed, ['score', 'overallScore', 'overall_score'], 55);
        return {
          score: overall,
          technicalScore: parseScore(parsed, ['technicalScore', 'technical_score', 'technical'], overall),
          communicationScore: parseScore(parsed, ['communicationScore', 'communication_score', 'communication'], overall),
          structureScore: parseScore(parsed, ['structureScore', 'structure_score', 'structure'], overall),
          strengths: parseText(parsed, ['strengths', 'strength'], 'Showed good engagement in the discussion.'),
          weaknesses: parseText(parsed, ['weaknesses', 'weakness'], 'Could dive deeper into specific implementation details and design trade-offs.'),
          feedback: parseText(parsed, ['feedback', 'coaching'], 'Good conversational flow. Focus on articulating technical choices with more precision.'),
          modelAnswer: parseText(parsed, ['modelAnswer', 'model_answer'], 'A top candidate combines clear high-level architectural thinking with concrete implementation examples.')
        };
      } catch (err) {
        console.warn(`Gemini (${modelName}) chat evaluation error:`, err);
      }
    }

    // Fallback to Groq if needed
    try {
      for (const groqKey of getGroqApiKeys()) {
        try {
          return await groqService.evaluateChatSession(roleTitle, difficulty, type, history, groqKey);
        } catch (error) {
          console.warn('Groq key failed for chat evaluation, rotating:', error);
        }
      }
    } catch (groqErr) {
      console.error("Groq fallback also failed for chat evaluation:", groqErr);
    }

    throw new Error("Unable to generate evaluation with Google AI. Please try again.");
  },

  async analyzeResume(
    resumeText: string,
    targetRole?: string,
    apiKey?: string
  ): Promise<ResumeRatingResult> {
    const attempts = getGeminiAttempts(apiKey);

    const prompt = `
      You are an expert career coach and resume reviewer.
      Analyze the following resume${targetRole ? ` for the target role: "${targetRole}"` : ''}.

      RESUME:
      """
      ${resumeText.slice(0, 12000)}
      """

      Return a JSON object with EXACTLY this structure:
      {
        "overallScore": number,
        "atsScore": number,
        "contentScore": number,
        "formattingScore": number,
        "impactScore": number,
        "strengths": string[],
        "improvements": string[],
        "missingKeywords": string[],
        "summary": string
      }

      CRITICAL RULES:
      - Every score must be an integer percentage from 0 to 100 (e.g. 75, 82, 65). NEVER use 0-10 ratings.
      - strengths: 3-5 items.
      - improvements: 4-6 items.
      - missingKeywords: 6-10 items.
      - summary: 2-3 sentences.
      Output valid JSON only.
    `;

    for (const { activeKey, modelName } of attempts) {
      try {
        const model = getGenAIModel(activeKey, modelName, true);
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsed = parseJson(responseText) as Record<string, unknown>;

        const normalize = (val: unknown, fallback = 70): number => {
          let num = typeof val === 'number' ? val : parseFloat(String(val || ''));
          if (isNaN(num)) return fallback;
          if (num <= 10 && num > 0) num = num * 10;
          return Math.min(100, Math.max(0, Math.round(num)));
        };

        const toStringArray = (arr: unknown): string[] => {
          if (Array.isArray(arr)) {
            return arr.map(x => String(x).trim()).filter(Boolean);
          }
          return [];
        };

        return {
          overallScore: normalize(parsed.overallScore, 70),
          atsScore: normalize(parsed.atsScore, 68),
          contentScore: normalize(parsed.contentScore, 72),
          formattingScore: normalize(parsed.formattingScore, 75),
          impactScore: normalize(parsed.impactScore, 65),
          strengths: toStringArray(parsed.strengths),
          improvements: toStringArray(parsed.improvements),
          missingKeywords: toStringArray(parsed.missingKeywords),
          summary: typeof parsed.summary === 'string' ? parsed.summary : 'Resume successfully reviewed with constructive recommendations.'
        };
      } catch (err) {
        console.warn(`Gemini (${modelName}) resume analysis error:`, err);
      }
    }

    throw new Error("Google AI resume analysis failed. Falling back to alternative model.");
  }
};

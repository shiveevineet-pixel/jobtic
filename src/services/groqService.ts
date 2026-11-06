import { Question } from './mockDatabase';

// GPT-OSS supports strict JSON Schema output, which makes score ranges reliable.
// A Groq project can still opt into another supported model through VITE_GROQ_MODEL.
const GROQ_MODEL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_MODEL) || 'openai/gpt-oss-20b';
import { aiProxy } from './aiProxy';
const REQUEST_TIMEOUT_MS = 30_000;

const EVALUATION_SCHEMA = {
  name: 'interview_evaluation',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['score', 'technicalScore', 'communicationScore', 'structureScore', 'strengths', 'weaknesses', 'feedback', 'modelAnswer'],
    properties: {
      score: { type: 'integer', minimum: 0, maximum: 100 },
      technicalScore: { type: 'integer', minimum: 0, maximum: 100 },
      communicationScore: { type: 'integer', minimum: 0, maximum: 100 },
      structureScore: { type: 'integer', minimum: 0, maximum: 100 },
      strengths: { type: 'string' },
      weaknesses: { type: 'string' },
      feedback: { type: 'string' },
      modelAnswer: { type: 'string' }
    }
  }
} as const;

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type Evaluation = {
  score: number;
  technicalScore: number;
  communicationScore: number;
  structureScore: number;
  strengths: string;
  weaknesses: string;
  feedback: string;
  modelAnswer: string;
};

const FALLBACK_MODEL = 'openai/gpt-oss-120b';

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

const getContent = (data: unknown): string => {
  const content = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Groq returned an empty response.');
  }
  return content;
};

const parseJson = (content: string): unknown => {
  try {
    return JSON.parse(cleanJson(content));
  } catch {
    throw new Error('Groq returned invalid JSON.');
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

const parseEvaluation = (content: string): Evaluation => {
  const parsed = parseJson(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Groq returned an invalid evaluation structure.');
  }
  const value = parsed as Record<string, unknown>;

  const overall = parseScore(value, ['score', 'overallScore', 'overall_score'], 60);
  const technical = parseScore(value, ['technicalScore', 'technical_score', 'technical'], overall);
  const communication = parseScore(value, ['communicationScore', 'communication_score', 'communication'], overall);
  const structure = parseScore(value, ['structureScore', 'structure_score', 'structure'], overall);

  const strengths = parseText(value, ['strengths', 'strength', 'positives'], 'Demonstrated relevant knowledge in the response.');
  const weaknesses = parseText(value, ['weaknesses', 'weakness', 'improvements', 'areas_to_improve'], 'Could provide more specific examples and technical depth.');
  const feedback = parseText(value, ['feedback', 'coaching', 'summary'], 'Solid effort. Continue practicing structured problem-solving.');
  const modelAnswer = parseText(value, ['modelAnswer', 'model_answer', 'suggested_answer', 'ideal_answer'], 'A strong response outlines context, actions taken, and measurable results clearly.');

  return {
    score: overall,
    technicalScore: technical,
    communicationScore: communication,
    structureScore: structure,
    strengths,
    weaknesses,
    feedback,
    modelAnswer
  };
};

const executeSingleCompletion = async (
  apiKey: string,
  modelName: string,
  messages: ChatMessage[],
  options: { temperature: number; json?: boolean; evaluation?: boolean }
): Promise<string> => {
  void apiKey;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const isGptOss = modelName.startsWith('openai/gpt-oss-');
    const bodyPayload: Record<string, unknown> = {
      model: modelName,
      messages,
      temperature: options.temperature,
    };

    if (isGptOss) {
      bodyPayload.reasoning_effort = 'medium';
      if (options.evaluation) {
        bodyPayload.response_format = { type: 'json_schema', json_schema: EVALUATION_SCHEMA };
      } else if (options.json) {
        bodyPayload.response_format = { type: 'json_object' };
      }
    } else {
      if (options.evaluation || options.json) {
        bodyPayload.response_format = { type: 'json_object' };
      }
    }

    const response = await aiProxy('groq', modelName, bodyPayload, controller.signal);
    if (!response.ok) {
      const details = (await response.text()).slice(0, 500);
      throw new Error(`Groq API error ${response.status}${details ? `: ${details}` : ''}`);
    }
    return getContent(await response.json());
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Groq request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const requestCompletion = async (
  apiKey: string,
  messages: ChatMessage[],
  options: { temperature: number; json?: boolean; evaluation?: boolean }
): Promise<string> => {
  try {
    return await executeSingleCompletion(apiKey, GROQ_MODEL, messages, options);
  } catch (primaryErr) {
    if (GROQ_MODEL !== FALLBACK_MODEL) {
      console.warn(`Primary Groq model (${GROQ_MODEL}) failed, trying fallback (${FALLBACK_MODEL}):`, primaryErr);
      try {
        return await executeSingleCompletion(apiKey, FALLBACK_MODEL, messages, options);
      } catch (fallbackErr) {
        console.error(`Fallback Groq model (${FALLBACK_MODEL}) also failed:`, fallbackErr);
        throw primaryErr;
      }
    }
    throw primaryErr;
  }
};

export const groqService = {
  async generateQuestions(
    roleTitle: string,
    difficulty: string,
    type: string,
    jobDescription: string,
    count: number,
    apiKey: string
  ): Promise<Partial<Question>[]> {
    if (!apiKey) {
      throw new Error("Groq API Key is required.");
    }

    const prompt = `
      You are an expert recruiter and technical interviewer.
      Generate a list of exactly ${count} interview questions for a candidate preparing for the following position:
      - Role: ${roleTitle}
      - Seniority/Difficulty: ${difficulty}
      - Interview Type: ${type}
      ${jobDescription ? `- Additional Context (Job Description): ${jobDescription}` : ""}

      Return a JSON array of objects. Each object must exactly match this TypeScript interface:
      interface Question {
        id: string; // unique short string like "q_1", "q_2", etc.
        text: string; // the actual question asked by the interviewer
        type: 'technical' | 'behavioral' | 'system_design' | 'general';
        difficulty: 'junior' | 'mid' | 'senior' | 'lead';
        modelAnswer: string; // a concise, high-quality model answer to guide the candidate
        keywords: string[]; // 5-8 key technical terms or concepts that should appear in a good response
      }

      Ensure questions are realistic, challenging, and tailored precisely to the seniority and job description if provided.
      You must respond with valid JSON containing the array of questions.
    `;

    try {
      const content = await requestCompletion(apiKey, [
        { role: 'system', content: 'You are an interviewer who generates structured questions in JSON format.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.7, json: true });
      const parsed = parseJson(content);

      // Groq response format helper: handle if it returns { "questions": [...] } or raw array
      let questions = parsed;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const responseObject = parsed as Record<string, unknown>;
        const keys = Object.keys(responseObject);
        if (keys.length === 1 && Array.isArray(responseObject[keys[0]])) {
          questions = responseObject[keys[0]];
        } else if (Array.isArray(responseObject.questions)) {
          questions = responseObject.questions;
        }
      }

      if (Array.isArray(questions)) {
        return questions;
      }
      throw new Error("Invalid format returned by Groq. Expected a JSON array of questions.");
    } catch (error) {
      console.error("Groq Question Generation Error:", error);
      throw error;
    }
  },

  async evaluateResponse(
    questionText: string,
    userResponse: string,
    apiKey: string
  ): Promise<{
    score: number;
    technicalScore: number;
    communicationScore: number;
    structureScore: number;
    strengths: string;
    weaknesses: string;
    feedback: string;
    modelAnswer: string;
  }> {
    if (!apiKey) {
      throw new Error("Groq API Key is required.");
    }

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

    const prompt = `
      You are an authentic, strict Senior Technical Hiring Manager evaluating a candidate's response to an interview question:
      
      Question: "${questionText}"
      Candidate's Response: "${userResponse}"

      Analyze the response and return a JSON object with this exact structure:
      {
        "score": integer, // Whole-number percentage from 0 to 100
        "technicalScore": integer, // Whole-number percentage from 0 to 100
        "communicationScore": integer, // Whole-number percentage from 0 to 100
        "structureScore": integer, // Whole-number percentage from 0 to 100
        "strengths": string, // Direct summary of what the candidate did well (or "None demonstrated" if inappropriate/off-topic)
        "weaknesses": string, // Direct summary of gaps, misconceptions, or inappropriate remarks
        "feedback": string, // Honest, constructive feedback (2-3 sentences) explaining the rating
        "modelAnswer": string // A clear, concise model answer explaining how a top candidate would answer this question
      }

      CRITICAL SCORING RULES:
      1. Every score is a WHOLE PERCENTAGE from 0 to 100.
      2. If the response contains profanity, vulgarity, insults, abusive language, non-answers, or jokes: award score: 0, technicalScore: 0, communicationScore: 0, and structureScore: 0. Explicitly call out the inappropriate and unprofessional conduct in weaknesses and feedback.
      3. If the candidate does not answer the question or provides irrelevant chatter, award score: 0, technicalScore: 0, communicationScore: 0, structureScore: 0. Never give pity marks (like 5% or 10%) for non-answers or insults.
      4. Only award 70%+ scores if the candidate demonstrates accurate technical depth, relevant terminology, and clear reasoning.
    `;

    try {
      const content = await requestCompletion(apiKey, [
        { role: 'system', content: 'You are an interviewer who evaluates candidate responses and outputs scores in JSON format.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.2, evaluation: true });
      return parseEvaluation(content);
    } catch (error) {
      console.error("Groq Evaluation Error:", error);
      throw error;
    }
  },

  async generateNextAdaptiveQuestion(
    roleTitle: string,
    difficulty: string,
    type: string,
    jobDescription: string,
    history: { questionText: string; userResponse: string; score: number }[],
    apiKey: string
  ): Promise<{
    shouldContinue: boolean;
    nextQuestion?: Partial<Question>;
  }> {
    if (!apiKey) {
      throw new Error("Groq API Key is required.");
    }

    const prompt = `
      You are an expert technical interviewer conducting an adaptive/dynamic interview for a candidate.
      - Role: ${roleTitle}
      - Seniority/Difficulty: ${difficulty}
      - Focus Type: ${type}
      ${jobDescription ? `- Additional Context (Job Description): ${jobDescription}` : ""}

      Here is the history of the interview so far containing the questions asked, the candidate's answers, and their evaluation score (out of 100):
      ${JSON.stringify(history, null, 2)}

      Your task is to decide whether to continue the interview with another question, or to conclude the interview, based on their performance:
      
      CRITERIA FOR CONTINUING:
      1. If the candidate scored well (score >= 70) on the latest question, you should continue the interview (shouldContinue: true) to probe their depth of knowledge further, perhaps asking a slightly more advanced or follow-up question.
      2. If they performed poorly (score < 70) on the latest question, but you want to give them another chance or ask an easier question to find their level, you can also continue.
      3. Conclude the interview (shouldContinue: false) if they have consistently scored poorly (e.g. multiple low scores), OR if they have consistently scored very high and you have clearly verified their senior competency (typically after 3-5 questions).
      4. Absolute maximum total questions: 6. If the history contains 6 questions, you MUST conclude (shouldContinue: false).
      5. Minimum questions: 2. If history length is 1, you should generally continue (shouldContinue: true).

      If continuing (shouldContinue: true), generate the next question. The question should dynamically react to their previous answers (e.g. if they struggled with a concept, ask a simpler one; if they excelled, push them further).

      Return a JSON object matching this exact structure:
      {
        "shouldContinue": boolean,
        "nextQuestion": { // Only required if shouldContinue is true, otherwise omit or set to null
          "id": string, // unique short string like "q_adapt_x"
          "text": string, // the actual question asked by the interviewer
          "type": "technical" | "behavioral" | "system_design" | "general",
          "difficulty": "junior" | "mid" | "senior" | "lead",
          "modelAnswer": string, // a concise, high-quality model answer to guide the candidate
          "keywords": string[] // 5-8 key technical terms or concepts that should appear in a good response
        }
      }
    `;

    try {
      const content = await requestCompletion(apiKey, [
        { role: 'system', content: 'You are an interviewer conducting an adaptive interview and outputting decisions in JSON format.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.5, json: true });
      const parsed = parseJson(content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Groq returned an invalid adaptive-interview decision.');
      }
      return parsed as { shouldContinue: boolean; nextQuestion?: Partial<Question> };
    } catch (error) {
      console.error("Groq Adaptive Question Error:", error);
      throw error;
    }
  },

  async generateChatResponse(
    roleTitle: string,
    difficulty: string,
    type: string,
    jobDescription: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    apiKey: string
  ): Promise<string> {
    if (!apiKey) {
      throw new Error("Groq API Key is required.");
    }

    const systemPrompt = `
      You are an expert, professional, and friendly recruiter/interviewer named Sophia.
      You are conducting a live, conversational mock interview for the following position:
      - Role: ${roleTitle}
      - Seniority/Difficulty: ${difficulty}
      - Interview Focus: ${type}
      ${jobDescription ? `- Additional Context (Job Description): ${jobDescription}` : ""}

      RULES:
      1. Act like a real human interviewer. Ask only ONE question at a time.
      2. Pay close attention to the candidate's latest response. If they mention projects, technologies, methodologies, or challenges, probe deeper with relevant follow-up questions to understand their specific contributions, decisions, and outcomes.
      3. Keep your replies brief, natural, and encouraging before asking the next question.
      4. DO NOT provide grading, feedback, or markdown summaries during the conversation. Save that for the end.
      5. The conversation should last around 4-6 turns. If the interview feels complete, politely thank the candidate and state that they can finish and get their feedback report.
    `;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history
    ];

    try {
      return await requestCompletion(apiKey, messages, { temperature: 0.7 });
    } catch (error) {
      console.error("Groq Chat Response Error:", error);
      throw error;
    }
  },

  async evaluateChatSession(
    roleTitle: string,
    difficulty: string,
    type: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    apiKey: string
  ): Promise<{
    score: number;
    technicalScore: number;
    communicationScore: number;
    structureScore: number;
    strengths: string;
    weaknesses: string;
    feedback: string;
    modelAnswer: string;
  }> {
    if (!apiKey) {
      throw new Error("Groq API Key is required.");
    }

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

    const prompt = `
      You are an authentic, strict Senior Technical Hiring Manager evaluating a candidate's performance in a conversational mock interview.
      Here is the interview transcript:
      ${JSON.stringify(history, null, 2)}

      Analyze the candidate's answers throughout the conversation for the following position:
      - Role: ${roleTitle}
      - Difficulty: ${difficulty}
      - Interview Type: ${type}

      Provide a comprehensive evaluation and return a JSON object with this exact structure:
      {
        "score": integer, // Whole-number percentage from 0 to 100
        "technicalScore": integer, // Whole-number percentage from 0 to 100
        "communicationScore": integer, // Whole-number percentage from 0 to 100
        "structureScore": integer, // Whole-number percentage from 0 to 100
        "strengths": string, // Direct summary of genuine strengths (or "None demonstrated" if non-answers)
        "weaknesses": string, // Direct summary of weaknesses or missed concepts
        "feedback": string, // Constructive, realistic hiring-manager coaching paragraph (2-3 sentences)
        "modelAnswer": string // Clear summary of what an elite candidate would discuss
      }

      CRITICAL REALISTIC HUMAN-LEVEL SCORING RULES:
      - If the candidate provided no substantive technical answers (e.g. only asked the interviewer questions, said small talk, or gave 1-2 word replies), score and technicalScore MUST be 0% to 5%. Never give 20% or 30% for non-answers.
      - 0–10%: Non-answers, trivial small-talk, asking the interviewer questions, or completely off-topic.
      - 15–35%: Very weak, extremely superficial, almost no domain substance.
      - 40–59%: Beginner / partial, grasps some basics but lacks depth and practical examples.
      - 60–75%: Competent, answers the core questions with good understanding.
      - 76–89%: Strong senior candidate, accurate depth, architectural trade-offs, and practical insights.
      - 90–100%: Exceptional, master-level depth, clear metrics, and architectural leadership.
    `;

    try {
      const content = await requestCompletion(apiKey, [
        { role: 'system', content: 'You are an interviewer who evaluates candidate responses and outputs scores in JSON format.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.2, evaluation: true });
      return parseEvaluation(content);
    } catch (error) {
      console.error("Groq Chat Evaluation Error:", error);
      throw error;
    }
  }
};

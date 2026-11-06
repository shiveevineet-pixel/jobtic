// Routing markers only, NOT credentials. Provider key rotation happens in the server.
export const BUILT_IN_GEMINI_KEYS = ['server'];
export const BUILT_IN_GROQ_KEYS = ['server'];
export const getGeminiApiKeys = (_preferred?: string): string[] => { void _preferred; return ['server']; };
export const getGroqApiKeys = (_preferred?: string): string[] => { void _preferred; return ['server']; };

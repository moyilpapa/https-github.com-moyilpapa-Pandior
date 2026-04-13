import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function parseNaturalLanguageInput(input: string, currentDate: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Current Date: ${currentDate}\nUser Input: "${input}"\nParse this input into an event or task. If it's an event, extract title, start time, end time, and description. If it's a task, extract title and due date. 

IMPORTANT: If the user tries to schedule something in the past (before ${currentDate}), do not create an event or task. Instead, return a message explaining that you cannot schedule things in the past and set the type to 'query'.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["event", "task", "query"] },
          event: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              start: { type: Type.STRING, description: "ISO 8601 format" },
              end: { type: Type.STRING, description: "ISO 8601 format" },
              description: { type: Type.STRING },
              category: { type: Type.STRING, enum: ["work", "personal", "meeting", "other"] },
              priority: { type: Type.STRING, enum: ["low", "medium", "high"] }
            }
          },
          task: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              dueDate: { type: Type.STRING, description: "ISO 8601 format" }
            }
          },
          message: { type: Type.STRING, description: "A friendly confirmation message" }
        },
        required: ["type", "message"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function getSchedulingSuggestions(events: any[], query: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Events: ${JSON.stringify(events)}\nQuery: ${query}\nSuggest optimal scheduling or resolve conflicts.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                reason: { type: Type.STRING },
                suggestedTime: { type: Type.STRING }
              }
            }
          },
          message: { type: Type.STRING }
        }
      }
    }
  });

  return JSON.parse(response.text);
}

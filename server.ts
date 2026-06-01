import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini SDK with User-Agent telemetry headers for AI Studio
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent database file mapping user schedules
const DB_FILE = path.join(process.cwd(), "db.json");

interface DbSchema {
  events: any[];
  tasks: any[];
  user: {
    name: string;
    streak: number;
    xp: number;
    level: number;
  };
}

const defaultDb: DbSchema = {
  events: [],
  tasks: [],
  user: {
    name: "",
    streak: 5,
    xp: 0,
    level: 1,
  },
};

function readDb(): DbSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2));
      return defaultDb;
    }
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading db.json, returning defaults", err);
    return defaultDb;
  }
}

function writeDb(data: DbSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing db.json", err);
  }
}

// REST endpoints for calendar events, tasks, and gamification level syncing
app.get("/api/db", (req, res) => {
  res.json(readDb());
});

app.post("/api/db", (req, res) => {
  const db = readDb();
  const { events, tasks, user } = req.body;
  if (events !== undefined) db.events = events;
  if (tasks !== undefined) db.tasks = tasks;
  if (user !== undefined) db.user = { ...db.user, ...user };
  writeDb(db);
  res.json({ success: true, db });
});

app.post("/api/gemini/parse", async (req, res) => {
  try {
    const { input, currentDate } = req.body;
    if (!input) {
      return res.status(400).json({ error: "Input is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        type: "query",
        message: "Gemini API key is not configured in Settings > Secrets. Let me guide you to customize this!"
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
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

    const result = JSON.parse(response.text || "{}");
    res.json(result);
  } catch (error: any) {
    console.error("Gemini Parsing error:", error);
    res.status(500).json({
      type: "query",
      message: `Could not parse input. Gemini error: ${error.message || error}`
    });
  }
});

// Configure Vite integration for dev server or serve build folders in prod
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Pandior Backend] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

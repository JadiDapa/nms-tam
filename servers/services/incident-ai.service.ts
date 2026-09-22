import { z } from "zod";
import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { engine } from "../engine/engine-client";
import { call, stripEngineName } from "../engine/engine-call";
import { AuditService } from "./audit.service";
import { IncidentService } from "./incident.service";

// What Gemini must hand back. The same shape is sent as the response schema and checked again here,
// so a model that drifts from it is an error instead of a half-empty sheet.
const analysisSchema = z.object({
  summary: z.string(),
  reason: z.string(),
  confidence: z.object({ score: z.number().min(0).max(100), rationale: z.string() }),
  evidence: z.array(z.object({ signal: z.string(), observation: z.string() })),
  impact: z.object({ level: z.enum(["none", "low", "medium", "high", "critical"]), description: z.string() }),
  actions: z.array(z.object({ step: z.string(), priority: z.enum(["now", "soon", "later"]) })),
});

export type IncidentAnalysis = z.infer<typeof analysisSchema>;

// A stored analysis as the sheet shows it.
export type SavedAnalysis = { analysis: IncidentAnalysis; model: string; analyzedAt: string; incidentStatus: string };

const toSaved = (row: { result: unknown; model: string; createdAt: Date; incidentStatus: string }): SavedAnalysis | null => {
  // an answer stored under an older shape is treated as missing, so the sheet offers to analyze again
  const parsed = analysisSchema.safeParse(row.result);
  return parsed.success ? { analysis: parsed.data, model: row.model, analyzedAt: row.createdAt.toISOString(), incidentStatus: row.incidentStatus } : null;
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING", description: "One or two sentences on what is happening, for a network operator." },
    reason: { type: "STRING", description: "The most likely cause, and why it is the most likely one." },
    confidence: {
      type: "OBJECT",
      properties: {
        score: { type: "INTEGER", description: "0 to 100: how sure the analysis is, given how much data there is." },
        rationale: { type: "STRING", description: "Why the score is what it is (what data is missing or conclusive)." },
      },
      required: ["score", "rationale"],
      propertyOrdering: ["score", "rationale"],
    },
    evidence: {
      type: "ARRAY",
      description: "Facts taken from the incident data that support the reason. Never invent data that is not given.",
      items: {
        type: "OBJECT",
        properties: {
          signal: { type: "STRING", description: "The data point, e.g. 'CPU usage' or 'Recent history'." },
          observation: { type: "STRING", description: "What it shows, with the actual numbers." },
        },
        required: ["signal", "observation"],
        propertyOrdering: ["signal", "observation"],
      },
    },
    impact: {
      type: "OBJECT",
      properties: {
        level: { type: "STRING", enum: ["none", "low", "medium", "high", "critical"] },
        description: { type: "STRING", description: "What users or services are likely affected." },
      },
      required: ["level", "description"],
      propertyOrdering: ["level", "description"],
    },
    actions: {
      type: "ARRAY",
      description: "Concrete next steps for the operator, most urgent first. Three to five.",
      items: {
        type: "OBJECT",
        properties: {
          step: { type: "STRING" },
          priority: { type: "STRING", enum: ["now", "soon", "later"] },
        },
        required: ["step", "priority"],
        propertyOrdering: ["step", "priority"],
      },
    },
  },
  required: ["summary", "reason", "confidence", "evidence", "impact", "actions"],
  propertyOrdering: ["summary", "reason", "confidence", "evidence", "impact", "actions"],
};

const INSTRUCTION = `You are a senior network operations engineer reviewing an alert from a network monitoring system (routers, switches, servers polled over ICMP and SNMP).
Analyse the incident data you are given and answer in the requested JSON structure.
Rules:
- Base every piece of evidence on the data given. If the data is thin, say so and lower the confidence score.
- Be specific: use the device name, metric, reading and threshold.
- Keep the summary short. Keep every action a single, practical instruction.
- Write in plain English.`;

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

async function askGemini(prompt: string, attempt = 1): Promise<IncidentAnalysis> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": config.geminiApiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
    }),
    signal: AbortSignal.timeout(45_000),
  }).catch((err) => {
    console.error("Gemini request failed", err);
    throw new AppError("The AI analyzer could not be reached. Try again in a moment.", 502);
  });

  const body = (await res.json().catch(() => ({}))) as GeminiResponse;
  // 503 means the model is overloaded for a moment: one more try usually gets through
  if (res.status === 503 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1500 * attempt));
    return askGemini(prompt, attempt + 1);
  }
  if (!res.ok) {
    console.error("Gemini error", res.status, body.error?.message);
    const busy = res.status === 429 || res.status === 503;
    throw new AppError(busy ? "The AI analyzer is busy right now. Try again in a minute." : "The AI analyzer returned an error.", 502);
  }
  if (body.promptFeedback?.blockReason) throw new AppError("The AI analyzer declined to analyze this incident.", 502);

  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    return analysisSchema.parse(JSON.parse(text));
  } catch (err) {
    console.error("Gemini answer did not match the schema", err, text);
    throw new AppError("The AI analyzer gave an answer that could not be read. Try again.", 502);
  }
}

export const IncidentAiService = {
  enabled: () => config.geminiApiKey !== "",

  // The analysis kept for this incident, or null if it was never analyzed. The caller has already checked ownership.
  async saved(orgId: number, incidentId: string) {
    const row = await prisma.incidentAnalysis.findFirst({ where: { orgId, incidentId } });
    return row ? toSaved(row) : null;
  },

  // Asks Gemini for a new analysis and keeps it, replacing the previous one.
  async analyze(actor: { id: number }, orgId: number, incidentId: string): Promise<SavedAnalysis> {
    if (!config.geminiApiKey) throw new AppError("The AI analyzer is not set up (GEMINI_API_KEY is empty).", 503);

    // IncidentService.get also checks the incident belongs to this client
    const { incident, deliverySummary, device } = await IncidentService.get(orgId, incidentId);
    const history = device.engineDeviceId
      ? (await call(orgId, () => engine.listIncidents({ deviceIds: [device.engineDeviceId!], limit: 15 }))).items.filter((i) => i.id !== incident.id)
      : [];

    const facts = {
      now: new Date().toISOString(),
      incident: {
        rule: incident.ruleName,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        metric: incident.metric,
        reading: incident.value,
        threshold: incident.threshold,
        error: incident.error,
        triggeredAt: incident.triggeredAt,
        lastSeenAt: incident.lastSeenAt,
        acknowledgedAt: incident.acknowledgedAt,
        resolvedAt: incident.resolvedAt,
        resolutionReason: incident.resolutionReason,
        onInterface: incident.interfaceId !== null,
      },
      device: { name: device.name, status: device.status },
      notifications: deliverySummary.map((d) => ({ channel: d.channelType, event: d.event, phase: d.phase, attempts: d.attempts, lastError: d.lastError })),
      // earlier incidents on the same device, newest first: shows whether this is new or keeps coming back
      recentIncidentsOnDevice: history.map((i) => ({
        rule: stripEngineName(orgId, i.ruleName),
        severity: i.severity,
        status: i.status,
        metric: i.metric,
        reading: i.value,
        threshold: i.threshold,
        error: i.error,
        triggeredAt: i.triggeredAt,
        resolvedAt: i.resolvedAt,
      })),
    };

    const analysis = await askGemini(`Incident data (JSON):\n${JSON.stringify(facts, null, 2)}`);
    const data = { orgId, model: config.geminiModel, result: analysis, incidentStatus: incident.status, createdById: actor.id, createdAt: new Date() };
    const row = await prisma.incidentAnalysis.upsert({ where: { incidentId: incident.id }, create: { incidentId: incident.id, ...data }, update: data });
    await AuditService.log({ actorId: actor.id, orgId, action: "incident.analyze", targetType: "Incident", targetId: incident.id });
    return toSaved(row)!;
  },
};

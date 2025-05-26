import OpenAI from "openai";
import { parseClaude } from "../lib/validator.js";
import { ensureLinks } from "../lib/link-check.js";
import {
  NEWSLETTERS_DAILY,
  INFLUENCERS_GARDENING /* … */
} from "../lib/resources.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // ===== build prompt =====
  const resourcesJSON = JSON.stringify({
    newsletters: NEWSLETTERS_DAILY.slice(0, 15),
    influencers: INFLUENCERS_GARDENING.slice(0, 15)
  });

  const messages = [
    {
      role: "system",
      content: `You are Recovery-Bot. Use the provided resources to craft 4 *creative*,
phase-appropriate activities for someone 15 days after ACL surgery (limited mobility).
Return ONLY strict JSON matching the schema: { "activities":[{id,category,emoji,title,description,references:[{name,url}]}] }`
    },
    { role: "user", content: resourcesJSON }
  ];

  const resp = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "o3",
    messages
  });

  let activities;
  try {
    activities = parseClaude(resp.choices[0].message.content);
  } catch (e) {
    console.error("Validator fail, falling back:", e);
    activities = fallbackActivities();   // use local helper
  }

  await Promise.all(activities.activities.map(ensureLinks));
  return res.status(200).json(activities);
}

/* ---------- fallback in case the model response is unusable ---------- */
export function fallbackActivities() {
  return {
    activities: [
      /* …the 4 creative ideas JSON you tested earlier … */
    ]
  };
}

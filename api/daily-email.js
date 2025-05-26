import { kv } from "@vercel/kv";
import sgMail from "@sendgrid/mail";
import OpenAI from "openai";
import dayjs from "dayjs";
import { parseClaude } from "../lib/validator.js";
import { ensureLinks } from "../lib/link-check.js";
import { fallbackActivities } from "./generate-activities.js";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const openai = new OpenAI();

export default async function handler(req, res) {
  // 1) figure out today / phase
  const today = dayjs().startOf("day");
  const sx = dayjs(process.env.SURGERY_DATE);
  const days = today.diff(sx, "day");

  const phase =
    days < 15 ? "very limited"
    : days < 46 ? "moderate"
    : "near normal";

  // 2) fetch avoidIds from rolling window
  const sent = (await kv.get("anne:sentIds")) ?? [];
  const avoidHint = sent.length ? `Avoid these IDs: ${sent.join(", ")}.` : "";

  // 3) call OpenAI
  const messages = [
    {
      role: "system",
      content: `You are Recovery-Bot. Generate *4 creative activities* only,
strict JSON as earlier.  Patient phase = ${phase}.  ${avoidHint}`
    }
  ];

  let activities;
  try {
    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "o3",
      messages,
      temperature: 1
    });
    activities = parseClaude(resp.choices[0].message.content).activities;
  } catch (e) {
    console.error(e);
    activities = fallbackActivities().activities;
  }

  // 4) link-check & store new IDs
  await Promise.all(activities.map(ensureLinks));
  await kv.set(
    "anne:sentIds",
    [...sent, ...activities.map((a) => a.id)].slice(-120)
  );

  // 5) build template data
  const dynamicTemplateData = { activities };

  // 6) send email
  await sgMail.send({
    to: process.env.SEND_TO,
    from: process.env.SEND_FROM,
    templateId: process.env.SENDGRID_TEMPLATE_ID,
    dynamicTemplateData
  }); 

  return res.status(200).json({ ok: true });
}

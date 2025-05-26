import { kv } from "@vercel/kv";
import sgMail from "@sendgrid/mail";
import dayjs from "dayjs";
import { openai } from "../utils/openaiClient.js";
import { safeParseO3 } from "../utils/safeParseO3.js";
import axios from "axios";

/* -------------------------------------------------- */
/* Config                                             */
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const QUOTES = [
  "“Healing is a matter of time, but it is sometimes also a matter of opportunity.” — Hippocrates",
  "“Nature does not hurry, yet everything is accomplished.” — Lao Tzu",
  "“The creation of a thousand forests is in one acorn.” — R. W. Emerson",
];

/* -------------------------------------------------- */
/* Helpers                                            */
const FALLBACK = {
  gardening: "https://www.epicgardening.com/",
  reading: "https://cozymystery.com/",
  crochet: "https://www.mooglyblog.com/",
  birding: "https://www.birdsandblooms.com/",
  default: "https://www.goodnewsnetwork.org/",
};

const headCheck = async (act) => {
  for (const ref of act.references) {
    try {
      const { status } = await axios.head(ref.url, { timeout: 6000 });
      if (status >= 400) throw new Error();
    } catch {
      const key = Object.keys(FALLBACK).find((k) => act.id.startsWith(k));
      ref.url = FALLBACK[key] ?? FALLBACK.default;
      ref.name += " (fallback)";
    }
  }
  return act;
};

const htmlEmail = (quote, acts) => {
  const rows = acts
    .map(
      (a) => `
<h2 style="margin:24px 0 6px;font-size:20px;">${a.emoji} ${a.title}</h2>
<p style="margin:0 0 12px;line-height:1.5;">${a.description}</p>
<p style="margin:0 0 12px;">
  <a href="${a.references[0].url}" style="color:#3481f6;">${a.references[0].name}</a><br>
  <a href="${a.references[1].url}" style="color:#3481f6;">${a.references[1].name}</a>
</p>`
    )
    .join("");
  return `<!DOCTYPE html><html><body style="font-family:Poppins,Arial;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;">
<tr><td align="center" style="padding:40px 30px 20px;">
  <h1 style="margin:0;font-size:28px;">🌸 Recovery Adventures</h1>
  <p style="margin:12px 0 0;color:#555;">Gentle inspiration while your ACL heals</p>
</td></tr>
<tr><td style="padding:0 30px 30px;">
  <blockquote style="margin:0;padding:20px;background:#f0f8ff;border-left:4px solid #b8e3ff;">${quote}</blockquote>
</td></tr>
<tr><td style="padding:0 30px;">${rows}</td></tr>
<tr><td align="center" style="padding:30px;color:#777;font-size:14px;">
  ❤️ You’ve got this, Anne!
</td></tr>
</table></td></tr></table></body></html>`;
};

/* -------------------------------------------------- */
/* Handler (cron)                                     */
export default async (_req, res) => {
  try {
    /* 1 phase label */
    const daysPost = dayjs().diff(dayjs(process.env.SURGERY_DATE), "day");
    const phase =
      daysPost < 15 ? "very limited" : daysPost < 46 ? "moderate" : "near normal";

    /* 2 duplicate guard */
    const sent = (await kv.get("anne:sentIds")) ?? [];
    const avoidIds = sent
      .filter((r) => (Date.now() - r.last) / 864e5 < 45)
      .map((r) => r.id);

    /* 3 prompt */
    const prompt = {
      role: "system",
      content: `You are Recovery-Bot. Produce STRICT JSON that matches:
{
 "activities":[
   {id,category,emoji,title,description,references:[{name,url}]}` + "]}\n\n" +
        `Rules:
• exactly 4 creative activities, friendly for ACL recovery (phase: ${phase})
• ids camel_or_kebab_case and unique
• at least 2 working reference links each
• avoidIds: ${avoidIds.join(", ") || "none"} `,
    };

    const chat = await openai.chat.completions.create({
      model: "o3-2025-04-16",
      messages: [prompt],
      response_format: { type: "json_object" },
    });

    /* 4 validate & link-check */
    let acts = safeParseO3(chat.choices[0].message.content).activities;
    acts = (await Promise.all(acts.map(headCheck))).slice(0, 4);

    /* 5 store ids */
    await kv.set(
      "anne:sentIds",
      [
        ...sent,
        ...acts.map((id) => ({ id: id.id, last: Date.now(), count: 1 })),
      ].slice(-120)
    );

    /* 6 email */
    await sgMail.send({
      to: process.env.TO_EMAIL,
      from: process.env.FROM_EMAIL,
      subject: "🌸 Recovery Adventures – Gentle Inspiration for Today",
      html: htmlEmail(
        QUOTES[Math.floor(Math.random() * QUOTES.length)],
        acts
      ),
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};

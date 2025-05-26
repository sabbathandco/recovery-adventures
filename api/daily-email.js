import { kv } from "@vercel/kv";
import sgMail from "@sendgrid/mail";
import OpenAI from "openai";
import dayjs from "dayjs";
import { parseClaude } from "../lib/validator.js";
import { ensureLinks } from "../lib/link-check.js";
import { fallbackActivities } from "./generate-activities.js";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

//  — give the SDK its key as well, just like in generate-activities
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  /* ------------------------------------------------------------ */
  /* 1) PHASE                                                    */
  const today   = dayjs().startOf("day");
  const sx      = dayjs(process.env.SURGERY_DATE);          // YYYY-MM-DD
  const days    = today.diff(sx, "day");
  const phase   = days < 15 ? "very limited"
                : days < 46 ? "moderate"
                :             "near normal";

  /* ------------------------------------------------------------ */
  /* 2) BUILD PROMPT & AVOID RECENT IDS                          */
  const sent      = (await kv.get("anne:sentIds")) ?? [];
  const avoidHint = sent.length ? `Avoid these IDs: ${sent.join(", ")}.` : "";

  const messages = [{
    role : "system",
    content : `You are Recovery-Bot. Generate *4 creative activities* only,
strict JSON as earlier. Patient phase = ${phase}. ${avoidHint}`
  }];

  /* ------------------------------------------------------------ */
  /* 3)  CALL THE MODEL  (with guard-rail)                       */
  let activities;
  try {
    const resp = await openai.chat.completions.create({
      model   : process.env.OPENAI_MODEL ?? "o3-2025-04-16",
      messages,
      reasoning_effort : "medium",
      response_format  : { type: "json_object" },
      // temperature omitted (o3 forces 1 anyway)
    });

    console.log(
        "RAW MODEL REPLY:",
        resp.choices[0].message.content.slice(0, 300)
      );

    activities =
      parseClaude(resp.choices[0].message.content).activities;   // <-- can throw
  } catch (err) {
    console.error("parse/model fail → using fallback:", err);
    activities = fallbackActivities().activities;
  }

  /* 4)  link-check & remember ids                               */
  await Promise.all(activities.map(ensureLinks));
  await kv.set(
    "anne:sentIds",
    [...sent, ...activities.map(a => a.id)].slice(-120)
  );

  /* 5)  template payload                                         */
  const dynamicTemplateData = { activities };

  /* 6)  SEND                                                     */
  await sgMail.send({
    to         : [process.env.SEND_TO, "sabbathj@gmail.com"],
    from       : process.env.SEND_FROM,
    templateId : process.env.SENDGRID_TEMPLATE_ID,
    dynamicTemplateData
  });

  return res.status(200).json({ ok: true });
}

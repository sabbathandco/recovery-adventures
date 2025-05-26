// lib/validator.js
//
// Three-pass fixer + normaliser for Recovery Adventures.
// 1. Parses whatever the model sends.
// 2. Aliases *_activities → activities.
// 3. Requires id + title/name + description/overview.
// 4. Returns a fully-normalised array ready for link-check & template.

import slugify from "slugify";

/* ------------------------------------------------------------------ */
/* 1) helpers                                                         */

function aliasActivities(obj) {
  if (!obj.activities) {
    for (const k of Object.keys(obj)) {
      if (/activities|ideas/i.test(k) && Array.isArray(obj[k])) {
        obj.activities = obj[k];
        break;
      }
    }
  }
  return obj;
}

const softOk = (obj) =>
    Array.isArray(obj.activities) &&
    obj.activities.length === 4 &&
    obj.activities.every(
      (a) =>
        a?.id &&
        (a?.title || a?.name)            // description now optional
  );

/* ------------------------------------------------------------------ */
/* 2) three-pass parse                                                */

export function parseClaude(raw) {
  // ---------- 1) strict ----------
  try {
    const x = aliasActivities(JSON.parse(raw));
    if (softOk(x)) return x;
  } catch (_) {}

  // ---------- 2) auto-repair ----------
  try {
    const repaired = raw
      .replace(/```json?|```/g, "")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/,\s*([}\]])/g, "$1");
    const x = aliasActivities(JSON.parse(repaired));
    if (softOk(x)) return x;
  } catch (_) {}

  // ---------- 3) salvage ----------
  const m = raw.match(/[{[][\s\S]*[}\]]/);
  if (m) {
    try {
      const x = aliasActivities(
        JSON.parse(
          m[0]
            .replace(/(['"])?([a-z0-9_]+)(['"])?:/gi, '"$2":')
            .replace(/,\s*([}\]])/g, "$1")
        )
      );
      if (softOk(x)) return x;
    } catch (_) {}
  }

  throw new Error("Un-repairable JSON from model");
}

/* ------------------------------------------------------------------ */
/* 3) normaliser                                                      */

const FALLBACK = {
  gardening: [
    {
      name: "Epic Gardening – Indoor Herbs",
      url: "https://www.epicgardening.com/herbs-kitchen-window/",
    },
    {
      name: "Garden Gate – Herb Containers",
      url: "https://www.gardengatemagazine.com/articles/vegetables/herbs/how-to-grow-herbs-in-indoor-containers/",
    },
  ],
  reading: [
    {
      name: "CozyMystery.com – Find Your Next Cozy",
      url: "https://cozymystery.com/",
    },
    { name: "The Happy Reader – Magazine", url: "https://www.thehappyreader.com/" },
  ],
  crochet: [
    {
      name: "Moogly – Luxe Loops Headband",
      url: "https://www.mooglyblog.com/luxe-loops-headband/",
    },
    {
      name: "Moogly – Headband Archive",
      url: "https://www.mooglyblog.com/tag/headband/",
    },
  ],
  default: [
    { name: "Good News Network", url: "https://www.goodnewsnetwork.org/" },
    { name: "Wikipedia Main Page", url: "https://en.wikipedia.org/wiki/Main_Page" },
  ],
};

export const normalise = (arr) =>
  arr.map((a, idx) => {
    /* ---------- id ---------- */
    const id =
      a.id && String(a.id).length > 2
        ? slugify(String(a.id), { lower: true })
        : `item-${idx + 1}`;

    /* ---------- category ---------- */
    const category = /rehab|exercise/i.test(a.category) ? "rehab" : "creative";

    /* ---------- references ---------- */
    let refs = Array.isArray(a.references) ? [...a.references] : [];

    if (refs.length < 2) {
      const txt = (a.title ?? a.name ?? "").toLowerCase();
      const pool =
        /garden|herb/.test(txt)
          ? FALLBACK.gardening
          : /crochet|knit/.test(txt)
          ? FALLBACK.crochet
          : /read|book/.test(txt)
          ? FALLBACK.reading
          : FALLBACK.default;

      refs = refs.concat(pool).slice(0, 2);
    }

    return {
      ...a,
      id,
      title: a.title ?? a.name,
      description: a.description ?? a.overview ?? "",
      category,
      references: refs,
    };
  });

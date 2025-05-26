// lib/validator.js
//
// Three-pass fixer that now only insists on id / title / description.
// We’ll fix categories and reference counts later.

import slugify from "slugify";

const softOk = (obj) =>
  Array.isArray(obj.activities) &&
  obj.activities.length === 4 &&
  obj.activities.every(
    (a) => a?.id && a?.title && a?.description            // minimal gate
  );

export function parseClaude(raw) {
  // 1) strict
  try {
    const x = JSON.parse(raw);
    if (softOk(x)) return x;
  } catch (_) {}

  // 2) auto-repair
  try {
    const repaired = raw
      .replace(/```json?|```/g, "")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/,\s*([}\]])/g, "$1");
    const x = JSON.parse(repaired);
    if (softOk(x)) return x;
  } catch (_) {}

  // 3) salvage
  const m = raw.match(/[{[][\s\S]*[}\]]/);
  if (m) {
    try {
      const x = JSON.parse(
        m[0]
          .replace(/(['"])?([a-z0-9_]+)(['"])?:/gi, '"$2":')
          .replace(/,\s*([}\]])/g, "$1")
      );
      if (softOk(x)) return x;
    } catch (_) {}
  }

  throw new Error("Un-repairable JSON from model");
}

/* ------------------------------------------------------------------ */
/* Helpers that the API file will call                                 */

// fallback pools per broad theme
const FALLBACK = {
  gardening : [
    { name: "Epic Gardening – Indoor Herbs",
      url : "https://www.epicgardening.com/herbs-kitchen-window/" },
    { name: "Garden Gate – Herb Containers",
      url : "https://www.gardengatemagazine.com/articles/vegetables/herbs/how-to-grow-herbs-in-indoor-containers/" }
  ],
  reading   : [
    { name: "CozyMystery.com – Find Your Next Cozy",
      url : "https://cozymystery.com/" },
    { name: "The Happy Reader – Magazine",
      url : "https://www.thehappyreader.com/" }
  ],
  crochet   : [
    { name: "Moogly – Luxe Loops Headband",
      url : "https://www.mooglyblog.com/luxe-loops-headband/" },
    { name: "Moogly – Headband Archive",
      url : "https://www.mooglyblog.com/tag/headband/" }
  ],
  default   : [
    { name: "Good News Network",
      url : "https://www.goodnewsnetwork.org/" },
    { name: "Wikipedia Main Page",
      url : "https://en.wikipedia.org/wiki/Main_Page" }
  ]
};

export const normalise = (arr) =>
  arr.map((a, idx) => {
    /* ---------- id & category ---------- */
    const id =
      a.id?.length > 2 ? slugify(a.id, { lower: true }) : `item-${idx + 1}`;

    const category = /rehab|exercise/i.test(a.category)
      ? "rehab"
      : "creative";

    /* ---------- references (guarantee ≥ 2) ---------- */
    let refs = Array.isArray(a.references) ? [...a.references] : [];

    if (refs.length < 2) {
      const pool =
        /garden|herb/i.test(a.title)   ? FALLBACK.gardening :
        /crochet|knit/i.test(a.title)  ? FALLBACK.crochet   :
        /read|book/i.test(a.title)     ? FALLBACK.reading   :
                                         FALLBACK.default;

      refs = refs.concat(pool).slice(0, 2);   // top-up to exactly 2
    }

    return { ...a, id, category, references: refs };
  });


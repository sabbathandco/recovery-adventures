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

export const normalise = (arr) =>
  arr.map((a, idx) => {
    // slug id
    const id =
      (a.id.length > 2 ? slugify(a.id, { lower: true }) : `item-${idx + 1}`);

    // creative | rehab
    const category = /rehab|exercise/i.test(a.category)
      ? "rehab"
      : "creative";

    return {
      ...a,
      id,
      category,
      references: Array.isArray(a.references) ? a.references : [],
    };
  });

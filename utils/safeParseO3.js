import axios from "axios";

/** Hard schema we want *before* it hits the template */
const schemaOk = (d) =>
  Array.isArray(d.activities) &&
  d.activities.length === 4 &&
  d.activities.every(
    (a) =>
      a.id &&
      a.title &&
      a.description &&
      Array.isArray(a.references) &&
      a.references.length >= 2
  );

/** Three-pass fixer */
export const safeParseO3 = (raw) => {
  // 1) strict
  try {
    const o = JSON.parse(raw);
    if (schemaOk(o)) return o;
  } catch (_) {}

  // 2) auto-repair
  try {
    const fixed = raw
      .replace(/```json?|```/g, "")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/,\s*([}\]])/g, "$1");
    const o = JSON.parse(fixed);
    if (schemaOk(o)) return o;
  } catch (_) {}

  // 3) salvage largest JSON block
  const m = raw.match(/[{[][\s\S]*[}\]]/);
  if (m) {
    try {
      const o = JSON.parse(
        m[0]
          .replace(/(['"])?([a-z0-9_]+)(['"])?:/gi, '"$2":')
          .replace(/,\s*([}\]])/g, "$1")
      );
      if (schemaOk(o)) return o;
    } catch (_) {}
  }
  throw new Error("un-repairable JSON");
};

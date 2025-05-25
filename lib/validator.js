import fs from "fs";

// strict schema check
const ok = (obj) =>
  Array.isArray(obj.activities) &&
  obj.activities.length === 4 &&
  obj.activities.every(
    (a) =>
      a.id && a.category && a.title && a.description && a.references?.length >= 2
  );

export function parseClaude(raw) {
  // 1) strict
  try {
    const x = JSON.parse(raw);
    if (ok(x)) return x;
  } catch (_) {}

  // 2) repair common LLM slips
  try {
    const repaired = raw
      .replace(/```json?|```/g, "")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/,\s*([}\]])/g, "$1");
    const x = JSON.parse(repaired);
    if (ok(x)) return x;
  } catch (_) {}

  // 3) salvage largest JSON-ish block
  const m = raw.match(/[{[][\s\S]*[}\]]/);
  if (m) {
    try {
      const x = JSON.parse(
        m[0]
          .replace(/(['"])?([a-z0-9_]+)(['"])?:/gi, '"$2":')
          .replace(/,\s*([}\]])/g, "$1")
      );
      if (ok(x)) return x;
    } catch (_) {}
  }
  throw new Error("Un-repairable JSON from model");
}

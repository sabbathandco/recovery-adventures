import axios from "axios";

const FALLBACKS = {
  gardening: "https://www.epicgardening.com/",
  reading: "https://cozymystery.com/",
  crochet: "https://www.mooglyblog.com/",
  birding: "https://www.birdsandblooms.com/"
};

export async function ensureLinks(activity) {
  for (const ref of activity.references) {
    try {
      const { status } = await axios.head(ref.url, { timeout: 8000 });
      if (status >= 400) throw new Error("bad");
    } catch {
      const cat = activity.id.split("_")[0];
      ref.url = FALLBACKS[cat] ?? "https://www.goodnews.com/";
      ref.name += " (fallback)";
    }
  }
  return activity;
}

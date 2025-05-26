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

export function fallbackActivities() {
  return {
    activities: [
      {
        id: "windowsill_herb_garden",
        category: "creative",
        emoji: "🌿",
        title: "Start a Mini Windowsill Herb Garden",
        description:
          "Invite fresh aromas into the kitchen by sowing fast-growing favorites such as basil, mint and chives in small pots. Five minutes a day of watering and rotating the containers keeps you moving without stressing the knee, and the plants become an easy win you can taste within a fortnight.",
        references: [
          {
            name: "Epic Gardening – 15 Herbs for Your Kitchen Window",
            url: "https://www.epicgardening.com/herbs-kitchen-window/"
          },
          {
            name: "Garden Gate – Indoor Herb Containers",
            url: "https://www.gardengatemagazine.com/articles/vegetables/herbs/how-to-grow-herbs-in-indoor-containers/"
          }
        ]
      },
      {
        id: "cozy_mystery_reading_night",
        category: "creative",
        emoji: "📚",
        title: "Cozy-Mystery Reading Night",
        description:
          "Build a pillow-fort of blankets, stream soft rain sounds, and lose yourself in a culinary whodunit. Light mental engagement keeps boredom at bay while your body rests. Snap a photo of your book nook to share with friends for extra motivation.",
        references: [
          {
            name: "CozyMystery.com – Find Your Next Cozy",
            url: "https://cozymystery.com/"
          },
          {
            name: "The Happy Reader – Literary Magazine",
            url: "https://www.thehappyreader.com/"
          }
        ]
      },
      {
        id: "crochet_comfort_headband",
        category: "creative",
        emoji: "🧶",
        title: "Crochet a Plush Comfort Headband",
        description:
          "Keep hands busy and mind calm by stitching the Luxe Loops headband. The simple rows let you pause anytime if the knee needs elevation, and the finished piece doubles as a thoughtful gift.",
        references: [
          {
            name: "Moogly – Luxe Loops Headband Pattern",
            url: "https://www.mooglyblog.com/luxe-loops-headband/"
          },
          {
            name: "Moogly – Headband Pattern Archive",
            url: "https://www.mooglyblog.com/tag/headband/"
          }
        ]
      },
      {
        id: "birdsong_journaling_playlist",
        category: "creative",
        emoji: "🐦",
        title: "Curate a Backyard Bird-Song Playlist & Journal",
        description:
          "Open a free nature-sound clip, jot what you hear and sketch a quick silhouette of each bird. It’s a mindful sensory exercise you can do seated with the leg supported, yet it still feels exploratory and fresh.",
        references: [
          {
            name: "Birds & Blooms – Birdwatching for Beginners",
            url: "https://www.birdsandblooms.com/birding/birding-basics/birdwatching-for-beginners/"
          },
          {
            name: "r/Birding – Community Inspiration & IDs",
            url: "https://www.reddit.com/r/birding/"
          }
        ]
      }
    ]
  };
}

/**
 * buddy-fetch.js
 * Utility functions to extract quest slugs, fetch quest data from buddy.farm,
 * and parse the response into Farm RPG Helper quest models.
 */

/**
 * Extracts the quest slug from a buddy.farm URL, pathname, or raw string.
 * Examples handled:
 *   - "https://buddy.farm/q/not-from-around-here/" -> "not-from-around-here"
 *   - "https://buddy.farm/q/not-from-around-here?dark=true" -> "not-from-around-here"
 *   - "buddy.farm/q/not-from-around-here" -> "not-from-around-here"
 *   - "/q/not-from-around-here/" -> "not-from-around-here"
 *   - "not-from-around-here" -> "not-from-around-here"
 *   - "Not From Around Here" -> "not-from-around-here"
 *
 * @param {string} input - URL, path, or quest name/slug
 * @returns {string} Clean lowercase slug
 */
export function extractQuestSlug(input) {
  if (!input || typeof input !== "string") return "";
  const s = input.trim();
  if (!s) return "";

  // 1. Direct regex match for /q/<slug> anywhere in the string
  const qMatch = s.match(/\/q\/([a-zA-Z0-9-_]+)/i);
  if (qMatch && qMatch[1]) {
    return qMatch[1].toLowerCase();
  }

  // 2. If it's a URL or contains query/hash, strip protocol, domain, query, hash
  let cleaned = s.replace(/^https?:\/\//i, "");
  cleaned = cleaned.replace(/^[a-zA-Z0-9.-]+\//, ""); // remove domain if present
  cleaned = cleaned.split("?")[0].split("#")[0].trim().replace(/^\/+|\/+$/g, "");

  if (cleaned.toLowerCase().startsWith("q/")) {
    cleaned = cleaned.slice(2);
  }

  // 3. Normalize spaces and special characters into slug format
  return cleaned
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Parses raw quest data returned by buddy.farm Gatsby page-data endpoint
 * into a standardized Farm RPG Helper quest object.
 *
 * @param {object} rawQuest - Quest object from buddy.farm
 * @returns {object} Standardized quest data
 */
export function parseBuddyQuestData(rawQuest) {
  if (!rawQuest || typeof rawQuest !== "object") {
    throw new Error("Invalid quest data received from buddy.farm.");
  }

  const title = (rawQuest.name || "").trim();
  const npc = (rawQuest.npc || "").trim() || "Unknown";
  const description = (rawQuest.cleanDescription || rawQuest.description || "").trim();

  // Skill prerequisites (Farming, Fishing, Crafting, Exploring, Cooking, Mining)
  const skills = {
    farming: parseInt(rawQuest.requiredFarmingLevel, 10) || 0,
    fishing: parseInt(rawQuest.requiredFishingLevel, 10) || 0,
    crafting: parseInt(rawQuest.requiredCraftingLevel, 10) || 0,
    exploring: parseInt(rawQuest.requiredExploringLevel, 10) || 0,
    cooking: parseInt(rawQuest.requiredCookingLevel, 10) || 0,
    mining: parseInt(rawQuest.requiredMiningLevel, 10) || 0
  };

  const skillNames = {
    farming: "Farming",
    fishing: "Fishing",
    crafting: "Crafting",
    exploring: "Exploring",
    cooking: "Cooking",
    mining: "Mining"
  };

  const levelReqParts = [];
  for (const [key, val] of Object.entries(skills)) {
    if (val > 0) {
      levelReqParts.push(`${skillNames[key]} ${val}`);
    }
  }
  const levelReq = levelReqParts.join(", ");

  // Required Materials
  const requirements = [];
  if (Array.isArray(rawQuest.requiredItems)) {
    for (const itemObj of rawQuest.requiredItems) {
      const itemName = (itemObj.item?.name || itemObj.name || "").trim();
      const quantity = parseInt(itemObj.quantity, 10) || 0;
      if (itemName && quantity > 0) {
        requirements.push({
          item: itemName,
          amount: quantity
        });
      }
    }
  }

  // If buddy.farm includes requiredSilver > 0, include it as a material requirement
  const requiredSilver = parseInt(rawQuest.requiredSilver, 10) || 0;
  if (requiredSilver > 0) {
    requirements.push({
      item: "Silver",
      amount: requiredSilver
    });
  }

  // Rewards (Silver, Gold, Items)
  const rewards = [];
  const rewardSilver = parseInt(rawQuest.rewardSilver, 10) || 0;
  if (rewardSilver > 0) {
    rewards.push({
      type: "silver",
      amount: rewardSilver,
      label: "Silver"
    });
  }

  const rewardGold = parseInt(rawQuest.rewardGold, 10) || 0;
  if (rewardGold > 0) {
    rewards.push({
      type: "gold",
      amount: rewardGold,
      label: "Gold"
    });
  }

  if (Array.isArray(rawQuest.rewardItems)) {
    for (const itemObj of rawQuest.rewardItems) {
      const itemName = (itemObj.item?.name || itemObj.name || "").trim();
      const quantity = parseInt(itemObj.quantity, 10) || 0;
      if (itemName && quantity > 0) {
        rewards.push({
          type: "item",
          item: itemName,
          label: itemName,
          amount: quantity
        });
      }
    }
  }

  return {
    title,
    npc,
    description,
    skills,
    levelReq,
    requirements,
    rewards
  };
}

/**
 * Fetches quest details from buddy.farm using the quest slug or URL.
 * Automatically attempts direct Gatsby page-data endpoint first,
 * with a fallback to a CORS proxy if direct fetch is blocked by the environment.
 *
 * @param {string} slugOrUrl - URL or slug of the quest
 * @returns {Promise<object>} Parsed quest details
 */
export async function fetchBuddyFarmQuest(slugOrUrl) {
  const slug = extractQuestSlug(slugOrUrl);
  if (!slug) {
    throw new Error("Please enter a valid buddy.farm quest link or slug (e.g. https://buddy.farm/q/not-from-around-here/).");
  }

  const directUrl = `https://buddy.farm/page-data/q/${slug}/page-data.json`;
  let data = null;
  let lastError = null;

  // 1. Direct fetch
  try {
    const response = await fetch(directUrl);
    if (response.ok) {
      data = await response.json();
    } else if (response.status === 404) {
      throw new Error(`Quest "${slug}" was not found on buddy.farm (404). Please check the quest name or link.`);
    } else {
      throw new Error(`buddy.farm returned HTTP status ${response.status}.`);
    }
  } catch (err) {
    lastError = err;
  }

  // 2. Fallback via CORS proxy if direct fetch failed (and wasn't a confirmed 404)
  if (!data && (!lastError || !lastError.message.includes("404"))) {
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`;
      const proxyRes = await fetch(proxyUrl);
      if (proxyRes.ok) {
        data = await proxyRes.json();
      } else if (proxyRes.status === 404) {
        throw new Error(`Quest "${slug}" was not found on buddy.farm (404). Please check the quest name or link.`);
      }
    } catch (proxyErr) {
      // Keep lastError
    }
  }

  if (!data) {
    throw lastError || new Error("Unable to connect to buddy.farm. Please check your internet connection.");
  }

  const quests = data?.result?.data?.farmrpg?.quests;
  if (!quests || !quests.length) {
    throw new Error(`No quest data found for "${slug}" on buddy.farm.`);
  }

  return parseBuddyQuestData(quests[0]);
}

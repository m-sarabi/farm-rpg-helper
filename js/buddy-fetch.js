/**
 * buddy-fetch.js
 * Utility functions to extract quest slugs, fetch quest data from buddy.farm,
 * and parse the response into Farm RPG Helper quest models.
 */

import { getQuestCatalogEntry } from "./quests-catalog.js";

/**
 * Extracts the quest slug from a buddy.farm URL, pathname, or raw string.
 */
export function extractQuestSlug(input) {
  if (!input || typeof input !== "string") return "";
  const s = input.trim();
  if (!s) return "";

  const qMatch = s.match(/\/q\/([a-zA-Z0-9-_]+)/i);
  if (qMatch && qMatch[1]) {
    return qMatch[1].toLowerCase();
  }

  let cleaned = s.replace(/^https?:\/\//i, "");
  cleaned = cleaned.replace(/^[a-zA-Z0-9.-]+\//, "");
  cleaned = cleaned.split("?")[0].split("#")[0].trim().replace(/^\/+|\/+$/g, "");

  if (cleaned.toLowerCase().startsWith("q/")) {
    cleaned = cleaned.slice(2);
  }

  return cleaned
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const romanValues = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
function parseRoman(str) {
  const s = (str || "").toLowerCase().trim();
  let total = 0;
  let prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const val = romanValues[s[i]];
    if (!val) return null;
    if (val < prev) total -= val;
    else {
      total += val;
      prev = val;
    }
  }
  return total > 0 ? total : null;
}

export function parseStepNumber(questName, questlineTitle) {
  const qName = (questName || "").trim();
  const qlTitle = (questlineTitle || "").trim();

  if (qlTitle && qName.toLowerCase() === qlTitle.toLowerCase()) {
    return 1;
  }

  const match = qName.match(/[\s\-_]+([ivxlcdm]+|\d+)$/i);
  if (match) {
    const token = match[1];
    if (/^\d+$/.test(token)) return parseInt(token, 10);
    const rom = parseRoman(token);
    if (rom !== null) return rom;
  }
  return 1;
}

/**
 * Parses raw quest data returned by buddy.farm Gatsby page-data endpoint
 * into a standardized Farm RPG Helper quest object.
 */
export function parseBuddyQuestData(rawQuest) {
  if (!rawQuest || typeof rawQuest !== "object") {
    throw new Error("Invalid quest data received from buddy.farm.");
  }

  const title = (rawQuest.name || "").trim();
  const npc = (rawQuest.npc || "").trim() || "Unknown";
  const description = (rawQuest.cleanDescription || rawQuest.description || "").trim();

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
  if (rawQuest.requiredTowerLevel > 0) {
    levelReqParts.push(`Tower ${rawQuest.requiredTowerLevel}`);
  }
  if (rawQuest.requiredNpc && rawQuest.requiredNpcLevel > 0) {
    const npcName = rawQuest.requiredNpc.name || rawQuest.requiredNpc;
    levelReqParts.push(`${npcName} Friendship ${rawQuest.requiredNpcLevel}`);
  }
  const levelReq = levelReqParts.join(", ");

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

  const requiredSilver = parseInt(rawQuest.requiredSilver, 10) || 0;
  if (requiredSilver > 0) {
    requirements.push({
      item: "Silver",
      amount: requiredSilver
    });
  }

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
    towerLevel: parseInt(rawQuest.requiredTowerLevel, 10) || 0,
    requiredNpc: rawQuest.requiredNpc ? (rawQuest.requiredNpc.name || rawQuest.requiredNpc) : null,
    requiredNpcLevel: parseInt(rawQuest.requiredNpcLevel, 10) || 0,
    levelReq,
    requirements,
    rewards
  };
}

/**
 * Fetches all quests in bulk from buddy.farm's master endpoint.
 * Groups quests by questline, links sequential dependencies (prevQuestId),
 * and enriches with material requirements and rewards.
 *
 * @param {Function} [onProgress] - Optional status progress callback
 * @returns {Promise<Array>} Standardized array of quests
 */
export async function fetchBuddyFarmAllQuests(onProgress = () => {}) {
  const masterUrl = "https://buddy.farm/page-data/quests/page-data.json";
  let data = null;
  let lastError = null;

  onProgress("Connecting to buddy.farm...");

  // 1. Direct fetch from buddy.farm
  try {
    const res = await fetch(masterUrl);
    if (res.ok) {
      data = await res.json();
    } else {
      throw new Error(`buddy.farm returned HTTP ${res.status}`);
    }
  } catch (err) {
    lastError = err;
  }

  // 2. Fallback via CORS proxy if direct fetch fails
  if (!data) {
    try {
      onProgress("Retrying connection via proxy...");
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(masterUrl)}`;
      const proxyRes = await fetch(proxyUrl);
      if (proxyRes.ok) {
        data = await proxyRes.json();
      }
    } catch (proxyErr) {
      // proxy failed
    }
  }

  // 3. Fallback to local data/quests.json if offline or network unavailable
  if (!data) {
    try {
      onProgress("Using pre-compiled local quest catalog...");
      const localRes = await fetch("./data/quests.json");
      if (localRes.ok) {
        const localQuests = await localRes.json();
        if (Array.isArray(localQuests) && localQuests.length > 0) {
          return localQuests;
        }
      }
    } catch (localErr) {
      // ignore
    }
  }

  if (!data) {
    throw lastError || new Error("Unable to connect to buddy.farm. Please check your internet connection.");
  }

  const rawQuests = data?.result?.data?.farmrpg?.quests;
  if (!Array.isArray(rawQuests) || rawQuests.length === 0) {
    throw new Error("Invalid or empty quest data received from buddy.farm.");
  }

  onProgress(`Processing ${rawQuests.length} quests and questlines...`);

  // Group quests by questline to establish sequential step order
  const qlGroups = new Map();
  for (const q of rawQuests) {
    const qlTitle = q.questlines?.[0]?.questline?.title || null;
    if (qlTitle) {
      if (!qlGroups.has(qlTitle)) qlGroups.set(qlTitle, []);
      qlGroups.get(qlTitle).push(q);
    }
  }

  const questStepMap = new Map();
  for (const [title, group] of qlGroups.entries()) {
    group.sort((a, b) => {
      const catA = getQuestCatalogEntry(a.name);
      const catB = getQuestCatalogEntry(b.name);
      if (catA?.stepNumber !== undefined && catB?.stepNumber !== undefined) {
        return catA.stepNumber - catB.stepNumber;
      }
      return parseStepNumber(a.name, title) - parseStepNumber(b.name, title);
    });

    for (let i = 0; i < group.length; i++) {
      const current = group[i];
      const prev = i > 0 ? group[i - 1] : null;
      questStepMap.set(current.id, {
        questlineTitle: title,
        stepNumber: i + 1,
        totalSteps: group.length,
        prevQuestId: prev ? prev.id : null,
        prevQuestTitle: prev ? prev.name : null
      });
    }
  }

  const skillLabels = {
    farming: "Farming",
    fishing: "Fishing",
    crafting: "Crafting",
    exploring: "Exploring",
    cooking: "Cooking",
    mining: "Mining"
  };

  const finalQuests = rawQuests.map(q => {
    const catalogEntry = getQuestCatalogEntry(q.name);
    const stepInfo = questStepMap.get(q.id) || {
      questlineTitle: q.questlines?.[0]?.questline?.title || catalogEntry?.questline || null,
      stepNumber: catalogEntry?.stepNumber || 1,
      totalSteps: catalogEntry?.totalSteps || 1,
      prevQuestId: catalogEntry?.prevQuestId || null,
      prevQuestTitle: catalogEntry?.prevQuestTitle || null
    };

    const skills = {
      farming: q.requiredFarmingLevel || 0,
      fishing: q.requiredFishingLevel || 0,
      crafting: q.requiredCraftingLevel || 0,
      exploring: q.requiredExploringLevel || 0,
      cooking: q.requiredCookingLevel || 0,
      mining: 0
    };

    const skillTextParts = [];
    for (const [k, v] of Object.entries(skills)) {
      if (v > 0) skillTextParts.push(`${skillLabels[k]} ${v}`);
    }
    if (q.requiredTowerLevel > 0) {
      skillTextParts.push(`Tower ${q.requiredTowerLevel}`);
    }
    if (q.requiredNpc && q.requiredNpcLevel > 0) {
      const npcName = q.requiredNpc.name || q.requiredNpc;
      skillTextParts.push(`${npcName} Friendship ${q.requiredNpcLevel}`);
    }

    return {
      id: q.id,
      title: q.name.trim(),
      npc: (q.npc || "Buddy").trim(),
      description: (q.cleanDescription || "").trim(),
      image: q.image || "",
      skills,
      towerLevel: q.requiredTowerLevel || 0,
      requiredNpc: q.requiredNpc ? (q.requiredNpc.name || q.requiredNpc) : null,
      requiredNpcLevel: q.requiredNpcLevel || 0,
      levelReq: skillTextParts.join(", "),
      questline: stepInfo.questlineTitle,
      stepNumber: stepInfo.stepNumber,
      totalSteps: stepInfo.totalSteps,
      prevQuestId: stepInfo.prevQuestId,
      prevQuestTitle: stepInfo.prevQuestTitle,
      requirements: catalogEntry?.requirements || [],
      rewards: catalogEntry?.rewards || [],
      status: "active",
      pinned: false
    };
  });

  onProgress(`Import complete! Loaded ${finalQuests.length} quests.`);
  return finalQuests;
}

/**
 * Fetches quest details from buddy.farm using the quest slug or URL.
 */
export async function fetchBuddyFarmQuest(slugOrUrl) {
  const slug = extractQuestSlug(slugOrUrl);
  if (!slug) {
    throw new Error("Please enter a valid buddy.farm quest link or slug (e.g. https://buddy.farm/q/not-from-around-here/).");
  }

  const directUrl = `https://buddy.farm/page-data/q/${slug}/page-data.json`;
  let data = null;
  let lastError = null;

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

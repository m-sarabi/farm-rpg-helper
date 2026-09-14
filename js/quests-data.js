// Default starter quests (empty by default)
export const DEFAULT_QUESTS = [];

// The 6 Farm RPG skills
export const SKILLS_LIST = [
  { id: "farming", name: "Farming", icon: "assets/Corn.png", fallback: "🌽" },
  { id: "fishing", name: "Fishing", icon: "assets/Fishing Hook.png", fallback: "🎣" },
  { id: "crafting", name: "Crafting", icon: "assets/Hammer.png", fallback: "🔨" },
  { id: "exploring", name: "Exploring", icon: "assets/Compass.png", fallback: "🧭" },
  { id: "cooking", name: "Cooking", icon: "assets/Cooking Pot.png", fallback: "🍳" },
  { id: "mining", name: "Mining", icon: "assets/Pickaxe.png", fallback: "⛏️" }
];

export function getSkillIconHtml(skillKey, extraClass = "") {
  const key = (skillKey || "").toLowerCase().trim();
  const skill = SKILLS_LIST.find(s => s.id === key);
  if (!skill) return "🎯";
  return `<span class="skill-icon-wrapper ${extraClass}"><img class="skill-badge-img" src="${encodeURI(skill.icon)}" alt="${skill.name}" loading="lazy" onerror="this.outerHTML='${skill.fallback}';" /></span>`;
}

// The 24 main Farm RPG NPCs with authentic Bobblehead icons and aliases
export const MAIN_NPCS = [
  { name: "Baba Gec", icon: "assets/Baba Bobblehead.png", aliases: ["baba gec", "baba gex"] },
  { name: "Beatrix", icon: "assets/Beatrix Bobblehead.png", aliases: ["beatrix"] },
  { name: "Borgen", icon: "assets/Borgen Bobblehead.png", aliases: ["borgen"] },
  { name: "Buddy", icon: "assets/Buddy Bobblehead.png", aliases: ["buddy"] },
  { name: "Captain Thomas", icon: "assets/CptThomas Bobblehead.png", aliases: ["captain thomas", "cpt thomas", "cptthomas"] },
  { name: "Cecil", icon: "assets/Cecil Bobblehead.png", aliases: ["cecil"] },
  { name: "Charles Horsington III", icon: "assets/Charles Bobblehead.png", aliases: ["charles horsington iii", "charles"] },
  { name: "Cid", icon: "assets/Cid Bobblehead.png", aliases: ["cid"] },
  { name: "frank", icon: "assets/frank Bobblehead.png", aliases: ["frank"] },
  { name: "Gary Bearson V", icon: "assets/Gary Bobblehead.png", aliases: ["gary bearson v", "gary bearson", "gary"] },
  { name: "Geist", icon: "assets/Geist Bobblehead.png", aliases: ["geist"] },
  { name: "George", icon: "assets/George Bobblehead.png", aliases: ["george"] },
  { name: "Goostav", icon: "assets/Goostav Bobblehead.png", aliases: ["goostav"] },
  { name: "Holger", icon: "assets/Holger Bobblehead.png", aliases: ["holger"] },
  { name: "Jill", icon: "assets/Jill Bobblehead.png", aliases: ["jill"] },
  { name: "Lorn", icon: "assets/Lorn Bobblehead.png", aliases: ["lorn"] },
  { name: "Mariya", icon: "assets/Mariya Bobblehead.png", aliases: ["mariya"] },
  { name: "Mummy", icon: "assets/Mummy Bobblehead.png", aliases: ["mummy"] },
  { name: "Ric Ryph", icon: "assets/Ric Ryph Bobblehead.png", aliases: ["ric ryph", "ric"] },
  { name: "ROOMBA", icon: "assets/Roomba Bobblehead.png", aliases: ["roomba"] },
  { name: "Rosalie", icon: "assets/Rosalie Bobblehead.png", aliases: ["rosalie"] },
  { name: "Star Meerif", icon: "assets/Star Bobblehead.png", aliases: ["star meerif", "star"] },
  { name: "Thomas", icon: "assets/Thomas Bobblehead.png", aliases: ["thomas"] },
  { name: "Vincent", icon: "assets/Vincent Bobblehead.png", aliases: ["vincent"] }
];

export function normalizeNpcName(npcName) {
  if (!npcName) return null;
  const clean = String(npcName).trim().toLowerCase();
  for (const npc of MAIN_NPCS) {
    if (npc.name.toLowerCase() === clean) return npc.name;
    if (npc.aliases && npc.aliases.some(a => a === clean)) return npc.name;
  }
  for (const npc of MAIN_NPCS) {
    if (clean.startsWith(npc.name.toLowerCase()) || npc.name.toLowerCase().startsWith(clean)) {
      return npc.name;
    }
  }
  return npcName;
}

export function getNpcIcon(npcName) {
  const norm = normalizeNpcName(npcName);
  const found = MAIN_NPCS.find(n => n.name === norm);
  return found ? found.icon : null;
}

// Suggested NPC list for quest giver dropdowns
export const NPC_LIST = [
  ...MAIN_NPCS.map(n => n.name),
  "unknown"
];

// Common items in Farm RPG with standard icons / emojis for friendly UI
export const ITEM_ICONS = {
  "Wood": "🪵",
  "Board": "🪵",
  "Stone": "🪨",
  "Iron": "⛏️",
  "Nails": "🔩",
  "Corn": "🌽",
  "Carrot": "🥕",
  "Potato": "🥔",
  "Flour": "🌾",
  "Egg": "🥚",
  "Strawberry": "🍓",
  "Trout": "🐟",
  "Worms": "🪱",
  "Fishing Net": "🕸️",
  "Rope": "🪢",
  "Leather": "👞",
  "Large Clam": "🦪",
  "Sea Glass": "💎",
  "Orange Juice": "🍊",
  "Lemonade": "🍋",
  "Apple Cider": "🍏",
  "Ancient Coin": "🪙",
  "Borgen Buck": "🎟️",
  "Silver": "🪙",
  "Gold": "✨",
  "Watermelon": "🍉",
  "Tomato": "🍅",
  "Wheat": "🌾",
  "Cabbage": "🥬",
  "Mushroom": "🍄",
  "Copper": "🥉",
  "Glass": "🧪",
  "Coal": "⬛",
  "default": "📦"
};

import { getItemImageFilename, KNOWN_ITEM_NAMES, ALL_FARM_RPG_ITEMS } from "./items-data.js";

export { KNOWN_ITEM_NAMES, ALL_FARM_RPG_ITEMS, getItemImageFilename };

export function getItemIcon(itemName) {
  if (!itemName) return "📦";
  const trimmed = itemName.trim();
  return ITEM_ICONS[trimmed] || ITEM_ICONS.default;
}

/**
 * Renders an authentic game icon HTML element for an item.
 * Loads assets/<Filename>.png with crisp pixel art styling.
 * If the image is not found or fails to load, gracefully falls back to the item emoji.
 */
export function renderItemIconHtml(itemName, extraClass = "") {
  if (!itemName) {
    return `<span class="item-icon-wrapper ${extraClass}"><span class="item-icon-fallback">📦</span></span>`;
  }
  const trimmed = itemName.trim();
  const filename = getItemImageFilename(trimmed);
  const fallbackEmoji = getItemIcon(trimmed);
  const encodedSrc = `assets/${encodeURIComponent(filename)}`;

  return `
    <span class="item-icon-wrapper ${extraClass}" data-item="${trimmed}" title="${trimmed}">
      <img class="item-icon-img" src="${encodedSrc}" alt="${trimmed}" loading="lazy" onerror="this.classList.add('is-hidden');" />
      <span class="item-icon-fallback">${fallbackEmoji}</span>
    </span>
  `.trim();
}

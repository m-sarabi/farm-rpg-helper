// Default starter quests (empty by default)
export const DEFAULT_QUESTS = [];

// The 6 Farm RPG skills
export const SKILLS_LIST = [
  { id: "farming", name: "Farming", icon: "assets/Corn.png" },
  { id: "fishing", name: "Fishing", icon: "🎣" },
  { id: "crafting", name: "Crafting", icon: "🔨" },
  { id: "exploring", name: "Exploring", icon: "🧭" },
  { id: "cooking", name: "Cooking", icon: "🍳" },
  { id: "mining", name: "Mining", icon: "⛏️" }
];

// Suggested NPC list for quest giver dropdowns
export const NPC_LIST = [
  "Baba Gec",
  "Beatrix",
  "Borgen",
  "Buddy",
  "Captain Thomas",
  "Cecil",
  "Charles Horsington III",
  "Cid",
  "frank",
  "Gary Bearson V",
  "Geist",
  "George",
  "Goostav",
  "Holger",
  "Jill",
  "Lorn",
  "Mariya",
  "Mummy",
  "Ric Ryph",
  "ROOMBA",
  "Rosalie",
  "Star Meerif",
  "Thomas",
  "Vincent"
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

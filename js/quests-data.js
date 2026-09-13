// Starter dataset of authentic Farm RPG quests and popular early/mid-game questlines
export const DEFAULT_QUESTS = [
  {
    id: "quest-1",
    title: "Buddy's Warm Welcome",
    npc: "Buddy",
    description: "Welcome to the farm! Buddy is wagging his tail happily. Let's gather some basic materials to fix up the porch.",
    levelReq: "Farming 1",
    status: "active", // "active" | "completed"
    pinned: true,
    requirements: [
      { item: "Wood", amount: 15 },
      { item: "Stone", amount: 10 }
    ],
    rewards: [
      { type: "silver", label: "Silver", amount: 250 },
      { type: "item", label: "Orange Juice", amount: 2 },
      { type: "xp", label: "Farming XP", amount: 50 }
    ]
  },
  {
    id: "quest-2",
    title: "Corn Quandary I",
    npc: "Beatrix",
    description: "The animals are getting hungry and we're in dire need of sweet corn! Plant and harvest a fresh batch.",
    levelReq: "Farming 5",
    status: "active",
    pinned: true,
    requirements: [
      { item: "Corn", amount: 50 }
    ],
    rewards: [
      { type: "silver", label: "Silver", amount: 1200 },
      { type: "item", label: "Lemonade", amount: 1 },
      { type: "xp", label: "Farming XP", amount: 300 }
    ]
  },
  {
    id: "quest-3",
    title: "Tool Time I",
    npc: "Vincent",
    description: "Vincent needs supplies to forge sturdier tools for the community workshop. Bring iron and timber.",
    levelReq: "Crafting 10",
    status: "active",
    pinned: false,
    requirements: [
      { item: "Iron", amount: 25 },
      { item: "Board", amount: 40 },
      { item: "Nails", amount: 50 }
    ],
    rewards: [
      { type: "silver", label: "Silver", amount: 3500 },
      { type: "gold", label: "Gold", amount: 5 },
      { type: "xp", label: "Crafting XP", amount: 800 }
    ]
  },
  {
    id: "quest-4",
    title: "Rosalie's Fresh Pies I",
    npc: "Rosalie",
    description: "The town festival is approaching and the bakery smells heavenly, but Rosalie is all out of flour and eggs.",
    levelReq: "Farming 12",
    status: "active",
    pinned: false,
    requirements: [
      { item: "Flour", amount: 30 },
      { item: "Egg", amount: 20 },
      { item: "Strawberry", amount: 40 }
    ],
    rewards: [
      { type: "silver", label: "Silver", amount: 5000 },
      { type: "item", label: "Apple Cider", amount: 3 },
      { type: "xp", label: "Cooking XP", amount: 1200 }
    ]
  },
  {
    id: "quest-5",
    title: "Fishing Fever I",
    npc: "Jill",
    description: "Jill is testing out the waters near Small Pond. Catch some trout and keep your bait stocked.",
    levelReq: "Fishing 8",
    status: "active",
    pinned: false,
    requirements: [
      { item: "Trout", amount: 30 },
      { item: "Worms", amount: 50 }
    ],
    rewards: [
      { type: "silver", label: "Silver", amount: 2800 },
      { type: "item", label: "Fishing Net", amount: 5 },
      { type: "xp", label: "Fishing XP", amount: 950 }
    ]
  },
  {
    id: "quest-6",
    title: "A Way Out I",
    npc: "Cecil",
    description: "Cecil is planning an expedition to the outer woods. We need sturdy wooden boards and ropes.",
    levelReq: "Exploring 15",
    status: "active",
    pinned: false,
    requirements: [
      { item: "Board", amount: 100 },
      { item: "Rope", amount: 25 },
      { item: "Leather", amount: 15 }
    ],
    rewards: [
      { type: "silver", label: "Silver", amount: 7500 },
      { type: "gold", label: "Gold", amount: 10 },
      { type: "item", label: "Ancient Coin", amount: 1 }
    ]
  },
  {
    id: "quest-7",
    title: "Holger's Timber Troubles",
    npc: "Holger",
    description: "The sawmill is backed up! Bring raw wood and stone blocks so Holger can repair the water wheel.",
    levelReq: "Exploring 5",
    status: "completed",
    pinned: false,
    requirements: [
      { item: "Wood", amount: 50 },
      { item: "Stone", amount: 30 }
    ],
    rewards: [
      { type: "silver", label: "Silver", amount: 1500 },
      { type: "item", label: "Board", amount: 20 }
    ]
  },
  {
    id: "quest-8",
    title: "Borgen's Peculiar Trade",
    npc: "Borgen",
    description: "Borgen has arrived at camp with mysterious wares. He is interested in rare aquatic finds.",
    levelReq: "Fishing 20",
    status: "active",
    pinned: false,
    requirements: [
      { item: "Large Clam", amount: 10 },
      { item: "Sea Glass", amount: 5 }
    ],
    rewards: [
      { type: "silver", label: "Silver", amount: 12000 },
      { type: "gold", label: "Gold", amount: 15 },
      { type: "item", label: "Borgen Buck", amount: 2 }
    ]
  }
];

// Suggested NPC list for quest giver dropdowns
export const NPC_LIST = [
  "Buddy",
  "Beatrix",
  "Vincent",
  "Rosalie",
  "Jill",
  "Cecil",
  "Holger",
  "Borgen",
  "Thomas",
  "Ric",
  "Lorn",
  "Starla",
  "Marten",
  "Captain Bruce"
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

export function getItemIcon(itemName) {
  if (!itemName) return "📦";
  const trimmed = itemName.trim();
  return ITEM_ICONS[trimmed] || ITEM_ICONS.default;
}

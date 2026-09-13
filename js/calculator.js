import { getItemIcon } from "./quests-data.js";

/**
 * Checks if all requirements of a single quest are fulfilled by current inventory.
 */
export function isQuestReady(quest, inventory = {}) {
  if (!quest.requirements || quest.requirements.length === 0) return true;
  return quest.requirements.every(req => {
    const have = inventory[req.item] || 0;
    return have >= req.amount;
  });
}

/**
 * Calculate completion status of each requirement for a quest
 */
export function getQuestRequirementsStatus(quest, inventory = {}) {
  return (quest.requirements || []).map(req => {
    const have = inventory[req.item] || 0;
    const needed = req.amount;
    const fulfilled = have >= needed;
    const percent = Math.min(100, Math.round((have / needed) * 100));
    return {
      item: req.item,
      amount: needed,
      have,
      fulfilled,
      percent,
      icon: getItemIcon(req.item)
    };
  });
}

/**
 * Aggregates all material requirements across the given list of quests.
 */
export function aggregateMaterials(quests, inventory = {}) {
  const itemMap = new Map();

  for (const quest of quests) {
    if (!quest.requirements) continue;
    for (const req of quest.requirements) {
      if (!req.item || !req.amount) continue;
      const itemName = req.item.trim();
      const amount = parseInt(req.amount, 10) || 0;
      if (amount <= 0) continue;

      if (!itemMap.has(itemName)) {
        itemMap.set(itemName, {
          item: itemName,
          icon: getItemIcon(itemName),
          totalRequired: 0,
          inBag: inventory[itemName] || 0,
          questSources: []
        });
      }

      const entry = itemMap.get(itemName);
      entry.totalRequired += amount;
      entry.questSources.push({
        questId: quest.id,
        questTitle: quest.title,
        npc: quest.npc,
        amount
      });
    }
  }

  // Calculate shortages and completion percentages
  const results = Array.from(itemMap.values()).map(entry => {
    const inBag = inventory[entry.item] || 0;
    const shortage = Math.max(0, entry.totalRequired - inBag);
    const percent = entry.totalRequired > 0 
      ? Math.min(100, Math.round((inBag / entry.totalRequired) * 100))
      : 100;

    return {
      ...entry,
      inBag,
      shortage,
      percent,
      isFulfilled: shortage === 0
    };
  });

  // Sort: unfulfilled items first (lowest completion % first), then alphabetical
  results.sort((a, b) => {
    if (a.isFulfilled !== b.isFulfilled) {
      return a.isFulfilled ? 1 : -1;
    }
    if (a.percent !== b.percent) {
      return a.percent - b.percent;
    }
    return a.item.localeCompare(b.item);
  });

  return results;
}

/**
 * Aggregates all rewards across a given list of quests.
 */
export function aggregateRewards(quests) {
  const summary = {
    silver: 0,
    gold: 0,
    items: {}
  };

  for (const quest of quests) {
    if (!quest.rewards) continue;
    for (const rew of quest.rewards) {
      const type = (rew.type || "").toLowerCase();
      const amount = parseInt(rew.amount, 10) || 0;
      const itemName = (rew.item || rew.label || "").trim();

      if (type === "silver" || itemName.toLowerCase() === "silver") {
        summary.silver += amount;
      } else if (type === "gold" || itemName.toLowerCase() === "gold") {
        summary.gold += amount;
      } else if (type === "item" || (type !== "xp" && itemName)) {
        if (itemName) {
          summary.items[itemName] = (summary.items[itemName] || 0) + amount;
        }
      }
    }
  }

  return summary;
}

/**
 * Formats material list into a clean text for copying to clipboard.
 */
export function formatMaterialsAsText(materials, title = "Farm RPG Material Checklist") {
  const dateStr = new Date().toLocaleDateString();
  let text = `📋 ${title} (${dateStr})\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  const unfulfilled = materials.filter(m => !m.isFulfilled);
  const fulfilled = materials.filter(m => m.isFulfilled);

  if (unfulfilled.length > 0) {
    text += `⏳ Still Needed:\n`;
    for (const m of unfulfilled) {
      text += ` [ ] ${m.item}: need ${m.shortage.toLocaleString()} more (${m.inBag.toLocaleString()}/${m.totalRequired.toLocaleString()})\n`;
    }
  }

  if (fulfilled.length > 0) {
    text += `\n✅ Ready in Bag:\n`;
    for (const m of fulfilled) {
      text += ` [x] ${m.item}: ${m.inBag.toLocaleString()}/${m.totalRequired.toLocaleString()}\n`;
    }
  }

  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Generated with Farm RPG Quest & Material Tracker`;
  return text;
}

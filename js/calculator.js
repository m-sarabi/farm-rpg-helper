import { getItemIcon } from "./quests-data.js";

/**
 * Returns clean list of requirements for a quest.
 */
export function getQuestRequirementsStatus(quest) {
  return (quest.requirements || []).map(req => {
    const amount = parseInt(req.amount, 10) || 0;
    return {
      item: req.item,
      amount,
      icon: getItemIcon(req.item)
    };
  });
}

/**
 * Aggregates all material requirements across the given list of quests,
 * evaluating against the player's inventory cap.
 */
export function aggregateMaterials(quests, inventoryCap = 1000) {
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

  const cap = parseInt(inventoryCap, 10) || 0;

  // Calculate over-cap status
  const results = Array.from(itemMap.values()).map(entry => {
    const exceedsCap = cap > 0 && entry.totalRequired > cap;
    const overBy = exceedsCap ? entry.totalRequired - cap : 0;

    return {
      ...entry,
      exceedsCap,
      overBy
    };
  });

  // Sort: items exceeding cap first, then highest quantity required, then alphabetical
  results.sort((a, b) => {
    if (a.exceedsCap !== b.exceedsCap) {
      return a.exceedsCap ? -1 : 1;
    }
    if (b.totalRequired !== a.totalRequired) {
      return b.totalRequired - a.totalRequired;
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
export function formatMaterialsAsText(materials, title = "Farm RPG Material Checklist", inventoryCap = 1000) {
  const dateStr = new Date().toLocaleDateString();
  const cap = parseInt(inventoryCap, 10) || 0;

  let text = `📋 ${title} (${dateStr})\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  if (cap > 0) {
    text += `🎒 Inventory Cap: ${cap.toLocaleString()}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  }

  for (const m of materials) {
    const capWarn = m.exceedsCap
      ? ` (⚠️ Exceeds cap of ${cap.toLocaleString()} by ${m.overBy.toLocaleString()})`
      : "";
    text += ` [ ] ${m.item}: ${m.totalRequired.toLocaleString()} required${capWarn}\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Generated with Farm RPG Quest & Material Tracker`;
  return text;
}

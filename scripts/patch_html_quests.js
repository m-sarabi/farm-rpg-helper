#!/usr/bin/env node
/**
 * scripts/patch_html_quests.js
 * Fetches authentic data for quests affected by HTML tags from buddy.farm
 * and updates data/quests.json and js/quests-catalog.js.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const JS_DIR = path.join(ROOT_DIR, 'js');

export function sanitizeQuestTitle(title) {
  if (!title) return '';
  return String(title)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'FarmRPG-Helper-Bot/1.0 (+https://github.com/m-sarabi/farm-rpg-helper)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  const questsJsonPath = path.join(DATA_DIR, 'quests.json');
  const rawQuests = JSON.parse(await fsp.readFile(questsJsonPath, 'utf-8'));
  console.log(`Loaded ${rawQuests.length} quests from ${questsJsonPath}`);

  console.log('Fetching buddy.farm search index...');
  const searchData = await fetchJson('https://buddy.farm/search.json');
  const pathMap = new Map();
  for (const entry of searchData) {
    if (entry.name && entry.href && entry.href.startsWith('/q/')) {
      pathMap.set(entry.name.toLowerCase().trim(), entry.href);
      pathMap.set(sanitizeQuestTitle(entry.name).toLowerCase(), entry.href);
    }
  }

  const htmlQuests = rawQuests.filter(q => /<[^>]+>/.test(q.title));
  console.log(`Found ${htmlQuests.length} quests with HTML tags in title. Fetching details...`);

  let patchedCount = 0;
  for (const q of htmlQuests) {
    const rawKey = q.title.toLowerCase().trim();
    const cleanTitle = sanitizeQuestTitle(q.title);
    const cleanKey = cleanTitle.toLowerCase();
    const href = pathMap.get(cleanKey) || pathMap.get(rawKey);

    if (!href) {
      console.warn(`Could not find search href for quest: "${q.title}" (id: ${q.id})`);
      continue;
    }

    const pageDataUrl = `https://buddy.farm/page-data${href.startsWith('/') ? href : `/${href}`}page-data.json`;
    try {
      const pageData = await fetchJson(pageDataUrl);
      const questObj = pageData?.result?.data?.farmrpg?.quests?.[0];
      if (!questObj) {
        console.warn(`No quest object returned for ${pageDataUrl}`);
        continue;
      }

      const reqItems = [];
      if (Array.isArray(questObj.requiredItems)) {
        for (const itemObj of questObj.requiredItems) {
          const itemName = (itemObj.item?.name || itemObj.name || '').trim();
          const quantity = parseInt(itemObj.quantity, 10) || 0;
          if (itemName && quantity > 0) {
            reqItems.push({ item: itemName, amount: quantity });
          }
        }
      }
      const reqSilver = parseInt(questObj.requiredSilver, 10) || 0;
      if (reqSilver > 0) {
        reqItems.push({ item: 'Silver', amount: reqSilver });
      }

      const rewards = [];
      const rewSilver = parseInt(questObj.rewardSilver, 10) || 0;
      if (rewSilver > 0) {
        rewards.push({ type: 'silver', amount: rewSilver, label: 'Silver' });
      }
      const rewGold = parseInt(questObj.rewardGold, 10) || 0;
      if (rewGold > 0) {
        rewards.push({ type: 'gold', amount: rewGold, label: 'Gold' });
      }
      if (Array.isArray(questObj.rewardItems)) {
        for (const itemObj of questObj.rewardItems) {
          const itemName = (itemObj.item?.name || itemObj.name || '').trim();
          const quantity = parseInt(itemObj.quantity, 10) || 0;
          if (itemName && quantity > 0) {
            rewards.push({ type: 'item', item: itemName, label: itemName, amount: quantity });
          }
        }
      }

      q.title = cleanTitle;
      q.requirements = reqItems;
      q.rewards = rewards;
      if (questObj.pred) {
        q.prevQuestId = questObj.pred.id;
        q.prevQuestTitle = sanitizeQuestTitle(questObj.pred.name);
      }

      patchedCount++;
      console.log(`✓ Patched (${q.id}) "${cleanTitle}": ${reqItems.length} reqs, ${rewards.length} rews, pred: ${q.prevQuestId} (${q.prevQuestTitle})`);
    } catch (err) {
      console.error(`Failed to patch quest (${q.id}) "${q.title}":`, err.message);
    }
  }

  // Also clean any lingering HTML tags in titles or prevQuestTitle across all quests
  for (const q of rawQuests) {
    q.title = sanitizeQuestTitle(q.title);
    if (q.prevQuestTitle) {
      q.prevQuestTitle = sanitizeQuestTitle(q.prevQuestTitle);
    }
  }

  console.log(`Patched ${patchedCount} quests.`);

  // Write updated data/quests.json
  await fsp.writeFile(questsJsonPath, JSON.stringify(rawQuests, null, 2), 'utf-8');
  console.log(`Saved updated ${questsJsonPath}`);

  // Re-build js/quests-catalog.js
  const lookup = {};
  for (const q of rawQuests) {
    const entry = {
      id: q.id,
      requirements: q.requirements,
      rewards: q.rewards,
      questline: q.questline,
      stepNumber: q.stepNumber,
      totalSteps: q.totalSteps,
      prevQuestId: q.prevQuestId,
      prevQuestTitle: q.prevQuestTitle
    };
    lookup[q.title.toLowerCase().trim()] = entry;
    lookup[`id_${q.id}`] = entry;
  }

  const catalogJsPath = path.join(JS_DIR, 'quests-catalog.js');
  const catalogContent = `// AUTO-GENERATED by scripts/download_all_quests.js
// Total quests: ${rawQuests.length}
// Source: buddy.farm

export const QUESTS_CATALOG = ${JSON.stringify(lookup)};

export function sanitizeQuestTitle(title) {
  if (!title) return '';
  return String(title)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

export function getQuestCatalogEntry(questNameOrId) {
  if (questNameOrId === null || questNameOrId === undefined) return null;
  if (typeof questNameOrId === 'number' || /^\\d+$/.test(String(questNameOrId).trim())) {
    const idKey = \`id_\${String(questNameOrId).trim()}\`;
    if (QUESTS_CATALOG[idKey]) return QUESTS_CATALOG[idKey];
  }
  const raw = String(questNameOrId).toLowerCase().trim();
  const clean = sanitizeQuestTitle(questNameOrId).toLowerCase();
  return QUESTS_CATALOG[clean] || QUESTS_CATALOG[raw] || null;
}
`;
  await fsp.writeFile(catalogJsPath, catalogContent, 'utf-8');
  console.log(`Saved updated catalog module to ${catalogJsPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

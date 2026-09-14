#!/usr/bin/env node
/**
 * scripts/download_all_quests.js
 * --------------------------------
 * Downloads all quests and questlines from buddy.farm, compiles complete
 * item requirements, rewards, prerequisites, and sequential step ordering,
 * and saves them into data/quests.json and js/quests-catalog.js.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const JS_DIR = path.join(ROOT_DIR, 'js');

const SEARCH_JSON_URL = 'https://buddy.farm/search.json';
const QUESTS_JSON_URL = 'https://buddy.farm/page-data/quests/page-data.json';
const BASE_QL_URL = 'https://buddy.farm/page-data/ql';
const BASE_Q_URL = 'https://buddy.farm/page-data/q';
const USER_AGENT = 'FarmRPG-Helper-Bot/1.0 (+https://github.com/m-sarabi/farm-rpg-helper)';

function slugify(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const romanValues = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
function parseRoman(str) {
  const s = (str || '').toLowerCase().trim();
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
  const qName = (questName || '').trim();
  const qlTitle = (questlineTitle || '').trim();

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

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  console.log(`1. Fetching master quests endpoint: ${QUESTS_JSON_URL}...`);
  const masterData = await fetchJson(QUESTS_JSON_URL);
  const rawQuests = masterData?.result?.data?.farmrpg?.quests || [];
  const rawQuestlines = masterData?.result?.data?.farmrpg?.questlines || [];

  console.log(`Found ${rawQuests.length} quests and ${rawQuestlines.length} questlines.`);

  // Map to store item requirements, rewards, and authentic predecessor keyed by quest name
  const questDetailsMap = new Map();

  // 2. Fetch all questlines in parallel batches to extract items, rewards, and official steps
  console.log(`2. Fetching ${rawQuestlines.length} questlines to collect item requirements & rewards...`);
  const concurrency = 30;
  let fetchedCount = 0;
  let failedCount = 0;

  const qlQueue = [...rawQuestlines];
  async function qlWorker() {
    while (qlQueue.length > 0) {
      const ql = qlQueue.shift();
      const slug = slugify(ql.title);
      try {
        const qlData = await fetchJson(`${BASE_QL_URL}/${slug}/page-data.json`);
        const qlObj = qlData?.result?.data?.farmrpg?.questlines?.[0];
        if (qlObj?.steps && Array.isArray(qlObj.steps)) {
          for (const step of qlObj.steps) {
            const quest = step.quest;
            if (quest && quest.name) {
              const reqItems = [];
              if (Array.isArray(quest.requiredItems)) {
                for (const itemObj of quest.requiredItems) {
                  const itemName = (itemObj.item?.name || itemObj.name || '').trim();
                  const quantity = parseInt(itemObj.quantity, 10) || 0;
                  if (itemName && quantity > 0) {
                    reqItems.push({ item: itemName, amount: quantity });
                  }
                }
              }
              const reqSilver = parseInt(quest.requiredSilver, 10) || 0;
              if (reqSilver > 0) {
                reqItems.push({ item: 'Silver', amount: reqSilver });
              }

              const rewards = [];
              const rewSilver = parseInt(quest.rewardSilver, 10) || 0;
              if (rewSilver > 0) {
                rewards.push({ type: 'silver', amount: rewSilver, label: 'Silver' });
              }
              const rewGold = parseInt(quest.rewardGold, 10) || 0;
              if (rewGold > 0) {
                rewards.push({ type: 'gold', amount: rewGold, label: 'Gold' });
              }
              if (Array.isArray(quest.rewardItems)) {
                for (const itemObj of quest.rewardItems) {
                  const itemName = (itemObj.item?.name || itemObj.name || '').trim();
                  const quantity = parseInt(itemObj.quantity, 10) || 0;
                  if (itemName && quantity > 0) {
                    rewards.push({ type: 'item', item: itemName, label: itemName, amount: quantity });
                  }
                }
              }

              questDetailsMap.set(quest.name.toLowerCase().trim(), {
                order: step.order,
                requirements: reqItems,
                rewards,
                pred: null
              });
            }
          }
        }
        fetchedCount++;
      } catch (err) {
        failedCount++;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => qlWorker()));
  console.log(`Finished questlines: ${fetchedCount} fetched, ${failedCount} failed.`);
  console.log(`Collected requirements for ${questDetailsMap.size} quests via questlines.`);

  // 3. Fetch search.json to get canonical paths for all quests, then fetch individual quest pages
  // to extract authentic predecessors ('pred') and any standalone requirements/rewards.
  console.log(`3. Fetching search catalog from ${SEARCH_JSON_URL} to map quest paths...`);
  let questPathMap = new Map();
  try {
    const searchData = await fetchJson(SEARCH_JSON_URL);
    if (Array.isArray(searchData)) {
      for (const entry of searchData) {
        if (entry.name && entry.href && entry.href.startsWith('/q/')) {
          questPathMap.set(entry.name.toLowerCase().trim(), entry.href);
        }
      }
    }
  } catch (err) {
    console.warn(`Could not fetch search.json, will use slugify fallback:`, err.message);
  }

  console.log(`3b. Fetching authentic predecessor (pred) details for ${rawQuests.length} quests...`);
  let detailFetched = 0;
  let detailFailed = 0;
  const questDetailQueue = [...rawQuests];

  async function questDetailWorker() {
    while (questDetailQueue.length > 0) {
      const q = questDetailQueue.shift();
      const key = q.name.toLowerCase().trim();
      const href = questPathMap.get(key) || `/q/${slugify(q.name)}/`;
      const pageDataUrl = `https://buddy.farm/page-data${href.startsWith('/') ? href : `/${href}`}page-data.json`;

      try {
        const qData = await fetchJson(pageDataUrl);
        const questObj = qData?.result?.data?.farmrpg?.quests?.[0];
        if (questObj) {
          const existing = questDetailsMap.get(key) || { order: 0, requirements: [], rewards: [] };

          let reqItems = existing.requirements;
          if (!reqItems || reqItems.length === 0) {
            reqItems = [];
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
          }

          let rewards = existing.rewards;
          if (!rewards || rewards.length === 0) {
            rewards = [];
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
          }

          const pred = questObj.pred ? {
            id: questObj.pred.id,
            title: questObj.pred.name ? questObj.pred.name.trim() : null
          } : null;

          questDetailsMap.set(key, {
            ...existing,
            requirements: reqItems,
            rewards,
            pred
          });
          detailFetched++;
        }
      } catch (err) {
        detailFailed++;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => questDetailWorker()));
  console.log(`Fetched details for ${detailFetched} quests (${detailFailed} failed or skipped).`);

  // 4. Group quests by questline to establish sequential step numbers and prevQuestId
  const qlGroups = new Map();
  for (const q of rawQuests) {
    const qlTitle = q.questlines?.[0]?.questline?.title || null;
    if (qlTitle) {
      if (!qlGroups.has(qlTitle)) qlGroups.set(qlTitle, []);
      qlGroups.get(qlTitle).push(q);
    }
  }

  // Sort each questline group by step number / official order
  const questStepMap = new Map(); // questId -> { questlineTitle, stepNumber, totalSteps, prevQuestId, prevQuestTitle }
  for (const [title, group] of qlGroups.entries()) {
    group.sort((a, b) => {
      const detailsA = questDetailsMap.get(a.name.toLowerCase().trim());
      const detailsB = questDetailsMap.get(b.name.toLowerCase().trim());
      if (detailsA?.order !== undefined && detailsB?.order !== undefined) {
        return detailsA.order - detailsB.order;
      }
      return parseStepNumber(a.name, title) - parseStepNumber(b.name, title);
    });

    for (let i = 0; i < group.length; i++) {
      const current = group[i];
      const prev = i > 0 ? group[i - 1] : null;
      const key = current.name.toLowerCase().trim();
      const details = questDetailsMap.get(key);
      const pred = details?.pred;

      questStepMap.set(current.id, {
        questlineTitle: title,
        stepNumber: i + 1,
        totalSteps: group.length,
        prevQuestId: pred ? pred.id : (prev ? prev.id : null),
        prevQuestTitle: pred ? pred.title : (prev ? prev.name : null)
      });
    }
  }

  // 5. Compile all quests into final standardized models
  const compiledQuests = rawQuests.map(q => {
    const key = q.name.toLowerCase().trim();
    const details = questDetailsMap.get(key) || { requirements: [], rewards: [], pred: null };
    const stepInfo = questStepMap.get(q.id) || {
      questlineTitle: q.questlines?.[0]?.questline?.title || null,
      stepNumber: 1,
      totalSteps: 1,
      prevQuestId: null,
      prevQuestTitle: null
    };

    const finalPrevId = details.pred ? details.pred.id : stepInfo.prevQuestId;
    const finalPrevTitle = details.pred ? details.pred.title : stepInfo.prevQuestTitle;

    const skills = {
      farming: q.requiredFarmingLevel || 0,
      fishing: q.requiredFishingLevel || 0,
      crafting: q.requiredCraftingLevel || 0,
      exploring: q.requiredExploringLevel || 0,
      cooking: q.requiredCookingLevel || 0,
      mining: 0
    };

    const skillTextParts = [];
    const skillLabels = { farming: 'Farming', fishing: 'Fishing', crafting: 'Crafting', exploring: 'Exploring', cooking: 'Cooking', mining: 'Mining' };
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
      npc: (q.npc || 'Buddy').trim(),
      description: (q.cleanDescription || '').trim(),
      image: q.image || '',
      skills,
      towerLevel: q.requiredTowerLevel || 0,
      requiredNpc: q.requiredNpc ? (q.requiredNpc.name || q.requiredNpc) : null,
      requiredNpcLevel: q.requiredNpcLevel || 0,
      levelReq: skillTextParts.join(', '),
      questline: stepInfo.questlineTitle,
      stepNumber: stepInfo.stepNumber,
      totalSteps: stepInfo.totalSteps,
      prevQuestId: finalPrevId,
      prevQuestTitle: finalPrevTitle,
      requirements: details.requirements || [],
      rewards: details.rewards || [],
      startDate: q.startDate || null,
      endDate: q.endDate || null,
      status: 'active',
      pinned: false
    };
  });

  // 6. Save data/quests.json
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(JS_DIR, { recursive: true });

  const questsJsonPath = path.join(DATA_DIR, 'quests.json');
  await fsp.writeFile(questsJsonPath, JSON.stringify(compiledQuests, null, 2), 'utf-8');
  console.log(`Saved ${compiledQuests.length} quests to: ${questsJsonPath}`);

  // 7. Save js/quests-catalog.js (lookup map for requirements/rewards and questlines)
  const lookup = {};
  for (const q of compiledQuests) {
    lookup[q.title.toLowerCase().trim()] = {
      id: q.id,
      requirements: q.requirements,
      rewards: q.rewards,
      questline: q.questline,
      stepNumber: q.stepNumber,
      totalSteps: q.totalSteps,
      prevQuestId: q.prevQuestId,
      prevQuestTitle: q.prevQuestTitle
    };
  }

  const catalogJsPath = path.join(JS_DIR, 'quests-catalog.js');
  const catalogContent = `// AUTO-GENERATED by scripts/download_all_quests.js
// Total quests: ${compiledQuests.length}
// Source: buddy.farm

export const QUESTS_CATALOG = ${JSON.stringify(lookup)};

export function getQuestCatalogEntry(questName) {
  if (!questName) return null;
  return QUESTS_CATALOG[questName.toLowerCase().trim()] || null;
}
`;
  await fsp.writeFile(catalogJsPath, catalogContent, 'utf-8');
  console.log(`Saved catalog module to: ${catalogJsPath}`);
  console.log('Done!');
}

if (process.argv[1] && process.argv[1].endsWith('download_all_quests.js')) {
  main().catch(err => {
    console.error('Fatal error downloading quests:', err);
    process.exit(1);
  });
}

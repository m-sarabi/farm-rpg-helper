import assert from "node:assert";
import fsp from "node:fs/promises";
import { parseStepNumber } from "../scripts/download_all_quests.js";
import { getQuestCatalogEntry } from "../js/quests-catalog.js";

// Mock localStorage for node environment
const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};
global.window = {
  matchMedia: () => ({ matches: false })
};
global.document = {
  documentElement: {
    setAttribute: () => {}
  }
};

async function runTests() {
  console.log("==========================================");
  console.log("FARM RPG QUEST SYSTEM OVERHAUL TESTS");
  console.log("==========================================");

  // Load catalog
  console.log("\n--- Test 1: Quests Catalog & Step Ordering ---");
  const hh1 = getQuestCatalogEntry("Hungry Holger I");
  const hh2 = getQuestCatalogEntry("Hungry Holger II");
  const hh3 = getQuestCatalogEntry("Hungry Holger III");

  assert.ok(hh1, "Hungry Holger I should exist in catalog");
  assert.ok(hh2, "Hungry Holger II should exist in catalog");
  assert.ok(hh3, "Hungry Holger III should exist in catalog");

  assert.strictEqual(hh1.stepNumber, 1, "Hungry Holger I is step 1");
  assert.strictEqual(hh2.stepNumber, 2, "Hungry Holger II is step 2");
  assert.strictEqual(hh3.stepNumber, 3, "Hungry Holger III is step 3");
  assert.strictEqual(hh2.prevQuestTitle, "Hungry Holger I", "Hungry Holger II predecessor is Hungry Holger I");
  assert.strictEqual(hh3.prevQuestTitle, "Hungry Holger II", "Hungry Holger III predecessor is Hungry Holger II");
  console.log("✓ Step ordering and predecessor linking verified!");

  console.log("\n--- Test 2: Material Requirements & Rewards in Catalog ---");
  assert.ok(hh1.requirements.length > 0, "Hungry Holger I should have requirements");
  assert.strictEqual(hh1.requirements[0].item, "Peas");
  assert.strictEqual(hh1.requirements[0].amount, 100);
  assert.ok(hh1.rewards.length > 0, "Hungry Holger I should have rewards");
  assert.strictEqual(hh1.rewards[0].type, "silver");
  assert.strictEqual(hh1.rewards[0].amount, 3500);
  console.log("✓ Requirements and rewards verified!");

  console.log("\n--- Test 3: Roman Numeral & Title Parsing ---");
  assert.strictEqual(parseStepNumber("Bling Things", "Bling Things"), 1);
  assert.strictEqual(parseStepNumber("Bling Things II", "Bling Things"), 2);
  assert.strictEqual(parseStepNumber("A Study of Color XVI", "A Study of Color"), 16);
  assert.strictEqual(parseStepNumber("Parts Unknown XXIV", "Parts Unknown"), 24);
  console.log("✓ Roman numeral & step parser verified!");

  console.log("\n--- Test 4: Dynamic Quest Availability & Level Thresholds ---");
  const { state } = await import("../js/state.js");

  // Load data/quests.json
  const rawData = JSON.parse(await fsp.readFile("data/quests.json", "utf-8"));
  state.importBuddyFarmQuests(rawData);

  // Initially: player levels are all 0 (locked)
  state.setPlayerLevels({
    farming: 0,
    fishing: 0,
    crafting: 0,
    exploring: 0,
    cooking: 0,
    mining: 0,
    tower: 0,
    friendship: 0
  });

  const questHH1 = state.quests.find(q => q.title === "Hungry Holger I"); // requires Farming 4
  const questHH2 = state.quests.find(q => q.title === "Hungry Holger II"); // requires Fishing 5 and HH I
  assert.ok(questHH1, "Hungry Holger I must exist in state");
  assert.ok(questHH2, "Hungry Holger II must exist in state");

  // HH1 requires Farming 4. Player has Farming 0 (locked).
  assert.strictEqual(state.isQuestAvailable(questHH1), false, "HH1 should be locked when Farming is 0");
  const lockReasons1 = state.getQuestLockReasons(questHH1);
  assert.ok(lockReasons1.some(r => r.includes("Farming 4 required")), "Lock reason must mention Farming 4");

  // Player sets Farming to 3 (below 4)
  state.setPlayerLevels({ farming: 3 });
  assert.strictEqual(state.isQuestAvailable(questHH1), false, "HH1 should be locked when Farming 3 < 4");

  // Player sets Farming to 4 (meets requirement)
  state.setPlayerLevels({ farming: 4 });
  assert.strictEqual(state.isQuestAvailable(questHH1), true, "HH1 should become available when Farming 4 >= 4");
  console.log("✓ Skill level threshold (0 = locked, >= required unlocks) verified!");

  console.log("\n--- Test 5: Sequential Questline Unlocking ---");
  // Player sets Fishing to 10 (meets HH2's fishing requirement)
  state.setPlayerLevels({ farming: 4, fishing: 10 });

  // Even though player has Fishing 10, HH2 is NOT available because HH1 is NOT completed!
  assert.strictEqual(state.isQuestAvailable(questHH2), false, "HH2 must remain locked until HH1 is completed");
  const lockReasons2 = state.getQuestLockReasons(questHH2);
  assert.ok(lockReasons2.some(r => r.includes('Complete "Hungry Holger I" first')), "Lock reason must state HH1 is needed");

  // Player marks HH1 as completed!
  state.toggleQuestStatus(questHH1.id);
  assert.strictEqual(state.isQuestCompleted(questHH1), true, "HH1 should be completed");
  assert.strictEqual(state.isQuestAvailable(questHH1), false, "Completed quest should not be in available pool");

  // Now HH2 has its predecessor completed AND player has Fishing 10!
  assert.strictEqual(state.isQuestAvailable(questHH2), true, "HH2 must dynamically become available after HH1 is completed!");

  // Now player reopens HH1 (uncompletes it)
  state.toggleQuestStatus(questHH1.id);
  assert.strictEqual(state.isQuestCompleted(questHH1), false, "HH1 should be active/reopened");
  assert.strictEqual(state.isQuestAvailable(questHH2), false, "HH2 must dynamically re-lock when HH1 is reopened!");
  console.log("✓ Dynamic sequential questline unlocking & relocking verified!");

  console.log("\n--- Test 6: Tower & Individual NPC Friendship Level Thresholds ---");
  // 1. Tower requirement test
  const towerQuest = state.quests.find(q => q.towerLevel > 0);
  if (towerQuest) {
    state.setPlayerLevels({ tower: 0 });
    assert.strictEqual(state.isQuestAvailable(towerQuest), false, "Tower quest should be locked when tower is 0");
    state.setPlayerLevels({ tower: towerQuest.towerLevel });
    if (state.getQuestLockReasons(towerQuest).length === 0) {
      assert.strictEqual(state.isQuestAvailable(towerQuest), true, "Tower quest unlocked when requirements met");
    }
  }

  // 2. Individual NPC friendship test with "Friends With Charles I" (requires Charles Horsington III Friendship 15)
  const charlesQuest = state.quests.find(q => q.title === "Friends With Charles I");
  assert.ok(charlesQuest, "Friends With Charles I must exist");
  assert.strictEqual(charlesQuest.requiredNpc, "Charles Horsington III");
  assert.strictEqual(charlesQuest.requiredNpcLevel, 15);

  // Set Charles friendship to 0 (locked)
  state.setNpcFriendships({ "Charles Horsington III": 0 });
  assert.strictEqual(state.isQuestAvailable(charlesQuest), false, "Charles quest must be locked when Charles friendship is 0");
  const charlesReasons = state.getQuestLockReasons(charlesQuest);
  assert.ok(charlesReasons.some(r => r.includes("Charles Horsington III Friendship 15 required")), "Reason must mention Charles friendship");

  // Setting ANOTHER NPC's friendship to 99 must NOT unlock Charles's quest!
  state.setNpcFriendships({ "Buddy": 99 });
  assert.strictEqual(state.isQuestAvailable(charlesQuest), false, "Charles quest must remain locked when only Buddy's friendship is 99");

  // Setting Charles to 14 (below 15) must NOT unlock
  state.setNpcFriendships({ "Charles Horsington III": 14 });
  assert.strictEqual(state.isQuestAvailable(charlesQuest), false, "Charles quest must remain locked at level 14 < 15");

  // Setting Charles to 15 unlocks the quest!
  state.setNpcFriendships({ "Charles Horsington III": 15 });
  assert.strictEqual(state.isQuestAvailable(charlesQuest), true, "Charles quest unlocks at level 15 >= 15");

  // 3. Test Baba Gec / Baba Gex alias support with "Cabbages of Friendship" (requires Baba Gec Friendship 99)
  const babaQuest = state.quests.find(q => q.title === "Cabbages of Friendship");
  assert.ok(babaQuest, "Cabbages of Friendship must exist");
  state.setNpcFriendships({ "Baba Gec": 0 });
  assert.strictEqual(state.isQuestAvailable(babaQuest), false, "Baba quest locked at 0");

  // Unlocking via 'Baba Gex' alias
  state.setNpcFriendships({ "Baba Gex": 99 });
  assert.strictEqual(state.getNpcFriendship("Baba Gec"), 99, "getNpcFriendship('Baba Gec') matches 'Baba Gex' alias");
  assert.strictEqual(state.isQuestAvailable(babaQuest), true, "Baba quest unlocked via alias friendship 99");
  console.log("✓ Individual NPC friendship thresholds and alias matching verified!");

  console.log("\n--- Test 7: Preservation of Status During Re-Import ---");
  // Mark HH1 as completed and pinned
  state.toggleQuestStatus(questHH1.id);
  state.toggleQuestPin(questHH1.id);
  assert.strictEqual(state.isQuestCompleted(questHH1), true);
  assert.strictEqual(questHH1.pinned, true);

  // Re-import all quests from raw data
  state.importBuddyFarmQuests(rawData);

  const reloadedHH1 = state.quests.find(q => q.title === "Hungry Holger I");
  assert.strictEqual(reloadedHH1.status, "completed", "Completed status must be preserved across syncs");
  assert.strictEqual(reloadedHH1.pinned, true, "Pinned status must be preserved across syncs");
  console.log("✓ User status preservation during re-import verified!");

  console.log("\n--- Test 8: Separation of Event Quests from Normal Quests ---");
  const normalQuests = state.quests.filter(q => !state.isEventQuest(q));
  const eventQuests = state.quests.filter(q => state.isEventQuest(q));
  assert.strictEqual(eventQuests.length, 1313, "Must have exactly 1,313 event quests");
  assert.strictEqual(normalQuests.length, 1174, "Must have exactly 1,174 normal quests");
  assert.ok(eventQuests.every(q => q.startDate && q.endDate), "All event quests must have startDate and endDate");
  assert.ok(normalQuests.every(q => !q.startDate && !q.endDate), "Normal quests must not have dates");
  console.log("✓ Separation of 1,313 event quests and 1,174 normal quests verified!");

  console.log("\n--- Test 9: Event Timeline Status Calculation ---");
  const { getEventTimeline } = await import("../js/components.js");
  const refDate = new Date("2026-09-14T07:13:51+03:30");

  const boom1 = state.quests.find(q => q.title === "A Safer Big Boom I");
  assert.ok(boom1, "A Safer Big Boom I must exist");
  const tlBoom = getEventTimeline(boom1, refDate);
  assert.strictEqual(tlBoom.status, "active_now", "Boom 1 is active now in September 2026");
  assert.strictEqual(tlBoom.statusLabel, "Active Now");
  assert.ok(tlBoom.countdownText.includes("days left"), "Countdown text must indicate days left");

  const dogDays = state.quests.find(q => q.title === "Dog Days of Summer");
  assert.ok(dogDays, "Dog Days of Summer must exist");
  const tlDog = getEventTimeline(dogDays, refDate);
  assert.strictEqual(tlDog.status, "expired", "Dog Days of Summer expired in 2023");
  assert.strictEqual(tlDog.statusLabel, "Expired");
  assert.ok(tlDog.countdownText.includes("days ago") || tlDog.countdownText.includes("yesterday"));

  // Future test
  const futureTl = getEventTimeline(boom1, new Date("2026-08-15T00:00:00Z"));
  assert.strictEqual(futureTl.status, "upcoming", "Boom 1 was upcoming before Sep 1, 2026");
  assert.strictEqual(futureTl.statusLabel, "Upcoming");
  console.log("✓ Event timeline calculation (active_now, upcoming, expired) verified!");

  console.log("\n--- Test 10: Event Quest Missed Status Transitions ---");
  assert.strictEqual(dogDays.status, "active", "Dog Days should initially be active");
  assert.strictEqual(state.isQuestMissed(dogDays), false);

  // Mark as missed
  const missedResult = state.toggleQuestMissed(dogDays.id);
  assert.strictEqual(missedResult, "missed");
  assert.strictEqual(dogDays.status, "missed");
  assert.strictEqual(state.isQuestMissed(dogDays), true);
  assert.strictEqual(state.isQuestAvailable(dogDays), false, "Missed quest must not be available");
  assert.strictEqual(state.getQuestLockReasons(dogDays).length, 0, "Missed quest has 0 lock reasons");

  // Toggle back to active
  const reopenedResult = state.toggleQuestMissed(dogDays.id);
  assert.strictEqual(reopenedResult, "active");
  assert.strictEqual(dogDays.status, "active");
  assert.strictEqual(state.isQuestMissed(dogDays), false);

  // Directly set status
  state.setQuestStatus(dogDays.id, "missed");
  assert.strictEqual(dogDays.status, "missed");

  // Complete a missed quest
  state.toggleQuestStatus(dogDays.id);
  assert.strictEqual(dogDays.status, "completed");
  assert.strictEqual(state.isQuestCompleted(dogDays), true);
  console.log("✓ Missed status transitions and lifecycle verified!");

  console.log("\n--- Test 11: Bulk Mark Expired Events as Missed ---");
  // Reset dogDays to active
  state.setQuestStatus(dogDays.id, "active");
  const markedCount = state.markExpiredEventsAsMissed(refDate);
  assert.ok(markedCount > 1000, `Should mark >1000 expired events as missed (got ${markedCount})`);
  assert.strictEqual(dogDays.status, "missed", "Dog Days must be marked as missed");
  assert.strictEqual(boom1.status, "active", "Active now event (Boom 1) must remain active");
  console.log(`✓ Bulk mark expired events as missed verified (${markedCount} marked)!`);

  console.log("\n--- Test 12: Missed Status Preservation Across Re-Imports ---");
  state.importBuddyFarmQuests(rawData);
  const reloadedDogDays = state.quests.find(q => q.title === "Dog Days of Summer");
  assert.strictEqual(reloadedDogDays.status, "missed", "Missed status must be preserved across re-import");
  const reloadedBoom = state.quests.find(q => q.title === "A Safer Big Boom I");
  assert.strictEqual(reloadedBoom.status, "active", "Active status must be preserved across re-import");
  console.log("✓ Missed status preserved across data re-imports!");

  console.log("\n--- Test 13: Bowling for Goldie I requires Schoolhouse Rocks XI ---");
  const bfg1 = state.quests.find(q => q.title === "Bowling for Goldie I");
  const shr11 = state.quests.find(q => q.title === "Schoolhouse Rocks XI");
  assert.ok(bfg1, "Bowling for Goldie I must exist in state");
  assert.ok(shr11, "Schoolhouse Rocks XI must exist in state");
  assert.strictEqual(bfg1.prevQuestTitle, "Schoolhouse Rocks XI", "BFG I prevQuestTitle must be Schoolhouse Rocks XI");
  assert.strictEqual(bfg1.prevQuestId, shr11.id, "BFG I prevQuestId must match Schoolhouse Rocks XI ID");

  // Ensure player has all required skill levels for BFG I (Farming 26, Fishing 25, Crafting 15, Exploring 25)
  state.setPlayerLevels({
    farming: 99,
    fishing: 99,
    crafting: 99,
    exploring: 99,
    cooking: 99,
    mining: 99,
    tower: 99
  });

  // SHR XI is not completed yet
  state.setQuestStatus(shr11.id, "active");
  state.setQuestStatus(bfg1.id, "active");
  assert.strictEqual(state.isQuestAvailable(bfg1), false, "BFG I must be locked while Schoolhouse Rocks XI is not completed");
  const bfgReasons = state.getQuestLockReasons(bfg1);
  assert.ok(bfgReasons.some(r => r.includes('Complete "Schoolhouse Rocks XI" first')), "Lock reasons must require Schoolhouse Rocks XI");

  // Mark SHR XI as completed
  state.setQuestStatus(shr11.id, "completed");
  assert.strictEqual(state.isQuestAvailable(bfg1), true, "BFG I must become available once Schoolhouse Rocks XI is completed");

  // Reopen SHR XI
  state.setQuestStatus(shr11.id, "active");
  assert.strictEqual(state.isQuestAvailable(bfg1), false, "BFG I must re-lock if Schoolhouse Rocks XI is reopened");
  console.log("✓ Bowling for Goldie I prerequisite requirement verified!");

  console.log("\n--- Test 14: Dig In I requires Fun Underground Now IV ---");
  const dig1 = state.quests.find(q => q.title === "Dig In I");
  const fun4 = state.quests.find(q => q.title === "Fun Underground Now IV");
  assert.ok(dig1, "Dig In I must exist in state");
  assert.ok(fun4, "Fun Underground Now IV must exist in state");
  assert.strictEqual(dig1.prevQuestTitle, "Fun Underground Now IV", "Dig In I prevQuestTitle must be Fun Underground Now IV");
  assert.strictEqual(dig1.prevQuestId, fun4.id, "Dig In I prevQuestId must match Fun Underground Now IV ID");

  // FUN IV is not completed
  state.setQuestStatus(fun4.id, "active");
  state.setQuestStatus(dig1.id, "active");
  assert.strictEqual(state.isQuestAvailable(dig1), false, "Dig In I must be locked while Fun Underground Now IV is active");
  const digReasons = state.getQuestLockReasons(dig1);
  assert.ok(digReasons.some(r => r.includes('Complete "Fun Underground Now IV" first')), "Lock reasons must require Fun Underground Now IV");

  // Mark FUN IV completed
  state.setQuestStatus(fun4.id, "completed");
  assert.strictEqual(state.isQuestAvailable(dig1), true, "Dig In I must become available once Fun Underground Now IV is completed");

  // Reopen FUN IV
  state.setQuestStatus(fun4.id, "active");
  assert.strictEqual(state.isQuestAvailable(dig1), false, "Dig In I must re-lock if Fun Underground Now IV is reopened");
  console.log("✓ Dig In I prerequisite requirement verified!");

  console.log("\n--- Test 15: Automatic Predecessor Enrichment for Cached LocalStorage ---");
  // Simulate cached quest with missing prevQuestId/prevQuestTitle
  const cachedBFG = state.quests.find(q => q.title === "Bowling for Goldie I");
  cachedBFG.prevQuestId = null;
  cachedBFG.prevQuestTitle = null;
  cachedBFG.pinned = true;

  // Mock fetch for data/quests.json
  global.fetch = async (url) => {
    if (url.includes("quests.json")) {
      return {
        ok: true,
        json: async () => rawData
      };
    }
    return { ok: false, status: 404 };
  };

  await state.enrichQuestsFromCatalog();
  assert.strictEqual(cachedBFG.prevQuestTitle, "Schoolhouse Rocks XI", "Enrichment must restore Schoolhouse Rocks XI title");
  assert.strictEqual(cachedBFG.prevQuestId, shr11.id, "Enrichment must restore Schoolhouse Rocks XI id");
  assert.strictEqual(cachedBFG.pinned, true, "Pinned state must be preserved during enrichment");
  console.log("✓ Predecessor auto-enrichment for cached data verified!");

  console.log("\n--- Test 16: 'You Spin Me Right Round, Buddy, Right Round' Prerequisite & Data ---");
  const q249 = state.quests.find(q => q.id === 249);
  const q247 = state.quests.find(q => q.id === 247);
  assert.ok(q249, "Quest 249 must exist in state");
  assert.ok(q247, "Quest 247 ('A Horse Of A Different Color VII') must exist in state");

  // Verify clean title (no HTML break tags)
  assert.strictEqual(q249.title, "You Spin Me Right Round, Buddy, Right Round", "Quest 249 title must be clean of HTML");
  assert.strictEqual(q249.prevQuestId, 247, "Quest 249 prevQuestId must be 247");
  assert.strictEqual(q249.prevQuestTitle, "A Horse Of A Different Color VII", "Quest 249 prevQuestTitle must match Quest 247");

  // Verify material requirements and rewards
  assert.strictEqual(q249.requirements.length, 1, "Quest 249 must have 1 requirement");
  assert.strictEqual(q249.requirements[0].item, "Treasure Chest");
  assert.strictEqual(q249.requirements[0].amount, 1);
  assert.ok(q249.rewards.length >= 2, "Quest 249 must have at least 2 rewards");
  const silverReward = q249.rewards.find(r => r.type === "silver");
  const coinReward = q249.rewards.find(r => r.item === "Ancient Coin");
  assert.ok(silverReward && silverReward.amount === 500000, "Silver reward must be 500,000");
  assert.ok(coinReward && coinReward.amount === 25, "Ancient Coin reward must be 25");

  // Dynamic availability check
  state.setPlayerLevels({ crafting: 35, exploring: 35 });
  state.setQuestStatus(q247.id, "active");
  state.setQuestStatus(q249.id, "active");
  assert.strictEqual(state.isQuestAvailable(q249), false, "Quest 249 must NOT be available while Quest 247 is active");

  const lockReasons249 = state.getQuestLockReasons(q249);
  assert.ok(lockReasons249.some(r => r.includes("A Horse Of A Different Color VII")), "Lock reasons must mention prerequisite");

  // Complete Quest 247
  state.setQuestStatus(q247.id, "completed");
  assert.strictEqual(state.isQuestAvailable(q249), true, "Quest 249 must become available once Quest 247 is completed");

  // Reopen Quest 247
  state.setQuestStatus(q247.id, "active");
  assert.strictEqual(state.isQuestAvailable(q249), false, "Quest 249 must re-lock if Quest 247 is reopened");
  console.log("✓ 'You Spin Me Right Round, Buddy, Right Round' prerequisite & data verified!");

  console.log("\n--- Test 17: Automatic Recovery of Cached Quest with <br/> and Empty Data ---");
  // Simulate corrupt cached entry in user's localStorage
  const corruptCached249 = state.quests.find(q => q.id === 249);
  corruptCached249.title = "You Spin Me Right Round,<br/>Buddy, Right Round";
  corruptCached249.prevQuestId = null;
  corruptCached249.prevQuestTitle = null;
  corruptCached249.requirements = [];
  corruptCached249.rewards = [];
  corruptCached249.pinned = true;

  await state.enrichQuestsFromCatalog();
  assert.strictEqual(corruptCached249.title, "You Spin Me Right Round, Buddy, Right Round", "Enrichment must sanitize title");
  assert.strictEqual(corruptCached249.prevQuestId, 247, "Enrichment must restore prevQuestId 247");
  assert.strictEqual(corruptCached249.prevQuestTitle, "A Horse Of A Different Color VII", "Enrichment must restore prevQuestTitle");
  assert.strictEqual(corruptCached249.requirements.length, 1, "Enrichment must restore requirements");
  assert.strictEqual(corruptCached249.rewards.length, 2, "Enrichment must restore rewards");
  assert.strictEqual(corruptCached249.pinned, true, "Pinned status preserved");
  assert.strictEqual(state.isQuestAvailable(corruptCached249), false, "With restored prerequisite, quest must be locked");
  console.log("✓ Legacy cache recovery with HTML tags and empty data verified!");

  console.log("\n--- Test 18: Events Tab Default Timeline is active_now ---");
  assert.strictEqual(
    state.eventFilters.timeline,
    "active_now",
    "state.eventFilters.timeline must default to 'active_now' and not 'all'"
  );
  console.log("✓ Events default timeline is 'active_now' verified!");

  console.log("\n--- Test 19: Quest Indexing and Fast Lookups ---");
  assert.ok(state._questById instanceof Map, "state._questById must be a Map");
  assert.ok(state._questById.size > 2000, `Expected >2000 indexed quests, found ${state._questById.size}`);
  const q268 = state.getQuestById(268);
  assert.ok(q268, "Quest #268 should be looked up in O(1)");
  assert.strictEqual(q268.title, "Thank You!");

  state.setPlayerLevels({ farming: 99, fishing: 99, crafting: 99, exploring: 99, cooking: 99, mining: 99, tower: 99 });
  const avail = state.isQuestAvailable(q268);
  assert.ok(state._availabilityCache.has(q268.id), "Availability result should be cached");
  assert.strictEqual(state._availabilityCache.get(q268.id), avail);

  state.setPlayerLevels({ farming: 0 });
  assert.strictEqual(state._availabilityCache.size, 0, "Cache must invalidate on level update");
  console.log("✓ O(1) Map lookups and cache invalidation verified!");

  console.log("\n--- Test 20: Search Performance Benchmark ---");
  state.setPlayerLevels({ farming: 99, fishing: 99, crafting: 99, exploring: 99, cooking: 99, mining: 99, tower: 99 });
  const targetQuests = state.quests.filter(q => !state.isEventQuest(q));
  const t0 = performance.now();
  for (let i = 0; i < 10; i++) {
    const query = "corn";
    const matches = targetQuests.filter(q => {
      if (!state.isQuestAvailable(q)) return false;
      return q.title.toLowerCase().includes(query) ||
        (q.requirements || []).some(r => r.item.toLowerCase().includes(query));
    });
    assert.ok(matches.length > 0);
  }
  const duration = performance.now() - t0;
  console.log(`✓ 10 sequential searches executed in ${duration.toFixed(2)}ms (${(duration / 10).toFixed(2)}ms/search)`);
  assert.ok(duration < 200, `Search benchmark took ${duration.toFixed(2)}ms, expected < 200ms`);

  console.log("\n==========================================");
  console.log("ALL AUTOMATED TESTS PASSED! 🎉");
  console.log("==========================================");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

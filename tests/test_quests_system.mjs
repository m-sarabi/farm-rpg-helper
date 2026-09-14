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

  console.log("\n==========================================");
  console.log("ALL AUTOMATED TESTS PASSED! 🎉");
  console.log("==========================================");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

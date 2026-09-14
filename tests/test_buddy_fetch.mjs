import assert from "node:assert";
import { extractQuestSlug, parseBuddyQuestData, fetchBuddyFarmQuest } from "../js/buddy-fetch.js";

async function runTests() {
  console.log("--- Test 1: extractQuestSlug ---");
  const slugTests = [
    { input: "https://buddy.farm/q/not-from-around-here/", expected: "not-from-around-here" },
    { input: "https://buddy.farm/q/not-from-around-here", expected: "not-from-around-here" },
    { input: "https://buddy.farm/q/not-from-around-here?dark=true", expected: "not-from-around-here" },
    { input: "http://buddy.farm/q/not-from-around-here", expected: "not-from-around-here" },
    { input: "buddy.farm/q/not-from-around-here/", expected: "not-from-around-here" },
    { input: "/q/not-from-around-here/", expected: "not-from-around-here" },
    { input: "not-from-around-here", expected: "not-from-around-here" },
    { input: "Not From Around Here", expected: "not-from-around-here" },
    { input: "  https://buddy.farm/q/fake-fishing-i  ", expected: "fake-fishing-i" },
    { input: "", expected: "" },
    { input: null, expected: "" }
  ];

  for (const t of slugTests) {
    const actual = extractQuestSlug(t.input);
    assert.strictEqual(actual, t.expected, `Failed for input "${t.input}": expected "${t.expected}", got "${actual}"`);
  }
  console.log("✓ All extractQuestSlug tests passed!");

  console.log("\n--- Test 2: Live Fetch for Not From Around Here ---");
  const quest = await fetchBuddyFarmQuest("https://buddy.farm/q/not-from-around-here/");
  
  console.log("Fetched Quest Title:", quest.title);
  assert.strictEqual(quest.title, "Not From Around Here");

  console.log("Fetched NPC:", quest.npc);
  assert.strictEqual(quest.npc, "Mysterious Man");

  console.log("Fetched Skills:", quest.skills);
  assert.strictEqual(quest.skills.farming, 12);
  assert.strictEqual(quest.skills.fishing, 15);
  assert.strictEqual(quest.skills.crafting, 0);
  assert.strictEqual(quest.skills.exploring, 0);
  assert.strictEqual(quest.skills.cooking, 0);
  assert.strictEqual(quest.skills.mining, 0);
  assert.strictEqual(quest.levelReq, "Farming 12, Fishing 15");

  console.log("Fetched Requirements:", quest.requirements);
  assert.deepStrictEqual(quest.requirements, [
    { item: "Peas", amount: 35 },
    { item: "Onion", amount: 24 },
    { item: "Trout", amount: 20 }
  ]);

  console.log("Fetched Rewards:", quest.rewards);
  assert.deepStrictEqual(quest.rewards, [
    { type: "silver", amount: 9000, label: "Silver" },
    { type: "item", item: "Hops Seeds", label: "Hops Seeds", amount: 24 },
    { type: "item", item: "Ancient Coin", label: "Ancient Coin", amount: 1 },
    { type: "item", item: "Wizard Hat", label: "Wizard Hat", amount: 1 }
  ]);
  console.log("✓ Live fetch test for Not From Around Here passed!");

  console.log("\n--- Test 3: Non-existent Quest (404 Error Handling) ---");
  let caughtError = null;
  try {
    await fetchBuddyFarmQuest("non-existent-quest-xyz-404");
  } catch (err) {
    caughtError = err;
  }
  assert.ok(caughtError, "Expected an error for non-existent quest");
  console.log("Caught expected error:", caughtError.message);
  assert.ok(caughtError.message.includes("not found") || caughtError.message.includes("404"));
  console.log("✓ Error handling test passed!");

  console.log("\n==============================");
  console.log("ALL AUTOMATED TESTS PASSED! 🎉");
  console.log("==============================");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

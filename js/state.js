import { MAIN_NPCS, normalizeNpcName } from "./quests-data.js";

const STORAGE_KEYS = {
  QUESTS: "farmrpg_helper_quests_v2",
  PLAYER_LEVELS: "farmrpg_helper_player_levels_v1",
  INVENTORY_CAP: "farmrpg_helper_inventory_cap_v1",
  THEME: "farmrpg_helper_theme_v1",
  PLANNER_MODE: "farmrpg_helper_planner_mode_v1",
  IMPORTED_AT: "farmrpg_helper_imported_at_v1"
};

export const DEFAULT_FRIENDSHIPS = Object.freeze(
  Object.fromEntries(MAIN_NPCS.map(npc => [npc.name, 0]))
);

export const DEFAULT_PLAYER_LEVELS = {
  farming: 0,
  fishing: 0,
  crafting: 0,
  exploring: 0,
  cooking: 0,
  mining: 0,
  tower: 0,
  friendship: 0,
  friendships: { ...DEFAULT_FRIENDSHIPS }
};

class StateManager {
  constructor() {
    this.quests = [];
    this.playerLevels = {
      ...DEFAULT_PLAYER_LEVELS,
      friendships: { ...DEFAULT_FRIENDSHIPS }
    };
    this.inventoryCap = 1000;
    this.activeTab = "quests";
    this.plannerFilter = "pinned"; // "pinned" | "active"
    this.filters = {
      status: "available", // "available" | "completed" | "locked" | "all"
      npc: "all",
      search: "",
      skillSort: "default",
      rewardItem: "all"
    };
    this.eventFilters = {
      timeline: "all", // "all" | "active_now" | "upcoming" | "expired" | "completed" | "missed"
      npc: "all",
      search: "",
      year: "all",
      skillSort: "default",
      rewardItem: "all"
    };
    this.theme = "light";
    this.importedAt = null;
    this.subscribers = [];
    this.init();
  }

  init() {
    // 1. Load theme
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (savedTheme) {
      this.theme = savedTheme;
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      this.theme = "dark";
    }
    this.applyTheme();

    // 2. Load player levels
    try {
      const savedLevels = localStorage.getItem(STORAGE_KEYS.PLAYER_LEVELS);
      if (savedLevels) {
        const parsed = JSON.parse(savedLevels);
        this.playerLevels = {
          ...DEFAULT_PLAYER_LEVELS,
          ...parsed,
          friendships: {
            ...DEFAULT_FRIENDSHIPS,
            ...(parsed.friendships || {})
          }
        };
      } else {
        this.playerLevels = {
          ...DEFAULT_PLAYER_LEVELS,
          friendships: { ...DEFAULT_FRIENDSHIPS }
        };
      }
    } catch (e) {
      this.playerLevels = {
        ...DEFAULT_PLAYER_LEVELS,
        friendships: { ...DEFAULT_FRIENDSHIPS }
      };
    }

    // 3. Load quests
    try {
      const savedQuests = localStorage.getItem(STORAGE_KEYS.QUESTS);
      if (savedQuests) {
        this.quests = JSON.parse(savedQuests);
        // If stored quests lack date fields or predecessor fields, enrich from data/quests.json
        const hasDates = this.quests.some(q => q.startDate || q.endDate);
        const bfg = this.quests.find(q => q.title === "Bowling for Goldie I");
        const hasPrereqs = bfg ? Boolean(bfg.prevQuestId) : true;
        if ((!hasDates || !hasPrereqs) && this.quests.length > 0) {
          this.enrichQuestsFromCatalog();
        }
      } else {
        this.quests = [];
        // Attempt background preload from local data/quests.json if available
        this.loadPrecompiledQuests();
      }
    } catch (e) {
      console.error("Failed to load quests from localStorage:", e);
      this.quests = [];
    }

    // 4. Load importedAt
    this.importedAt = localStorage.getItem(STORAGE_KEYS.IMPORTED_AT) || null;

    // 5. Load inventory cap (defaults to 1000)
    try {
      const savedCap = localStorage.getItem(STORAGE_KEYS.INVENTORY_CAP);
      if (savedCap !== null) {
        const parsedCap = parseInt(savedCap, 10);
        this.inventoryCap = !isNaN(parsedCap) && parsedCap > 0 ? parsedCap : 1000;
      } else {
        this.inventoryCap = 1000;
        this.saveInventoryCap();
      }
    } catch (e) {
      this.inventoryCap = 1000;
    }

    // 6. Load planner mode
    const savedPlanner = localStorage.getItem(STORAGE_KEYS.PLANNER_MODE);
    if (savedPlanner && (savedPlanner === "pinned" || savedPlanner === "active")) {
      this.plannerFilter = savedPlanner;
    } else {
      this.plannerFilter = "pinned";
    }
  }

  async loadPrecompiledQuests() {
    try {
      const res = await fetch("./data/quests.json");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0 && this.quests.length === 0) {
          this.quests = data;
          this.importedAt = new Date().toISOString();
          this.saveQuests();
          localStorage.setItem(STORAGE_KEYS.IMPORTED_AT, this.importedAt);
          this.notify();
        }
      }
    } catch (e) {
      // Local file unavailable or running in context without static server
    }
  }

  async enrichQuestsFromCatalog() {
    try {
      const res = await fetch("./data/quests.json");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const catalogMap = new Map();
          data.forEach(q => {
            catalogMap.set(q.id, q);
            catalogMap.set(q.title.toLowerCase().trim(), q);
          });
          let enriched = false;
          for (const q of this.quests) {
            const cat = catalogMap.get(q.id) || catalogMap.get(q.title.toLowerCase().trim());
            if (cat) {
              if ((!q.startDate || !q.endDate) && (cat.startDate || cat.endDate)) {
                q.startDate = cat.startDate;
                q.endDate = cat.endDate;
                enriched = true;
              }
              if (cat.prevQuestId && q.prevQuestId !== cat.prevQuestId) {
                q.prevQuestId = cat.prevQuestId;
                q.prevQuestTitle = cat.prevQuestTitle;
                enriched = true;
              }
            }
          }
          if (enriched) {
            this.saveQuests();
            this.notify();
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  saveQuests() {
    localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(this.quests));
  }

  savePlayerLevels() {
    localStorage.setItem(STORAGE_KEYS.PLAYER_LEVELS, JSON.stringify(this.playerLevels));
  }

  saveInventoryCap() {
    localStorage.setItem(STORAGE_KEYS.INVENTORY_CAP, String(this.inventoryCap));
  }

  savePlannerMode() {
    localStorage.setItem(STORAGE_KEYS.PLANNER_MODE, this.plannerFilter);
  }

  getNpcFriendship(npcName) {
    if (!npcName) return 0;
    const canonical = normalizeNpcName(npcName);
    if (this.playerLevels.friendships && this.playerLevels.friendships[canonical] !== undefined) {
      return this.playerLevels.friendships[canonical];
    }
    // Fallback to legacy playerLevels.friendship if present
    return this.playerLevels.friendship || 0;
  }

  setNpcFriendships(newFriendships) {
    if (!newFriendships || typeof newFriendships !== "object") return;
    if (!this.playerLevels.friendships) {
      this.playerLevels.friendships = { ...DEFAULT_FRIENDSHIPS };
    }
    for (const [key, val] of Object.entries(newFriendships)) {
      const canonical = normalizeNpcName(key);
      const parsed = parseInt(val, 10);
      this.playerLevels.friendships[canonical] = !isNaN(parsed) && parsed >= 0 ? Math.min(99, parsed) : 0;
    }
    this.savePlayerLevels();
    this.notify();
  }

  setPlayerLevels(newLevels) {
    if (!newLevels || typeof newLevels !== "object") return;

    if (!this.playerLevels.friendships) {
      this.playerLevels.friendships = { ...DEFAULT_FRIENDSHIPS };
    }

    // 1. Handle nested friendships object
    if (newLevels.friendships && typeof newLevels.friendships === "object") {
      for (const [key, val] of Object.entries(newLevels.friendships)) {
        const canonical = normalizeNpcName(key);
        const parsed = parseInt(val, 10);
        this.playerLevels.friendships[canonical] = !isNaN(parsed) && parsed >= 0 ? Math.min(99, parsed) : 0;
      }
    }

    // 2. Handle top-level keys
    for (const [key, val] of Object.entries(newLevels)) {
      if (key === "friendships") continue;
      const normalizedNpc = normalizeNpcName(key);
      if (MAIN_NPCS.some(n => n.name === normalizedNpc)) {
        const parsed = parseInt(val, 10);
        this.playerLevels.friendships[normalizedNpc] = !isNaN(parsed) && parsed >= 0 ? Math.min(99, parsed) : 0;
      } else {
        const num = parseInt(val, 10);
        this.playerLevels[key] = !isNaN(num) && num >= 0 ? num : 0;
      }
    }

    this.savePlayerLevels();
    this.notify();
  }

  setInventoryCap(cap) {
    const parsed = parseInt(cap, 10);
    this.inventoryCap = !isNaN(parsed) && parsed > 0 ? parsed : 1000;
    this.saveInventoryCap();
    this.notify();
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(fn => fn !== callback);
    };
  }

  notify() {
    this.subscribers.forEach(cb => cb(this));
  }

  applyTheme() {
    document.documentElement.setAttribute("data-theme", this.theme);
    localStorage.setItem(STORAGE_KEYS.THEME, this.theme);
  }

  toggleTheme() {
    this.theme = this.theme === "light" ? "dark" : "light";
    this.applyTheme();
    this.notify();
  }

  setTab(tab) {
    this.activeTab = tab;
    this.notify();
  }

  setFilters(newFilters) {
    this.filters = { ...this.filters, ...newFilters };
    this.notify();
  }

  setEventFilters(newFilters) {
    this.eventFilters = { ...this.eventFilters, ...newFilters };
    this.notify();
  }

  setPlannerFilter(mode) {
    this.plannerFilter = mode;
    this.savePlannerMode();
    this.notify();
  }

  /**
   * Checks if a quest is a time-limited event quest.
   */
  isEventQuest(quest) {
    return Boolean(quest && (quest.startDate || quest.endDate));
  }

  /**
   * Evaluates whether a quest has been completed.
   */
  isQuestCompleted(quest) {
    return quest?.status === "completed";
  }

  /**
   * Evaluates whether an event quest has been marked as missed.
   */
  isQuestMissed(quest) {
    return quest?.status === "missed";
  }

  /**
   * Evaluates dynamic quest availability.
   * A quest is available if:
   * 1. It is not already completed and not marked as missed.
   * 2. Player meets all skill level requirements (farming, fishing, crafting, exploring, cooking, mining).
   *    (Note: a player level of 0 means locked/unavailable if the quest requires that skill).
   * 3. Player meets tower level requirement if > 0 (0 = locked).
   * 4. Player meets NPC friendship requirement if > 0 (0 = locked).
   * 5. For questlines, the previous sequential quest must be completed.
   */
  isQuestAvailable(quest) {
    if (!quest) return false;
    if (quest.status === "completed" || quest.status === "missed") return false;

    // 1. Skill requirements check
    const skills = ["farming", "fishing", "crafting", "exploring", "cooking", "mining"];
    for (const skill of skills) {
      const required = quest.skills?.[skill] || 0;
      if (required > 0) {
        const playerLvl = this.playerLevels[skill] || 0;
        if (playerLvl <= 0 || playerLvl < required) {
          return false;
        }
      }
    }

    // 2. Tower level check
    const requiredTower = quest.towerLevel || 0;
    if (requiredTower > 0) {
      const playerTower = this.playerLevels.tower || 0;
      if (playerTower <= 0 || playerTower < requiredTower) {
        return false;
      }
    }

    // 3. NPC Friendship check
    const requiredFriendship = quest.requiredNpcLevel || 0;
    if (requiredFriendship > 0) {
      const playerFriendship = this.getNpcFriendship(quest.requiredNpc);
      if (playerFriendship <= 0 || playerFriendship < requiredFriendship) {
        return false;
      }
    }

    // 4. Predecessor quest check (canonical buddy.farm pred)
    if (quest.prevQuestId) {
      const prev = this.quests.find(q => q.id === quest.prevQuestId)
        || (quest.prevQuestTitle ? this.quests.find(q => q.title.toLowerCase().trim() === quest.prevQuestTitle.toLowerCase().trim()) : null);
      if (!prev || prev.status !== "completed") {
        return false;
      }
    }

    // 5. Sequential questline predecessor check (for steps > 1 if distinct from prevQuestId)
    if (quest.questline && quest.stepNumber > 1) {
      const prevStepQuest = this.quests.find(
        q => q.questline === quest.questline && q.stepNumber === quest.stepNumber - 1
      );
      if (prevStepQuest && prevStepQuest.id !== quest.prevQuestId && prevStepQuest.status !== "completed") {
        return false;
      }
    }

    return true;
  }

  /**
   * Returns a list of reasons why a quest is currently locked.
   */
  getQuestLockReasons(quest) {
    if (!quest) return [];
    if (quest.status === "completed" || quest.status === "missed") return [];

    const reasons = [];
    const skills = [
      { id: "farming", name: "Farming" },
      { id: "fishing", name: "Fishing" },
      { id: "crafting", name: "Crafting" },
      { id: "exploring", name: "Exploring" },
      { id: "cooking", name: "Cooking" },
      { id: "mining", name: "Mining" }
    ];

    for (const s of skills) {
      const req = quest.skills?.[s.id] || 0;
      if (req > 0) {
        const pLvl = this.playerLevels[s.id] || 0;
        if (pLvl <= 0) {
          reasons.push(`${s.name} ${req} required (${s.name} is Locked - 0)`);
        } else if (pLvl < req) {
          reasons.push(`${s.name} ${req} required (You: ${pLvl})`);
        }
      }
    }

    if (quest.towerLevel > 0) {
      const pTower = this.playerLevels.tower || 0;
      if (pTower <= 0) {
        reasons.push(`Tower Level ${quest.towerLevel} required (Tower is Locked - 0)`);
      } else if (pTower < quest.towerLevel) {
        reasons.push(`Tower Level ${quest.towerLevel} required (You: ${pTower})`);
      }
    }

    if (quest.requiredNpcLevel > 0) {
      const npcName = quest.requiredNpc || "Townsfolk";
      const pFriendship = this.getNpcFriendship(npcName);
      if (pFriendship <= 0) {
        reasons.push(`${npcName} Friendship ${quest.requiredNpcLevel} required (${npcName} Friendship is Locked - 0)`);
      } else if (pFriendship < quest.requiredNpcLevel) {
        reasons.push(`${npcName} Friendship ${quest.requiredNpcLevel} required (You: ${pFriendship})`);
      }
    }

    if (quest.prevQuestId) {
      const prev = this.quests.find(q => q.id === quest.prevQuestId)
        || (quest.prevQuestTitle ? this.quests.find(q => q.title.toLowerCase().trim() === quest.prevQuestTitle.toLowerCase().trim()) : null);
      if (!prev || prev.status !== "completed") {
        reasons.push(`Complete "${quest.prevQuestTitle || prev?.title || "previous quest"}" first`);
      }
    }

    if (quest.questline && quest.stepNumber > 1) {
      const prevStepQuest = this.quests.find(
        q => q.questline === quest.questline && q.stepNumber === quest.stepNumber - 1
      );
      if (prevStepQuest && prevStepQuest.id !== quest.prevQuestId && prevStepQuest.status !== "completed") {
        reasons.push(`Complete "${prevStepQuest?.title || `${quest.questline} Step ${quest.stepNumber - 1}`}" first`);
      }
    }

    return reasons;
  }

  /**
   * Ingests all quests from buddy.farm.
   * Preserves existing completion and pinned statuses.
   */
  importBuddyFarmQuests(importedQuests) {
    if (!Array.isArray(importedQuests) || importedQuests.length === 0) {
      throw new Error("No quests found to import.");
    }

    const existingStatusMap = new Map();
    for (const q of this.quests) {
      existingStatusMap.set(q.id, { status: q.status, pinned: q.pinned });
      existingStatusMap.set(q.title.toLowerCase().trim(), { status: q.status, pinned: q.pinned });
    }

    this.quests = importedQuests.map(q => {
      const existing = existingStatusMap.get(q.id) || existingStatusMap.get(q.title.toLowerCase().trim());
      return {
        ...q,
        startDate: q.startDate || null,
        endDate: q.endDate || null,
        status: existing?.status || "active",
        pinned: !!existing?.pinned
      };
    });

    this.importedAt = new Date().toISOString();
    this.saveQuests();
    localStorage.setItem(STORAGE_KEYS.IMPORTED_AT, this.importedAt);
    this.notify();
    return { success: true, count: this.quests.length };
  }

  /**
   * Sets quest status directly ("active" | "completed" | "missed").
   */
  setQuestStatus(id, newStatus) {
    const quest = this.quests.find(q => q.id === id);
    if (quest) {
      quest.status = newStatus;
      this.saveQuests();
      this.notify();
      return newStatus;
    }
    return null;
  }

  /**
   * Toggles quest completion status.
   * If currently completed, reopens to active.
   * If currently active or missed, marks as completed.
   */
  toggleQuestStatus(id) {
    const quest = this.quests.find(q => q.id === id);
    if (quest) {
      const newStatus = quest.status === "completed" ? "active" : "completed";
      quest.status = newStatus;
      this.saveQuests();
      this.notify();
      return newStatus;
    }
    return null;
  }

  /**
   * Toggles missed status for event quests.
   * If currently missed, reopens to active.
   * If active or completed, marks as missed.
   */
  toggleQuestMissed(id) {
    const quest = this.quests.find(q => q.id === id);
    if (quest) {
      const newStatus = quest.status === "missed" ? "active" : "missed";
      quest.status = newStatus;
      this.saveQuests();
      this.notify();
      return newStatus;
    }
    return null;
  }

  /**
   * Bulk marks all past/expired uncompleted event quests as missed.
   */
  markExpiredEventsAsMissed(referenceDate = new Date()) {
    const nowMs = referenceDate instanceof Date ? referenceDate.getTime() : new Date(referenceDate).getTime();
    let markedCount = 0;
    for (const q of this.quests) {
      if (this.isEventQuest(q) && q.status === "active" && q.endDate) {
        const endMs = new Date(q.endDate).getTime();
        if (!isNaN(endMs) && nowMs > endMs) {
          q.status = "missed";
          markedCount++;
        }
      }
    }
    if (markedCount > 0) {
      this.saveQuests();
      this.notify();
    }
    return markedCount;
  }

  /**
   * Toggles pin status for Material Planner.
   */
  toggleQuestPin(id) {
    const quest = this.quests.find(q => q.id === id);
    if (quest) {
      quest.pinned = !quest.pinned;
      this.saveQuests();
      this.notify();
      return quest.pinned;
    }
    return false;
  }

  exportData() {
    const data = {
      version: 4,
      exportedAt: new Date().toISOString(),
      quests: this.quests,
      playerLevels: this.playerLevels,
      inventoryCap: this.inventoryCap,
      importedAt: this.importedAt
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `farmrpg_quests_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!Array.isArray(data.quests)) {
        throw new Error("Invalid backup file format: missing quests array.");
      }
      this.quests = data.quests;
      if (data.playerLevels && typeof data.playerLevels === "object") {
        this.playerLevels = {
          ...DEFAULT_PLAYER_LEVELS,
          ...data.playerLevels,
          friendships: {
            ...DEFAULT_FRIENDSHIPS,
            ...(data.playerLevels.friendships || {})
          }
        };
        this.savePlayerLevels();
      }
      if (data.inventoryCap && parseInt(data.inventoryCap, 10) > 0) {
        this.inventoryCap = parseInt(data.inventoryCap, 10);
        this.saveInventoryCap();
      }
      if (data.importedAt) {
        this.importedAt = data.importedAt;
        localStorage.setItem(STORAGE_KEYS.IMPORTED_AT, this.importedAt);
      }
      this.saveQuests();
      this.notify();
      return { success: true, count: this.quests.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  resetToDefaults() {
    this.quests.forEach(q => {
      q.status = "active";
      q.pinned = false;
    });
    this.playerLevels = {
      ...DEFAULT_PLAYER_LEVELS,
      friendships: { ...DEFAULT_FRIENDSHIPS }
    };
    this.inventoryCap = 1000;
    this.saveQuests();
    this.savePlayerLevels();
    this.saveInventoryCap();
    this.notify();
  }
}

export const state = new StateManager();

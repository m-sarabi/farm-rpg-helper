import { DEFAULT_QUESTS } from "./quests-data.js";

const STORAGE_KEYS = {
  QUESTS: "farmrpg_helper_quests_v1",
  INVENTORY_CAP: "farmrpg_helper_inventory_cap_v1",
  THEME: "farmrpg_helper_theme_v1",
  PLANNER_MODE: "farmrpg_helper_planner_mode_v1"
};

class StateManager {
  constructor() {
    this.quests = [];
    this.inventoryCap = 1000;
    this.activeTab = "quests";
    this.plannerFilter = "pinned"; // "pinned" | "active"
    this.filters = {
      status: "active", // "all" | "active" | "completed"
      npc: "all",
      search: "",
      skillSort: "default",
      rewardItem: "all"
    };
    this.theme = "light";
    this.subscribers = [];
    this.init();
  }

  init() {
    // Load theme
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (savedTheme) {
      this.theme = savedTheme;
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      this.theme = "dark";
    }
    this.applyTheme();

    // Load quests
    try {
      const savedQuests = localStorage.getItem(STORAGE_KEYS.QUESTS);
      if (savedQuests) {
        this.quests = JSON.parse(savedQuests);
      } else {
        this.quests = JSON.parse(JSON.stringify(DEFAULT_QUESTS));
        this.saveQuests();
      }
    } catch (e) {
      console.error("Failed to load quests from localStorage:", e);
      this.quests = [];
    }

    // Load inventory cap (defaults to 1000)
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

    // Load planner mode
    const savedPlanner = localStorage.getItem(STORAGE_KEYS.PLANNER_MODE);
    if (savedPlanner && (savedPlanner === "pinned" || savedPlanner === "active")) {
      this.plannerFilter = savedPlanner;
    } else {
      this.plannerFilter = "pinned";
    }
  }

  saveQuests() {
    localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(this.quests));
  }

  saveInventoryCap() {
    localStorage.setItem(STORAGE_KEYS.INVENTORY_CAP, String(this.inventoryCap));
  }

  setInventoryCap(cap) {
    const parsed = parseInt(cap, 10);
    this.inventoryCap = !isNaN(parsed) && parsed > 0 ? parsed : 1000;
    this.saveInventoryCap();
    this.notify();
  }

  savePlannerMode() {
    localStorage.setItem(STORAGE_KEYS.PLANNER_MODE, this.plannerFilter);
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

  setPlannerFilter(mode) {
    this.plannerFilter = mode;
    this.savePlannerMode();
    this.notify();
  }

  addQuest(quest) {
    const newQuest = {
      id: "quest-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      title: quest.title.trim() || "Untitled Quest",
      npc: quest.npc.trim() || "Buddy",
      description: quest.description?.trim() || "",
      levelReq: quest.levelReq?.trim() || "",
      skills: quest.skills || {},
      status: quest.status || "active",
      pinned: !!quest.pinned,
      requirements: Array.isArray(quest.requirements) ? quest.requirements : [],
      rewards: Array.isArray(quest.rewards) ? quest.rewards : [],
      createdAt: new Date().toISOString()
    };
    this.quests.unshift(newQuest);
    this.saveQuests();
    this.notify();
    return newQuest;
  }

  updateQuest(id, updatedFields) {
    const index = this.quests.findIndex(q => q.id === id);
    if (index !== -1) {
      this.quests[index] = { ...this.quests[index], ...updatedFields };
      this.saveQuests();
      this.notify();
    }
  }

  deleteQuest(id) {
    this.quests = this.quests.filter(q => q.id !== id);
    this.saveQuests();
    this.notify();
  }

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
      version: 3,
      exportedAt: new Date().toISOString(),
      quests: this.quests,
      inventoryCap: this.inventoryCap
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
      if (data.inventoryCap && parseInt(data.inventoryCap, 10) > 0) {
        this.inventoryCap = parseInt(data.inventoryCap, 10);
        this.saveInventoryCap();
      }
      this.saveQuests();
      this.notify();
      return { success: true, count: this.quests.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  resetToDefaults() {
    this.quests = [];
    this.inventoryCap = 1000;
    this.saveQuests();
    this.saveInventoryCap();
    this.notify();
  }
}

export const state = new StateManager();

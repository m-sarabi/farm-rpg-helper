import { DEFAULT_QUESTS } from "./quests-data.js";

const STORAGE_KEYS = {
  QUESTS: "farmrpg_helper_quests_v1",
  INVENTORY: "farmrpg_helper_inventory_v1",
  SELECTED: "farmrpg_helper_selected_v1",
  THEME: "farmrpg_helper_theme_v1",
  PLANNER_MODE: "farmrpg_helper_planner_mode_v1"
};

class StateManager {
  constructor() {
    this.quests = [];
    this.inventory = {};
    this.selectedQuestIds = new Set();
    this.activeTab = "quests";
    this.plannerFilter = "active"; // "active" | "selected" | "pinned"
    this.filters = {
      status: "active", // "all" | "active" | "completed" | "ready"
      npc: "all",
      search: ""
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
      this.quests = JSON.parse(JSON.stringify(DEFAULT_QUESTS));
    }

    // Load inventory
    try {
      const savedInv = localStorage.getItem(STORAGE_KEYS.INVENTORY);
      if (savedInv) {
        this.inventory = JSON.parse(savedInv);
      } else {
        // Seed default starter inventory with a few items to show how it works
        this.inventory = {
          "Wood": 15,
          "Stone": 5,
          "Corn": 20
        };
        this.saveInventory();
      }
    } catch (e) {
      this.inventory = {};
    }

    // Load selected quests
    try {
      const savedSelected = localStorage.getItem(STORAGE_KEYS.SELECTED);
      if (savedSelected) {
        this.selectedQuestIds = new Set(JSON.parse(savedSelected));
      } else {
        // By default, select pinned active quests
        this.quests.filter(q => q.status === "active" && q.pinned).forEach(q => this.selectedQuestIds.add(q.id));
      }
    } catch (e) {
      this.selectedQuestIds = new Set();
    }

    // Load planner mode
    const savedPlanner = localStorage.getItem(STORAGE_KEYS.PLANNER_MODE);
    if (savedPlanner) {
      this.plannerFilter = savedPlanner;
    }
  }

  saveQuests() {
    localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(this.quests));
  }

  saveInventory() {
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(this.inventory));
  }

  saveSelected() {
    localStorage.setItem(STORAGE_KEYS.SELECTED, JSON.stringify(Array.from(this.selectedQuestIds)));
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
      status: quest.status || "active",
      pinned: !!quest.pinned,
      requirements: Array.isArray(quest.requirements) ? quest.requirements : [],
      rewards: Array.isArray(quest.rewards) ? quest.rewards : [],
      createdAt: new Date().toISOString()
    };
    this.quests.unshift(newQuest);
    if (newQuest.pinned) {
      this.selectedQuestIds.add(newQuest.id);
      this.saveSelected();
    }
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
    this.selectedQuestIds.delete(id);
    this.saveQuests();
    this.saveSelected();
    this.notify();
  }

  toggleQuestStatus(id) {
    const quest = this.quests.find(q => q.id === id);
    if (quest) {
      const newStatus = quest.status === "completed" ? "active" : "completed";
      quest.status = newStatus;
      if (newStatus === "completed") {
        this.selectedQuestIds.delete(id);
        this.saveSelected();
      }
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

  toggleQuestSelection(id) {
    if (this.selectedQuestIds.has(id)) {
      this.selectedQuestIds.delete(id);
    } else {
      this.selectedQuestIds.add(id);
    }
    this.saveSelected();
    this.notify();
  }

  selectAllActive() {
    this.quests.filter(q => q.status === "active").forEach(q => this.selectedQuestIds.add(q.id));
    this.saveSelected();
    this.notify();
  }

  deselectAll() {
    this.selectedQuestIds.clear();
    this.saveSelected();
    this.notify();
  }

  setInventoryItem(itemName, count) {
    const cleanItem = itemName.trim();
    const qty = Math.max(0, parseInt(count, 10) || 0);
    if (qty === 0) {
      delete this.inventory[cleanItem];
    } else {
      this.inventory[cleanItem] = qty;
    }
    this.saveInventory();
    this.notify();
  }

  adjustInventoryItem(itemName, delta) {
    const cleanItem = itemName.trim();
    const current = this.inventory[cleanItem] || 0;
    const updated = Math.max(0, current + delta);
    if (updated === 0) {
      delete this.inventory[cleanItem];
    } else {
      this.inventory[cleanItem] = updated;
    }
    this.saveInventory();
    this.notify();
  }

  exportData() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      quests: this.quests,
      inventory: this.inventory,
      selectedQuestIds: Array.from(this.selectedQuestIds)
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
      this.inventory = data.inventory || {};
      this.selectedQuestIds = new Set(data.selectedQuestIds || []);
      this.saveQuests();
      this.saveInventory();
      this.saveSelected();
      this.notify();
      return { success: true, count: this.quests.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  resetToDefaults() {
    this.quests = JSON.parse(JSON.stringify(DEFAULT_QUESTS));
    this.inventory = { "Wood": 15, "Stone": 5, "Corn": 20 };
    this.selectedQuestIds = new Set();
    this.quests.filter(q => q.status === "active" && q.pinned).forEach(q => this.selectedQuestIds.add(q.id));
    this.saveQuests();
    this.saveInventory();
    this.saveSelected();
    this.notify();
  }
}

export const state = new StateManager();

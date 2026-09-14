import { state } from "./state.js";
import { NPC_LIST, KNOWN_ITEM_NAMES, getItemIcon } from "./quests-data.js";
import { formatMaterialsAsText, aggregateMaterials } from "./calculator.js";
import { attachItemAutocomplete } from "./autocomplete.js";
import {
  renderQuestCard,
  renderPlannerView,
  renderSettingsView,
  openQuestModal,
  closeModal,
  showToast
} from "./components.js";

// DOM References
const mainContent = document.getElementById("main-content");
const navTabs = document.querySelectorAll(".nav-tab");
const statActiveCount = document.getElementById("stat-active-count");
const statCompletedCount = document.getElementById("stat-completed-count");
const badgeQuestCount = document.getElementById("badge-quest-count");
const badgePlannerCount = document.getElementById("badge-planner-count");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const modalCloseX = document.getElementById("modal-close-x");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const questModal = document.getElementById("quest-modal");
const brandHomeLink = document.getElementById("brand-home-link");

// Application Initialization
function initApp() {
  // Bind Theme Toggle
  themeToggleBtn.addEventListener("click", () => {
    state.toggleTheme();
    updateThemeIcon();
  });
  updateThemeIcon();

  // Bind Brand Click -> go to quests
  brandHomeLink.addEventListener("click", (e) => {
    e.preventDefault();
    switchTab("quests");
  });

  // Bind Navigation Tabs
  navTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetTab = tab.dataset.tab;
      switchTab(targetTab);
    });
  });

  // Bind Modal Close handlers
  modalCloseX.addEventListener("click", closeModal);
  modalCancelBtn.addEventListener("click", closeModal);
  questModal.addEventListener("click", (e) => {
    if (e.target === questModal) closeModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && questModal.classList.contains("is-active")) {
      closeModal();
    }
  });

  // Subscribe to state changes to update header stats and re-render current view
  state.subscribe(() => {
    updateHeaderStats();
    renderCurrentTab();
  });

  // Initial render
  updateHeaderStats();
  renderCurrentTab();
}

function updateThemeIcon() {
  themeToggleBtn.textContent = state.theme === "dark" ? "☀️" : "🌙";
  themeToggleBtn.title = state.theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme";
}

function switchTab(tabName) {
  state.setTab(tabName);
  navTabs.forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });
}

function updateHeaderStats() {
  const activeQuests = state.quests.filter(q => q.status === "active");
  const completedQuests = state.quests.filter(q => q.status === "completed");
  const pinnedActiveQuests = activeQuests.filter(q => q.pinned);

  if (statActiveCount) statActiveCount.textContent = `${activeQuests.length} Active`;
  if (statCompletedCount) statCompletedCount.textContent = `${completedQuests.length} Completed`;

  if (badgeQuestCount) badgeQuestCount.textContent = activeQuests.length;
  if (badgePlannerCount) badgePlannerCount.textContent = pinnedActiveQuests.length;
}

/**
 * Render the appropriate view based on state.activeTab
 */
function renderCurrentTab() {
  mainContent.innerHTML = "";

  switch (state.activeTab) {
    case "quests":
      renderQuestsView();
      break;
    case "planner":
      renderPlannerTab();
      break;
    case "settings":
      renderSettingsTab();
      break;
    default:
      renderQuestsView();
  }
}

/**
 * Extract unique reward items present across all quests.
 * Silver and Gold are listed at the top, followed by other items alphabetically.
 */
function getAvailableRewardItems(quests) {
  const items = new Set();
  (quests || []).forEach(q => {
    (q.rewards || []).forEach(r => {
      const type = (r.type || "").toLowerCase();
      if (type === "silver" || (r.item && r.item.toLowerCase() === "silver") || (r.label && r.label.toLowerCase() === "silver")) {
        items.add("Silver");
      } else if (type === "gold" || (r.item && r.item.toLowerCase() === "gold") || (r.label && r.label.toLowerCase() === "gold")) {
        items.add("Gold");
      } else {
        const name = (r.item || r.label || "").trim();
        if (name && type !== "xp") {
          items.add(name);
        }
      }
    });
  });

  return Array.from(items).sort((a, b) => {
    if (a === "Silver" && b !== "Silver") return -1;
    if (b === "Silver" && a !== "Silver") return 1;
    if (a === "Gold" && b !== "Gold") return -1;
    if (b === "Gold" && a !== "Gold") return 1;
    return a.localeCompare(b);
  });
}

/**
 * Calculate total quantity of a specific reward item granted by a quest.
 */
function getQuestRewardAmount(quest, itemName) {
  if (!quest || !quest.rewards || !Array.isArray(quest.rewards)) return 0;
  const target = (itemName || "").trim().toLowerCase();
  if (!target || target === "all") return 0;

  let total = 0;
  for (const rew of quest.rewards) {
    const type = (rew.type || "").toLowerCase();
    const name = (rew.item || rew.label || "").trim().toLowerCase();
    const amount = parseInt(rew.amount, 10) || 0;

    if (target === "silver" && (type === "silver" || name === "silver")) {
      total += amount;
    } else if (target === "gold" && (type === "gold" || name === "gold")) {
      total += amount;
    } else if (name === target && type !== "xp") {
      total += amount;
    }
  }
  return total;
}

/**
 * Get maximum single reward quantity in a quest (used when sorting rewards with All Rewards selected).
 */
function getMaxRewardAmount(quest) {
  if (!quest || !quest.rewards || !Array.isArray(quest.rewards)) return 0;
  let max = 0;
  for (const rew of quest.rewards) {
    const amount = parseInt(rew.amount, 10) || 0;
    if (amount > max) max = amount;
  }
  return max;
}

/**
 * Format reward item name with an emoji icon for select options.
 */
function getRewardOptionText(item) {
  if (item === "Silver") return "🪙 Silver";
  if (item === "Gold") return "✨ Gold";
  const icon = getItemIcon(item);
  return `${icon && icon !== "📦" ? icon + " " : "🎁 "}${item}`;
}

/**
 * Quests View (Catalog, Filter, Search, Cards)
 */
function renderQuestsView() {
  const existingView = document.getElementById("quests-view-container");

  // If already mounted, update grid and toolbar states in-place to preserve search input focus
  if (existingView && mainContent.contains(existingView)) {
    updateQuestsGridAndFilters(existingView);
    return;
  }

  const container = document.createElement("div");
  container.className = "quests-view";
  container.id = "quests-view-container";

  // Build Toolbar
  const toolbar = document.createElement("div");
  toolbar.className = "quests-toolbar";

  // Unique list of NPCs present in quests + default list
  const activeNpcs = Array.from(new Set([...NPC_LIST, ...state.quests.map(q => q.npc)])).sort();

  // Unique list of reward items present in quests
  const activeRewards = getAvailableRewardItems(state.quests);
  if (state.filters.rewardItem && state.filters.rewardItem !== "all" && !activeRewards.includes(state.filters.rewardItem)) {
    activeRewards.push(state.filters.rewardItem);
  }

  toolbar.innerHTML = `
    <div class="toolbar-top-row">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="quest-search-input" class="search-input" placeholder="Search quests by title, NPC, or required item..." value="${state.filters.search}" />
      </div>
      <div class="toolbar-actions">
        <button class="btn btn-primary" id="btn-add-quest">
          <span>➕</span> Add Quest
        </button>
      </div>
    </div>

    <div class="toolbar-filters">
      <div class="filter-pills" id="filter-pills-container">
        <!-- Rendered dynamically -->
      </div>

      <div class="filter-dropdown-group">
        <select class="filter-select" id="npc-filter-select" title="Filter by NPC">
          <option value="all" ${state.filters.npc === 'all' ? 'selected' : ''}>All NPCs</option>
          ${activeNpcs.map(npc => `
            <option value="${npc}" ${state.filters.npc === npc ? 'selected' : ''}>${npc === 'Unknown' ? '❓' : '👤'} ${npc}</option>
          `).join('')}
        </select>

        <select class="filter-select" id="reward-filter-select" title="Filter by Reward Item">
          <option value="all" ${state.filters.rewardItem === 'all' ? 'selected' : ''}>All Rewards</option>
          ${activeRewards.map(item => `
            <option value="${item}" ${state.filters.rewardItem === item ? 'selected' : ''}>${getRewardOptionText(item)}</option>
          `).join('')}
        </select>

        <select class="filter-select" id="skill-sort-select" title="Sort quests">
          <option value="default" ${state.filters.skillSort === 'default' ? 'selected' : ''}>Sort: Default</option>
          <option value="reward_desc" ${state.filters.skillSort === 'reward_desc' ? 'selected' : ''}>${state.filters.rewardItem && state.filters.rewardItem !== 'all' ? `🎁 ${state.filters.rewardItem} (High to Low)` : '🎁 Reward Amount (High to Low)'}</option>
          <option value="reward_asc" ${state.filters.skillSort === 'reward_asc' ? 'selected' : ''}>${state.filters.rewardItem && state.filters.rewardItem !== 'all' ? `🎁 ${state.filters.rewardItem} (Low to High)` : '🎁 Reward Amount (Low to High)'}</option>
          <option value="farming_asc" ${state.filters.skillSort === 'farming_asc' ? 'selected' : ''}>🌾 Farming (Low to High)</option>
          <option value="farming_desc" ${state.filters.skillSort === 'farming_desc' ? 'selected' : ''}>🌾 Farming (High to Low)</option>
          <option value="fishing_asc" ${state.filters.skillSort === 'fishing_asc' ? 'selected' : ''}>🎣 Fishing (Low to High)</option>
          <option value="fishing_desc" ${state.filters.skillSort === 'fishing_desc' ? 'selected' : ''}>🎣 Fishing (High to Low)</option>
          <option value="crafting_asc" ${state.filters.skillSort === 'crafting_asc' ? 'selected' : ''}>🔨 Crafting (Low to High)</option>
          <option value="crafting_desc" ${state.filters.skillSort === 'crafting_desc' ? 'selected' : ''}>🔨 Crafting (High to Low)</option>
          <option value="exploring_asc" ${state.filters.skillSort === 'exploring_asc' ? 'selected' : ''}>🧭 Exploring (Low to High)</option>
          <option value="exploring_desc" ${state.filters.skillSort === 'exploring_desc' ? 'selected' : ''}>🧭 Exploring (High to Low)</option>
          <option value="cooking_asc" ${state.filters.skillSort === 'cooking_asc' ? 'selected' : ''}>🍳 Cooking (Low to High)</option>
          <option value="cooking_desc" ${state.filters.skillSort === 'cooking_desc' ? 'selected' : ''}>🍳 Cooking (High to Low)</option>
          <option value="mining_asc" ${state.filters.skillSort === 'mining_asc' ? 'selected' : ''}>⛏️ Mining (Low to High)</option>
          <option value="mining_desc" ${state.filters.skillSort === 'mining_desc' ? 'selected' : ''}>⛏️ Mining (High to Low)</option>
        </select>
      </div>
    </div>
  `;

  // Bind Toolbar Events
  const searchInput = toolbar.querySelector("#quest-search-input");
  let debounceTimeout;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      state.setFilters({ search: e.target.value });
    }, 120);
  });

  const npcSelect = toolbar.querySelector("#npc-filter-select");
  npcSelect.addEventListener("change", (e) => {
    state.setFilters({ npc: e.target.value });
  });

  const rewardSelect = toolbar.querySelector("#reward-filter-select");
  rewardSelect.addEventListener("change", (e) => {
    state.setFilters({ rewardItem: e.target.value });
  });

  const skillSortSelect = toolbar.querySelector("#skill-sort-select");
  skillSortSelect.addEventListener("change", (e) => {
    state.setFilters({ skillSort: e.target.value });
  });

  const btnAddQuest = toolbar.querySelector("#btn-add-quest");
  btnAddQuest.addEventListener("click", () => {
    openQuestModal(null, (questData) => {
      const created = state.addQuest(questData);
      showToast(`Quest "${created.title}" added successfully!`, "success");
    });
  });

  container.appendChild(toolbar);

  // Render Grid container
  const grid = document.createElement("div");
  grid.className = "quests-grid";
  grid.id = "quests-grid-container";
  container.appendChild(grid);

  mainContent.appendChild(container);
  updateQuestsGridAndFilters(container);
}

function updateQuestsGridAndFilters(container) {
  // Update filter pills
  const pillsContainer = container.querySelector("#filter-pills-container");
  if (pillsContainer) {
    const activeCount = state.quests.filter(q => q.status === 'active').length;
    const completedCount = state.quests.filter(q => q.status === 'completed').length;
    const allCount = state.quests.length;

    pillsContainer.innerHTML = `
      <button class="filter-pill ${state.filters.status === 'active' ? 'active' : ''}" data-status="active">
        Active (${activeCount})
      </button>
      <button class="filter-pill ${state.filters.status === 'completed' ? 'active' : ''}" data-status="completed">
        Completed (${completedCount})
      </button>
      <button class="filter-pill ${state.filters.status === 'all' ? 'active' : ''}" data-status="all">
        All Quests (${allCount})
      </button>
    `;

    pillsContainer.querySelectorAll(".filter-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        state.setFilters({ status: pill.dataset.status });
      });
    });
  }

  // Sync dropdown values if changed
  const npcSelect = container.querySelector("#npc-filter-select");
  if (npcSelect && npcSelect.value !== state.filters.npc) {
    npcSelect.value = state.filters.npc;
  }

  const rewardSelect = container.querySelector("#reward-filter-select");
  if (rewardSelect) {
    const activeRewards = getAvailableRewardItems(state.quests);
    if (state.filters.rewardItem && state.filters.rewardItem !== "all" && !activeRewards.includes(state.filters.rewardItem)) {
      activeRewards.push(state.filters.rewardItem);
    }
    const currentOptions = Array.from(rewardSelect.options).map(o => o.value);
    const targetOptions = ["all", ...activeRewards];
    const isMatch = currentOptions.length === targetOptions.length && currentOptions.every((v, i) => v === targetOptions[i]);

    if (!isMatch) {
      rewardSelect.innerHTML = `
        <option value="all" ${state.filters.rewardItem === 'all' ? 'selected' : ''}>All Rewards</option>
        ${activeRewards.map(item => `
          <option value="${item}" ${state.filters.rewardItem === item ? 'selected' : ''}>${getRewardOptionText(item)}</option>
        `).join('')}
      `;
    }
    if (rewardSelect.value !== state.filters.rewardItem) {
      rewardSelect.value = state.filters.rewardItem;
    }
  }

  const skillSortSelect = container.querySelector("#skill-sort-select");
  if (skillSortSelect) {
    const descOpt = skillSortSelect.querySelector("option[value='reward_desc']");
    const ascOpt = skillSortSelect.querySelector("option[value='reward_asc']");
    const currentReward = state.filters.rewardItem;
    if (descOpt) {
      descOpt.textContent = currentReward && currentReward !== "all"
        ? `🎁 ${currentReward} (High to Low)`
        : "🎁 Reward Amount (High to Low)";
    }
    if (ascOpt) {
      ascOpt.textContent = currentReward && currentReward !== "all"
        ? `🎁 ${currentReward} (Low to High)`
        : "🎁 Reward Amount (Low to High)";
    }
    if (skillSortSelect.value !== state.filters.skillSort) {
      skillSortSelect.value = state.filters.skillSort;
    }
  }

  // Update Grid cards
  const grid = container.querySelector("#quests-grid-container");
  if (grid) {
    const filteredQuests = filterQuests(state.quests, state.filters);
    grid.innerHTML = "";

    if (filteredQuests.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-icon">
            <img src="assets/Corn.png" alt="Empty" class="empty-state-img" />
          </div>
          <h3>No Quests Found</h3>
          <p>No quests match your current filter or search criteria. Try adjusting filters or create a new quest!</p>
        </div>
      `;
    } else {
      filteredQuests.forEach(quest => {
        const card = renderQuestCard(quest, state);
        bindQuestCardEvents(card, quest);
        grid.appendChild(card);
      });
    }
  }
}

/**
 * Helper to get a quest's required skill level for a given skill
 */
function getQuestSkillLevel(quest, skillKey) {
  if (quest.skills && quest.skills[skillKey] !== undefined) {
    return parseInt(quest.skills[skillKey], 10) || 0;
  }
  if (quest.levelReq) {
    const match = quest.levelReq.match(new RegExp(`${skillKey}\\s*(\\d+)`, "i"));
    if (match) return parseInt(match[1], 10) || 0;
  }
  return 0;
}

/**
 * Filter and sort logic
 */
function filterQuests(quests, filters) {
  const filtered = quests.filter(q => {
    // Status Filter
    if (filters.status === "active" && q.status !== "active") return false;
    if (filters.status === "completed" && q.status !== "completed") return false;

    // NPC Filter
    if (filters.npc !== "all" && q.npc.toLowerCase() !== filters.npc.toLowerCase()) {
      return false;
    }

    // Reward Item Filter
    if (filters.rewardItem && filters.rewardItem !== "all") {
      if (getQuestRewardAmount(q, filters.rewardItem) <= 0) {
        return false;
      }
    }

    // Search Filter
    if (filters.search) {
      const query = filters.search.toLowerCase().trim();
      const inTitle = q.title.toLowerCase().includes(query);
      const inNpc = q.npc.toLowerCase().includes(query);
      const inDesc = (q.description || "").toLowerCase().includes(query);
      const inReqs = (q.requirements || []).some(r => r.item.toLowerCase().includes(query));
      const inRewards = (q.rewards || []).some(r => (r.item || r.label || r.type || "").toLowerCase().includes(query));
      if (!inTitle && !inNpc && !inDesc && !inReqs && !inRewards) {
        return false;
      }
    }

    return true;
  });

  // Reward-based sorting
  if (filters.skillSort === "reward_desc" || filters.skillSort === "reward_asc") {
    const isDesc = filters.skillSort === "reward_desc";
    filtered.sort((a, b) => {
      const amtA = filters.rewardItem && filters.rewardItem !== "all"
        ? getQuestRewardAmount(a, filters.rewardItem)
        : getMaxRewardAmount(a);
      const amtB = filters.rewardItem && filters.rewardItem !== "all"
        ? getQuestRewardAmount(b, filters.rewardItem)
        : getMaxRewardAmount(b);

      // Quests with rewards come first if sorting descending; 0 goes to bottom
      if (amtA === 0 && amtB > 0) return 1;
      if (amtB === 0 && amtA > 0) return -1;
      if (amtA === 0 && amtB === 0) return a.title.localeCompare(b.title);

      if (amtA !== amtB) {
        return isDesc ? amtB - amtA : amtA - amtB;
      }
      return a.title.localeCompare(b.title);
    });
  } else if (filters.skillSort && filters.skillSort !== "default") {
    // Skill-based sorting
    const [skillKey, direction] = filters.skillSort.split("_");
    filtered.sort((a, b) => {
      const lvlA = getQuestSkillLevel(a, skillKey);
      const lvlB = getQuestSkillLevel(b, skillKey);

      // Quests requiring this skill come first; 0 (not requiring) goes to the bottom
      if (lvlA === 0 && lvlB > 0) return 1;
      if (lvlB === 0 && lvlA > 0) return -1;
      if (lvlA === 0 && lvlB === 0) return 0;

      if (direction === "asc") {
        return lvlA - lvlB;
      } else {
        return lvlB - lvlA;
      }
    });
  }

  return filtered;
}

/**
 * Bind card interactions
 */
function bindQuestCardEvents(card, quest) {
  // Pin toggle
  const pinBtn = card.querySelector(".pin-btn");
  if (pinBtn) {
    pinBtn.addEventListener("click", () => {
      const isPinned = state.toggleQuestPin(quest.id);
      showToast(isPinned ? `Pinned "${quest.title}"` : `Unpinned "${quest.title}"`, "info");
    });
  }

  // Complete / Reopen button
  const statusBtn = card.querySelector(".toggle-status-btn");
  if (statusBtn) {
    statusBtn.addEventListener("click", () => {
      const newStatus = state.toggleQuestStatus(quest.id);
      if (newStatus === "completed") {
        showToast(`🎉 Quest "${quest.title}" marked as completed!`, "success");
      } else {
        showToast(`Quest "${quest.title}" reopened.`, "info");
      }
    });
  }

  // Edit button
  const editBtn = card.querySelector(".edit-quest-btn");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      openQuestModal(quest, (updatedData) => {
        state.updateQuest(quest.id, updatedData);
        showToast(`Quest "${updatedData.title}" updated!`, "success");
      });
    });
  }

  // Delete button
  const deleteBtn = card.querySelector(".delete-quest-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      if (confirm(`Are you sure you want to delete "${quest.title}"?`)) {
        state.deleteQuest(quest.id);
        showToast(`Deleted quest "${quest.title}"`, "info");
      }
    });
  }
}

/**
 * Material Planner Tab
 */
function renderPlannerTab() {
  const { element: plannerEl, materials, filteredQuests } = renderPlannerView(state);

  // Scope switcher
  plannerEl.querySelectorAll("[data-planner-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.setPlannerFilter(btn.dataset.plannerMode);
    });
  });

  // Copy Shopping List
  const copyBtn = plannerEl.querySelector("#copy-materials-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const text = formatMaterialsAsText(materials, `Farm RPG Checklist (${filteredQuests.length} Quests)`, state.inventoryCap);
      try {
        await navigator.clipboard.writeText(text);
        showToast("📋 Shopping checklist copied to clipboard!", "success");
      } catch (err) {
        // Fallback prompt if clipboard API blocked
        window.prompt("Copy your checklist below:", text);
      }
    });
  }

  // Bind inline Inventory Cap adjuster in Planner Header
  const capInput = plannerEl.querySelector("#planner-cap-input");
  if (capInput) {
    capInput.addEventListener("change", () => {
      const val = parseInt(capInput.value, 10);
      if (!isNaN(val) && val > 0) {
        state.setInventoryCap(val);
        showToast(`Inventory cap set to ${val.toLocaleString()}`, "info");
      } else {
        capInput.value = state.inventoryCap;
      }
    });
  }

  mainContent.appendChild(plannerEl);
}

/**
 * Settings & Backup Tab
 */
function renderSettingsTab() {
  const settingsEl = renderSettingsView(state);

  // Bind Inventory Cap Save
  const capInput = settingsEl.querySelector("#settings-cap-input");
  const saveCapBtn = settingsEl.querySelector("#settings-save-cap-btn");
  const handleCapSave = () => {
    if (!capInput) return;
    const val = parseInt(capInput.value, 10);
    if (!isNaN(val) && val > 0) {
      state.setInventoryCap(val);
      showToast(`Inventory cap updated to ${val.toLocaleString()}!`, "success");
    } else {
      showToast("Please enter a valid positive number for inventory cap.", "warning");
      capInput.value = state.inventoryCap;
    }
  };
  if (saveCapBtn) saveCapBtn.addEventListener("click", handleCapSave);
  if (capInput) {
    capInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleCapSave();
    });
  }

  // Export JSON
  const exportBtn = settingsEl.querySelector("#export-data-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      state.exportData();
      showToast("Backup file downloaded!", "success");
    });
  }

  // Import JSON
  const fileInput = settingsEl.querySelector("#import-data-file");
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const res = state.importData(event.target.result);
        if (res.success) {
          showToast(`Successfully imported ${res.count} quests!`, "success");
        } else {
          showToast(`Import failed: ${res.error}`, "warning");
        }
      };
      reader.readAsText(file);
    });
  }

  // Reset to Defaults
  const resetBtn = settingsEl.querySelector("#reset-defaults-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset and clear all quests and restore default settings? Your current changes will be overwritten unless exported.")) {
        state.resetToDefaults();
        showToast("Cleared all quests and reset settings!", "info");
      }
    });
  }

  mainContent.appendChild(settingsEl);
}

// Start application
document.addEventListener("DOMContentLoaded", initApp);

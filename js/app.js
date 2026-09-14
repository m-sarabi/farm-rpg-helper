import { state } from "./state.js";
import { NPC_LIST, KNOWN_ITEM_NAMES, getItemIcon } from "./quests-data.js";
import { formatMaterialsAsText, aggregateMaterials } from "./calculator.js";
import { fetchBuddyFarmAllQuests } from "./buddy-fetch.js";
import {
  renderQuestCard,
  renderPlannerView,
  renderSettingsView,
  renderPlayerLevelsBar,
  getEventTimeline,
  showToast
} from "./components.js";

// DOM References
const mainContent = document.getElementById("main-content");
const navTabs = document.querySelectorAll(".nav-tab");
const statActiveCount = document.getElementById("stat-active-count");
const statCompletedCount = document.getElementById("stat-completed-count");
const badgeQuestCount = document.getElementById("badge-quest-count");
const badgeEventsCount = document.getElementById("badge-events-count");
const badgePlannerCount = document.getElementById("badge-planner-count");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
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
  const normalQuests = state.quests.filter(q => !state.isEventQuest(q));
  const availableQuests = normalQuests.filter(q => state.isQuestAvailable(q));
  const completedQuests = normalQuests.filter(q => state.isQuestCompleted(q));
  const pinnedActiveQuests = state.quests.filter(q => q.pinned && q.status === "active");

  const eventQuests = state.quests.filter(q => state.isEventQuest(q));
  const now = new Date();
  const activeEvents = eventQuests.filter(q => {
    const tl = getEventTimeline(q, now);
    return tl && tl.status === "active_now" && q.status === "active";
  });

  if (statActiveCount) statActiveCount.textContent = `${availableQuests.length} Ready`;
  if (statCompletedCount) statCompletedCount.textContent = `${completedQuests.length} Completed`;

  if (badgeQuestCount) badgeQuestCount.textContent = availableQuests.length;
  if (badgeEventsCount) badgeEventsCount.textContent = activeEvents.length;
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
    case "events":
      renderEventsView();
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

function getMaxRewardAmount(quest) {
  if (!quest || !quest.rewards || !Array.isArray(quest.rewards)) return 0;
  let max = 0;
  for (const rew of quest.rewards) {
    const amount = parseInt(rew.amount, 10) || 0;
    if (amount > max) max = amount;
  }
  return max;
}

function getRewardOptionText(item) {
  if (item === "Silver") return "🪙 Silver";
  if (item === "Gold") return "✨ Gold";
  const icon = getItemIcon(item);
  return `${icon && icon !== "📦" ? icon + " " : "🎁 "}${item}`;
}

/**
 * Quests View (Player Levels bar, Toolbar, Cards)
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

  // 1. Toolbar
  const toolbar = document.createElement("div");
  toolbar.className = "quests-toolbar";

  const normalQuests = state.quests.filter(q => !state.isEventQuest(q));
  const activeNpcs = Array.from(new Set([...NPC_LIST, ...normalQuests.map(q => q.npc)])).sort();
  const activeRewards = getAvailableRewardItems(normalQuests);
  if (state.filters.rewardItem && state.filters.rewardItem !== "all" && !activeRewards.includes(state.filters.rewardItem)) {
    activeRewards.push(state.filters.rewardItem);
  }

  toolbar.innerHTML = `
    <div class="toolbar-top-row">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="quest-search-input" class="search-input" placeholder="Search quests by title, questline, NPC, or item..." value="${state.filters.search}" />
      </div>
      <button type="button" class="btn btn-outline btn-sm btn-quick-settings" id="btn-goto-settings-skills" title="Configure Skills & Friendships in Settings">
        <span>⚙️</span>
        <span>Skills & Friendships</span>
      </button>
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
          <option value="tower_asc" ${state.filters.skillSort === 'tower_asc' ? 'selected' : ''}>🗼 Tower (Low to High)</option>
          <option value="tower_desc" ${state.filters.skillSort === 'tower_desc' ? 'selected' : ''}>🗼 Tower (High to Low)</option>
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

  const btnGoSettings = toolbar.querySelector("#btn-goto-settings-skills");
  if (btnGoSettings) {
    btnGoSettings.addEventListener("click", () => switchTab("settings"));
  }

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
  const normalQuests = state.quests.filter(q => !state.isEventQuest(q));
  if (pillsContainer) {
    const availableCount = normalQuests.filter(q => state.isQuestAvailable(q)).length;
    const completedCount = normalQuests.filter(q => state.isQuestCompleted(q)).length;
    const lockedCount = normalQuests.filter(q => !state.isQuestCompleted(q) && !state.isQuestAvailable(q)).length;
    const allCount = normalQuests.length;

    pillsContainer.innerHTML = `
      <button class="filter-pill ${state.filters.status === 'available' ? 'active' : ''}" data-status="available">
        ✨ Ready / Available (${availableCount})
      </button>
      <button class="filter-pill ${state.filters.status === 'completed' ? 'active' : ''}" data-status="completed">
        ✓ Completed (${completedCount})
      </button>
      <button class="filter-pill ${state.filters.status === 'locked' ? 'active' : ''}" data-status="locked">
        🔒 Locked (${lockedCount})
      </button>
      <button class="filter-pill ${state.filters.status === 'all' ? 'active' : ''}" data-status="all">
        All (${allCount})
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
    const activeRewards = getAvailableRewardItems(normalQuests);
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
    const filteredQuests = filterQuests(normalQuests, state.filters);
    grid.innerHTML = "";

    if (normalQuests.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-icon">
            <img src="assets/Corn.png" alt="Empty" class="empty-state-img" />
          </div>
          <h3>No Quests Loaded Yet</h3>
          <p>Sync all 2,487 official quests directly from buddy.farm to get started!</p>
          <button class="btn btn-primary" id="btn-empty-import" style="margin-top: 1rem;">
            🌐 Import Quests from buddy.farm
          </button>
        </div>
      `;
      const btnEmptyImport = grid.querySelector("#btn-empty-import");
      if (btnEmptyImport) {
        btnEmptyImport.addEventListener("click", () => {
          switchTab("settings");
          const syncBtn = document.getElementById("btn-sync-buddy-quests");
          if (syncBtn) syncBtn.scrollIntoView({ behavior: "smooth" });
        });
      }
    } else if (filteredQuests.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-icon">
            <img src="assets/Corn.png" alt="Empty" class="empty-state-img" />
          </div>
          <h3>No Quests Found</h3>
          <p>No quests match your current filter or level requirements. Try adjusting your skill levels in the bar above or changing filters.</p>
        </div>
      `;
    } else {
      // Render capped batch for performance (or all if under 150)
      filteredQuests.forEach(quest => {
        const card = renderQuestCard(quest, state);
        bindQuestCardEvents(card, quest);
        grid.appendChild(card);
      });
    }
  }
}

function getQuestSkillLevel(quest, skillKey) {
  if (skillKey === "tower") return quest.towerLevel || 0;
  if (skillKey === "friendship") return quest.requiredNpcLevel || 0;
  if (quest.skills && quest.skills[skillKey] !== undefined) {
    return parseInt(quest.skills[skillKey], 10) || 0;
  }
  return 0;
}

/**
 * Filter and sort logic
 */
function filterQuests(quests, filters) {
  const filtered = quests.filter(q => {
    // Status Filter (Available, Completed, Locked, All)
    if (filters.status === "available") {
      if (!state.isQuestAvailable(q)) return false;
    } else if (filters.status === "completed") {
      if (!state.isQuestCompleted(q)) return false;
    } else if (filters.status === "locked") {
      if (state.isQuestCompleted(q) || state.isQuestAvailable(q)) return false;
    }

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
      const inQl = (q.questline || "").toLowerCase().includes(query);
      const inDesc = (q.description || "").toLowerCase().includes(query);
      const inReqs = (q.requirements || []).some(r => r.item.toLowerCase().includes(query));
      const inRewards = (q.rewards || []).some(r => (r.item || r.label || r.type || "").toLowerCase().includes(query));
      if (!inTitle && !inNpc && !inQl && !inDesc && !inReqs && !inRewards) {
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

      if (lvlA === 0 && lvlB > 0) return 1;
      if (lvlB === 0 && lvlA > 0) return -1;
      if (lvlA === 0 && lvlB === 0) return 0;

      if (direction === "asc") {
        return lvlA - lvlB;
      } else {
        return lvlB - lvlA;
      }
    });
  } else {
    // Default sort: Group by questline, then stepNumber, then title
    filtered.sort((a, b) => {
      if (a.questline && b.questline) {
        if (a.questline !== b.questline) return a.questline.localeCompare(b.questline);
        return (a.stepNumber || 1) - (b.stepNumber || 1);
      }
      if (a.questline && !b.questline) return -1;
      if (!a.questline && b.questline) return 1;
      return a.title.localeCompare(b.title);
    });
  }

  return filtered;
}

/**
 * Bind card interactions (Pin and Complete/Reopen)
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
        showToast(`🎉 "${quest.title}" marked as completed!`, "success");
      } else {
        showToast(`"${quest.title}" reopened.`, "info");
      }
    });
  }

  // Missed / Unmark Missed button
  const missedBtn = card.querySelector(".toggle-missed-btn");
  if (missedBtn) {
    missedBtn.addEventListener("click", () => {
      const newStatus = state.toggleQuestMissed(quest.id);
      if (newStatus === "missed") {
        showToast(`❌ "${quest.title}" marked as missed.`, "info");
      } else {
        showToast(`"${quest.title}" reopened.`, "info");
      }
    });
  }
}

/**
 * Events View (Event Toolbar, Timeline filters, Year selector, Cards)
 */
function renderEventsView() {
  const existingView = document.getElementById("events-view-container");

  // If already mounted, update grid and toolbar states in-place to preserve search input focus
  if (existingView && mainContent.contains(existingView)) {
    updateEventsGridAndFilters(existingView);
    return;
  }

  const container = document.createElement("div");
  container.className = "events-view";
  container.id = "events-view-container";

  const eventQuests = state.quests.filter(q => state.isEventQuest(q));
  const activeNpcs = Array.from(new Set([...NPC_LIST, ...eventQuests.map(q => q.npc)])).sort();
  const activeRewards = getAvailableRewardItems(eventQuests);
  if (state.eventFilters.rewardItem && state.eventFilters.rewardItem !== "all" && !activeRewards.includes(state.eventFilters.rewardItem)) {
    activeRewards.push(state.eventFilters.rewardItem);
  }

  // Collect all unique years from event dates
  const yearsSet = new Set();
  eventQuests.forEach(q => {
    if (q.startDate) yearsSet.add(q.startDate.slice(0, 4));
    if (q.endDate) yearsSet.add(q.endDate.slice(0, 4));
  });
  const availableYears = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));

  // 1. Toolbar
  const toolbar = document.createElement("div");
  toolbar.className = "quests-toolbar events-toolbar";

  toolbar.innerHTML = `
    <div class="toolbar-top-row">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="event-search-input" class="search-input" placeholder="Search event quests by title, NPC, item..." value="${state.eventFilters.search}" />
      </div>
      <button type="button" class="btn btn-outline-danger btn-sm btn-quick-missed" id="btn-mark-expired-missed" title="Mark all uncompleted expired events as missed">
        <span>⚡</span>
        <span>Mark Expired as Missed</span>
      </button>
    </div>

    <div class="toolbar-filters">
      <div class="filter-pills" id="event-filter-pills-container">
        <!-- Rendered dynamically -->
      </div>

      <div class="filter-dropdown-group">
        <select class="filter-select" id="event-year-filter-select" title="Filter by Year">
          <option value="all" ${state.eventFilters.year === 'all' ? 'selected' : ''}>All Years</option>
          ${availableYears.map(yr => `
            <option value="${yr}" ${state.eventFilters.year === yr ? 'selected' : ''}>📅 Year ${yr}</option>
          `).join('')}
        </select>

        <select class="filter-select" id="event-npc-filter-select" title="Filter by NPC">
          <option value="all" ${state.eventFilters.npc === 'all' ? 'selected' : ''}>All NPCs</option>
          ${activeNpcs.map(npc => `
            <option value="${npc}" ${state.eventFilters.npc === npc ? 'selected' : ''}>${npc === 'Unknown' ? '❓' : '👤'} ${npc}</option>
          `).join('')}
        </select>

        <select class="filter-select" id="event-reward-filter-select" title="Filter by Reward Item">
          <option value="all" ${state.eventFilters.rewardItem === 'all' ? 'selected' : ''}>All Rewards</option>
          ${activeRewards.map(item => `
            <option value="${item}" ${state.eventFilters.rewardItem === item ? 'selected' : ''}>${getRewardOptionText(item)}</option>
          `).join('')}
        </select>

        <select class="filter-select" id="event-sort-select" title="Sort event quests">
          <option value="default" ${state.eventFilters.skillSort === 'default' ? 'selected' : ''}>Sort: Date (Newest first)</option>
          <option value="date_asc" ${state.eventFilters.skillSort === 'date_asc' ? 'selected' : ''}>Sort: Date (Oldest first)</option>
          <option value="reward_desc" ${state.eventFilters.skillSort === 'reward_desc' ? 'selected' : ''}>${state.eventFilters.rewardItem && state.eventFilters.rewardItem !== 'all' ? `🎁 ${state.eventFilters.rewardItem} (High to Low)` : '🎁 Reward Amount (High to Low)'}</option>
          <option value="reward_asc" ${state.eventFilters.skillSort === 'reward_asc' ? 'selected' : ''}>${state.eventFilters.rewardItem && state.eventFilters.rewardItem !== 'all' ? `🎁 ${state.eventFilters.rewardItem} (Low to High)` : '🎁 Reward Amount (Low to High)'}</option>
          <option value="farming_asc" ${state.eventFilters.skillSort === 'farming_asc' ? 'selected' : ''}>🌾 Farming Level</option>
          <option value="fishing_asc" ${state.eventFilters.skillSort === 'fishing_asc' ? 'selected' : ''}>🎣 Fishing Level</option>
          <option value="crafting_asc" ${state.eventFilters.skillSort === 'crafting_asc' ? 'selected' : ''}>🔨 Crafting Level</option>
          <option value="exploring_asc" ${state.eventFilters.skillSort === 'exploring_asc' ? 'selected' : ''}>🧭 Exploring Level</option>
        </select>
      </div>
    </div>
  `;

  // Bind Toolbar Events
  const searchInput = toolbar.querySelector("#event-search-input");
  let debounceTimeout;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      state.setEventFilters({ search: e.target.value });
    }, 120);
  });

  const yearSelect = toolbar.querySelector("#event-year-filter-select");
  yearSelect.addEventListener("change", (e) => {
    state.setEventFilters({ year: e.target.value });
  });

  const npcSelect = toolbar.querySelector("#event-npc-filter-select");
  npcSelect.addEventListener("change", (e) => {
    state.setEventFilters({ npc: e.target.value });
  });

  const rewardSelect = toolbar.querySelector("#event-reward-filter-select");
  rewardSelect.addEventListener("change", (e) => {
    state.setEventFilters({ rewardItem: e.target.value });
  });

  const sortSelect = toolbar.querySelector("#event-sort-select");
  sortSelect.addEventListener("change", (e) => {
    state.setEventFilters({ skillSort: e.target.value });
  });

  const btnMarkExpiredMissed = toolbar.querySelector("#btn-mark-expired-missed");
  if (btnMarkExpiredMissed) {
    btnMarkExpiredMissed.addEventListener("click", () => {
      const expiredActiveCount = state.quests.filter(q => {
        if (!state.isEventQuest(q) || q.status !== "active" || !q.endDate) return false;
        return new Date() > new Date(q.endDate);
      }).length;

      if (expiredActiveCount === 0) {
        showToast("No active expired events to mark as missed!", "info");
        return;
      }

      if (confirm(`Are you sure you want to mark all ${expiredActiveCount} expired event quests as missed?`)) {
        const marked = state.markExpiredEventsAsMissed();
        showToast(`Marked ${marked} expired event quests as missed!`, "info");
      }
    });
  }

  container.appendChild(toolbar);

  // Render Grid container
  const grid = document.createElement("div");
  grid.className = "quests-grid";
  grid.id = "events-grid-container";
  container.appendChild(grid);

  mainContent.appendChild(container);
  updateEventsGridAndFilters(container);
}

function updateEventsGridAndFilters(container) {
  const eventQuests = state.quests.filter(q => state.isEventQuest(q));
  const now = new Date();

  // Timeline pills counts
  const activeNowCount = eventQuests.filter(q => {
    const tl = getEventTimeline(q, now);
    return tl && tl.status === "active_now" && q.status === "active";
  }).length;
  const upcomingCount = eventQuests.filter(q => {
    const tl = getEventTimeline(q, now);
    return tl && tl.status === "upcoming" && q.status === "active";
  }).length;
  const expiredCount = eventQuests.filter(q => {
    const tl = getEventTimeline(q, now);
    return tl && tl.status === "expired" && q.status === "active";
  }).length;
  const completedCount = eventQuests.filter(q => q.status === "completed").length;
  const missedCount = eventQuests.filter(q => q.status === "missed").length;
  const allCount = eventQuests.length;

  const pillsContainer = container.querySelector("#event-filter-pills-container");
  if (pillsContainer) {
    pillsContainer.innerHTML = `
      <button class="filter-pill ${state.eventFilters.timeline === 'active_now' ? 'active' : ''}" data-timeline="active_now">
        🟢 Active Now (${activeNowCount})
      </button>
      <button class="filter-pill ${state.eventFilters.timeline === 'upcoming' ? 'active' : ''}" data-timeline="upcoming">
        ⏳ Upcoming (${upcomingCount})
      </button>
      <button class="filter-pill ${state.eventFilters.timeline === 'expired' ? 'active' : ''}" data-timeline="expired">
        ⌛ Expired (${expiredCount})
      </button>
      <button class="filter-pill ${state.eventFilters.timeline === 'completed' ? 'active' : ''}" data-timeline="completed">
        ✓ Completed (${completedCount})
      </button>
      <button class="filter-pill ${state.eventFilters.timeline === 'missed' ? 'active' : ''}" data-timeline="missed">
        ❌ Missed (${missedCount})
      </button>
      <button class="filter-pill ${state.eventFilters.timeline === 'all' ? 'active' : ''}" data-timeline="all">
        All (${allCount})
      </button>
    `;

    pillsContainer.querySelectorAll(".filter-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        state.setEventFilters({ timeline: pill.dataset.timeline });
      });
    });
  }

  // Sync Year select
  const yearSelect = container.querySelector("#event-year-filter-select");
  if (yearSelect && yearSelect.value !== state.eventFilters.year) {
    yearSelect.value = state.eventFilters.year;
  }

  // Sync NPC select
  const npcSelect = container.querySelector("#event-npc-filter-select");
  if (npcSelect && npcSelect.value !== state.eventFilters.npc) {
    npcSelect.value = state.eventFilters.npc;
  }

  // Sync Reward select
  const rewardSelect = container.querySelector("#event-reward-filter-select");
  if (rewardSelect) {
    const activeRewards = getAvailableRewardItems(eventQuests);
    if (state.eventFilters.rewardItem && state.eventFilters.rewardItem !== "all" && !activeRewards.includes(state.eventFilters.rewardItem)) {
      activeRewards.push(state.eventFilters.rewardItem);
    }
    const currentOptions = Array.from(rewardSelect.options).map(o => o.value);
    const targetOptions = ["all", ...activeRewards];
    const isMatch = currentOptions.length === targetOptions.length && currentOptions.every((v, i) => v === targetOptions[i]);

    if (!isMatch) {
      rewardSelect.innerHTML = `
        <option value="all" ${state.eventFilters.rewardItem === 'all' ? 'selected' : ''}>All Rewards</option>
        ${activeRewards.map(item => `
          <option value="${item}" ${state.eventFilters.rewardItem === item ? 'selected' : ''}>${getRewardOptionText(item)}</option>
        `).join('')}
      `;
    }
    if (rewardSelect.value !== state.eventFilters.rewardItem) {
      rewardSelect.value = state.eventFilters.rewardItem;
    }
  }

  // Sync Sort select
  const sortSelect = container.querySelector("#event-sort-select");
  if (sortSelect && sortSelect.value !== state.eventFilters.skillSort) {
    sortSelect.value = state.eventFilters.skillSort;
  }

  // Grid
  const grid = container.querySelector("#events-grid-container");
  if (grid) {
    const filteredEvents = filterEventQuests(eventQuests, state.eventFilters);
    grid.innerHTML = "";

    if (eventQuests.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-icon">
            <img src="assets/Corn.png" alt="Empty" class="empty-state-img" />
          </div>
          <h3>No Event Quests Loaded</h3>
          <p>Sync all official quests from buddy.farm in Settings to load event quests.</p>
        </div>
      `;
    } else if (filteredEvents.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-icon">
            <img src="assets/Corn.png" alt="Empty" class="empty-state-img" />
          </div>
          <h3>No Event Quests Found</h3>
          <p>No event quests match your current filter. Try selecting a different timeline status or year.</p>
        </div>
      `;
    } else {
      filteredEvents.forEach(quest => {
        const card = renderQuestCard(quest, state);
        bindQuestCardEvents(card, quest);
        grid.appendChild(card);
      });
    }
  }
}

/**
 * Filter and sort logic for Event Quests
 */
function filterEventQuests(quests, filters) {
  const now = new Date();
  const filtered = quests.filter(q => {
    const tl = getEventTimeline(q, now);

    // Timeline / Status filter
    if (filters.timeline === "active_now") {
      if (!tl || tl.status !== "active_now" || q.status === "completed" || q.status === "missed") {
        return false;
      }
    } else if (filters.timeline === "upcoming") {
      if (!tl || tl.status !== "upcoming" || q.status === "completed" || q.status === "missed") {
        return false;
      }
    } else if (filters.timeline === "expired") {
      if (!tl || tl.status !== "expired" || q.status === "completed" || q.status === "missed") {
        return false;
      }
    } else if (filters.timeline === "completed") {
      if (q.status !== "completed") return false;
    } else if (filters.timeline === "missed") {
      if (q.status !== "missed") return false;
    }

    // Year Filter
    if (filters.year && filters.year !== "all") {
      const startYear = q.startDate ? q.startDate.slice(0, 4) : "";
      const endYear = q.endDate ? q.endDate.slice(0, 4) : "";
      if (startYear !== filters.year && endYear !== filters.year) {
        return false;
      }
    }

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
      const inQl = (q.questline || "").toLowerCase().includes(query);
      const inDesc = (q.description || "").toLowerCase().includes(query);
      const inReqs = (q.requirements || []).some(r => r.item.toLowerCase().includes(query));
      const inRewards = (q.rewards || []).some(r => (r.item || r.label || r.type || "").toLowerCase().includes(query));
      if (!inTitle && !inNpc && !inQl && !inDesc && !inReqs && !inRewards) {
        return false;
      }
    }

    return true;
  });

  // Sorting
  if (filters.skillSort === "date_asc") {
    filtered.sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  } else if (filters.skillSort === "date_desc" || filters.skillSort === "default") {
    // Default for events: latest event first
    filtered.sort((a, b) => {
      const dateA = a.startDate || a.endDate || "";
      const dateB = b.startDate || b.endDate || "";
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return a.title.localeCompare(b.title);
    });
  } else if (filters.skillSort === "reward_desc" || filters.skillSort === "reward_asc") {
    const isDesc = filters.skillSort === "reward_desc";
    filtered.sort((a, b) => {
      const amtA = filters.rewardItem && filters.rewardItem !== "all"
        ? getQuestRewardAmount(a, filters.rewardItem)
        : getMaxRewardAmount(a);
      const amtB = filters.rewardItem && filters.rewardItem !== "all"
        ? getQuestRewardAmount(b, filters.rewardItem)
        : getMaxRewardAmount(b);

      if (amtA === 0 && amtB > 0) return 1;
      if (amtB === 0 && amtA > 0) return -1;
      if (amtA === 0 && amtB === 0) return a.title.localeCompare(b.title);

      if (amtA !== amtB) {
        return isDesc ? amtB - amtA : amtA - amtB;
      }
      return a.title.localeCompare(b.title);
    });
  } else if (filters.skillSort && filters.skillSort.includes("_")) {
    const [skillKey, direction] = filters.skillSort.split("_");
    filtered.sort((a, b) => {
      const lvlA = getQuestSkillLevel(a, skillKey);
      const lvlB = getQuestSkillLevel(b, skillKey);
      if (lvlA === 0 && lvlB > 0) return 1;
      if (lvlB === 0 && lvlA > 0) return -1;
      if (lvlA === 0 && lvlB === 0) return 0;
      return direction === "asc" ? lvlA - lvlB : lvlB - lvlA;
    });
  }

  return filtered;
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

  // 1. Bind buddy.farm Quests Sync Button
  const syncBtn = settingsEl.querySelector("#btn-sync-buddy-quests");
  const syncSpinner = settingsEl.querySelector("#buddy-sync-spinner");
  const syncBtnText = settingsEl.querySelector("#buddy-sync-btn-text");
  const syncFeedback = settingsEl.querySelector("#buddy-sync-feedback");

  function setSyncing(isSyncing, msg = "") {
    if (syncBtn) syncBtn.disabled = isSyncing;
    if (syncSpinner) {
      if (isSyncing) syncSpinner.classList.remove("is-hidden");
      else syncSpinner.classList.add("is-hidden");
    }
    if (syncBtnText) {
      syncBtnText.textContent = isSyncing ? msg || "Syncing..." : "📥 Import All Quests from buddy.farm";
    }
  }

  function showSyncFeedback(msg, type = "info") {
    if (!syncFeedback) return;
    syncFeedback.textContent = msg;
    syncFeedback.className = `buddy-sync-feedback feedback-${type}`;
    syncFeedback.classList.remove("is-hidden");
  }

  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      setSyncing(true, "Connecting to buddy.farm...");
      showSyncFeedback("Connecting to buddy.farm...", "info");

      try {
        const importedQuests = await fetchBuddyFarmAllQuests((progressMsg) => {
          if (syncBtnText) syncBtnText.textContent = progressMsg;
          showSyncFeedback(progressMsg, "info");
        });

        const res = state.importBuddyFarmQuests(importedQuests);
        setSyncing(false);
        showSyncFeedback(`✓ Successfully imported ${res.count} quests from buddy.farm!`, "success");
        showToast(`🎉 Imported ${res.count} quests from buddy.farm!`, "success");

        const statusLabel = settingsEl.querySelector("#sync-status-label");
        if (statusLabel) {
          statusLabel.textContent = `Last synced: ${new Date().toLocaleString()} (${res.count} quests loaded)`;
        }
      } catch (err) {
        setSyncing(false);
        showSyncFeedback(`⚠️ Failed to import from buddy.farm: ${err.message}`, "error");
        showToast(`Sync failed: ${err.message}`, "warning");
      }
    });
  }

  // 2. Bind Player Skills Form
  const saveLevelsBtn = settingsEl.querySelector("#settings-save-levels-btn");
  const maxLevelsBtn = settingsEl.querySelector("#settings-max-levels-btn");
  const zeroLevelsBtn = settingsEl.querySelector("#settings-zero-levels-btn");

  function readLevelsFromInputs() {
    const updated = {};
    settingsEl.querySelectorAll(".settings-level-input").forEach(input => {
      const skill = input.dataset.skill;
      const val = parseInt(input.value, 10);
      updated[skill] = !isNaN(val) && val >= 0 ? val : 0;
    });
    return updated;
  }

  if (saveLevelsBtn) {
    saveLevelsBtn.addEventListener("click", () => {
      const levels = readLevelsFromInputs();
      state.setPlayerLevels(levels);
      showToast("Player skills saved successfully!", "success");
    });
  }

  if (maxLevelsBtn) {
    maxLevelsBtn.addEventListener("click", () => {
      const maxSkills = {
        farming: 99,
        fishing: 99,
        crafting: 99,
        exploring: 99,
        cooking: 99,
        mining: 99,
        tower: 320
      };
      state.setPlayerLevels(maxSkills);
      settingsEl.querySelectorAll(".settings-level-input").forEach(input => {
        const skill = input.dataset.skill;
        if (maxSkills[skill] !== undefined) input.value = maxSkills[skill];
      });
      showToast("All skills set to max (99 / Tower 320)!", "success");
    });
  }

  if (zeroLevelsBtn) {
    zeroLevelsBtn.addEventListener("click", () => {
      const zeroSkills = {
        farming: 0,
        fishing: 0,
        crafting: 0,
        exploring: 0,
        cooking: 0,
        mining: 0,
        tower: 0
      };
      state.setPlayerLevels(zeroSkills);
      settingsEl.querySelectorAll(".settings-level-input").forEach(input => {
        input.value = 0;
      });
      showToast("All skills locked (0)!", "info");
    });
  }

  // 3. Bind Townsfolk Friendships Form
  const saveFriendshipsBtn = settingsEl.querySelector("#settings-save-friendships-btn");
  const maxFriendshipsBtn = settingsEl.querySelector("#settings-max-friendships-btn");
  const zeroFriendshipsBtn = settingsEl.querySelector("#settings-zero-friendships-btn");
  const npcSearchInput = settingsEl.querySelector("#settings-npc-search-input");

  function readFriendshipsFromInputs() {
    const updated = {};
    settingsEl.querySelectorAll(".settings-npc-input").forEach(input => {
      const npc = input.dataset.npc;
      const val = parseInt(input.value, 10);
      updated[npc] = !isNaN(val) && val >= 0 ? Math.min(99, val) : 0;
    });
    return updated;
  }

  function updateNpcCardBadges() {
    settingsEl.querySelectorAll(".settings-npc-card").forEach(card => {
      const input = card.querySelector(".settings-npc-input");
      const statusEl = card.querySelector(".npc-card-status");
      if (input && statusEl) {
        const val = parseInt(input.value, 10) || 0;
        if (val === 0) {
          card.classList.add("is-locked-npc");
          statusEl.textContent = "🔒 Locked (0)";
          statusEl.className = "npc-card-status status-locked";
        } else {
          card.classList.remove("is-locked-npc");
          statusEl.textContent = `Level ${val}`;
          statusEl.className = "npc-card-status status-active";
        }
      }
    });
  }

  // Live input changes update card badge styling immediately
  settingsEl.querySelectorAll(".settings-npc-input").forEach(input => {
    input.addEventListener("input", updateNpcCardBadges);
  });

  if (saveFriendshipsBtn) {
    saveFriendshipsBtn.addEventListener("click", () => {
      const friendships = readFriendshipsFromInputs();
      state.setNpcFriendships(friendships);
      updateNpcCardBadges();
      showToast("Townsfolk friendships saved successfully!", "success");
    });
  }

  if (maxFriendshipsBtn) {
    maxFriendshipsBtn.addEventListener("click", () => {
      const allMax = {};
      settingsEl.querySelectorAll(".settings-npc-input").forEach(input => {
        input.value = 99;
        allMax[input.dataset.npc] = 99;
      });
      state.setNpcFriendships(allMax);
      updateNpcCardBadges();
      showToast("All 24 NPC friendships set to 99!", "success");
    });
  }

  if (zeroFriendshipsBtn) {
    zeroFriendshipsBtn.addEventListener("click", () => {
      const allZero = {};
      settingsEl.querySelectorAll(".settings-npc-input").forEach(input => {
        input.value = 0;
        allZero[input.dataset.npc] = 0;
      });
      state.setNpcFriendships(allZero);
      updateNpcCardBadges();
      showToast("All NPC friendships locked (0)!", "info");
    });
  }

  // Live NPC search filter
  if (npcSearchInput) {
    npcSearchInput.addEventListener("input", () => {
      const term = npcSearchInput.value.toLowerCase().trim();
      settingsEl.querySelectorAll(".settings-npc-card").forEach(card => {
        const name = card.dataset.npcName || "";
        if (!term || name.includes(term)) {
          card.style.display = "";
        } else {
          card.style.display = "none";
        }
      });
    });
  }

  // 3. Bind Inventory Cap Save
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

  // 4. Export JSON
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

  // 5. Reset to Defaults
  const resetBtn = settingsEl.querySelector("#reset-defaults-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset completed quests and set all player levels to 0 (locked)?")) {
        state.resetToDefaults();
        showToast("Progress reset and levels restored to 0!", "info");
      }
    });
  }

  mainContent.appendChild(settingsEl);
}

// Start application
document.addEventListener("DOMContentLoaded", initApp);

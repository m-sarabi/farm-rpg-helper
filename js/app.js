import { state } from "./state.js";
import { NPC_LIST, KNOWN_ITEM_NAMES } from "./quests-data.js";
import { isQuestReady, formatMaterialsAsText, aggregateMaterials } from "./calculator.js";
import { attachItemAutocomplete } from "./autocomplete.js";
import {
  renderQuestCard,
  renderPlannerView,
  renderInventoryView,
  renderInventoryCardsHtml,
  renderSettingsView,
  openQuestModal,
  closeModal,
  showToast
} from "./components.js";

// DOM References
const mainContent = document.getElementById("main-content");
const navTabs = document.querySelectorAll(".nav-tab");
const statActiveCount = document.getElementById("stat-active-count");
const statReadyCount = document.getElementById("stat-ready-count");
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
  const readyQuests = activeQuests.filter(q => isQuestReady(q, state.inventory));
  const pinnedActiveQuests = activeQuests.filter(q => q.pinned);

  statActiveCount.textContent = `${activeQuests.length} Active`;
  statReadyCount.textContent = `${readyQuests.length} Ready ✨`;

  badgeQuestCount.textContent = activeQuests.length;
  badgePlannerCount.textContent = pinnedActiveQuests.length;
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
    case "inventory":
      renderInventoryTab();
      break;
    case "settings":
      renderSettingsTab();
      break;
    default:
      renderQuestsView();
  }
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

      <div class="filter-dropdown-group" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
        <select class="filter-select" id="npc-filter-select" title="Filter by NPC">
          <option value="all" ${state.filters.npc === 'all' ? 'selected' : ''}>All NPCs</option>
          ${activeNpcs.map(npc => `
            <option value="${npc}" ${state.filters.npc === npc ? 'selected' : ''}>${npc === 'Unknown' ? '❓' : '👤'} ${npc}</option>
          `).join('')}
        </select>

        <select class="filter-select" id="skill-sort-select" title="Sort quests by skill level">
          <option value="default" ${state.filters.skillSort === 'default' ? 'selected' : ''}>Sort: Default</option>
          <option value="farming_asc" ${state.filters.skillSort === 'farming_asc' ? 'selected' : ''}>Farming (Low to High)</option>
          <option value="farming_desc" ${state.filters.skillSort === 'farming_desc' ? 'selected' : ''}>Farming (High to Low)</option>
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
    const readyCount = state.quests.filter(q => q.status === 'active' && isQuestReady(q, state.inventory)).length;
    const completedCount = state.quests.filter(q => q.status === 'completed').length;
    const allCount = state.quests.length;

    pillsContainer.innerHTML = `
      <button class="filter-pill ${state.filters.status === 'active' ? 'active' : ''}" data-status="active">
        Active (${activeCount})
      </button>
      <button class="filter-pill ${state.filters.status === 'ready' ? 'active' : ''}" data-status="ready">
        Ready to Turn In ✨ (${readyCount})
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
  const skillSortSelect = container.querySelector("#skill-sort-select");
  if (skillSortSelect && skillSortSelect.value !== state.filters.skillSort) {
    skillSortSelect.value = state.filters.skillSort;
  }

  // Update Grid cards
  const grid = container.querySelector("#quests-grid-container");
  if (grid) {
    const filteredQuests = filterQuests(state.quests, state.filters, state.inventory);
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
function filterQuests(quests, filters, inventory) {
  const filtered = quests.filter(q => {
    // Status Filter
    if (filters.status === "active" && q.status !== "active") return false;
    if (filters.status === "completed" && q.status !== "completed") return false;
    if (filters.status === "ready") {
      if (q.status !== "active" || !isQuestReady(q, inventory)) return false;
    }

    // NPC Filter
    if (filters.npc !== "all" && q.npc.toLowerCase() !== filters.npc.toLowerCase()) {
      return false;
    }

    // Search Filter
    if (filters.search) {
      const query = filters.search.toLowerCase().trim();
      const inTitle = q.title.toLowerCase().includes(query);
      const inNpc = q.npc.toLowerCase().includes(query);
      const inDesc = (q.description || "").toLowerCase().includes(query);
      const inReqs = (q.requirements || []).some(r => r.item.toLowerCase().includes(query));
      if (!inTitle && !inNpc && !inDesc && !inReqs) {
        return false;
      }
    }

    return true;
  });

  // Skill-based sorting
  if (filters.skillSort && filters.skillSort !== "default") {
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
      const text = formatMaterialsAsText(materials, `Farm RPG Checklist (${filteredQuests.length} Quests)`);
      try {
        await navigator.clipboard.writeText(text);
        showToast("📋 Shopping checklist copied to clipboard!", "success");
      } catch (err) {
        // Fallback prompt if clipboard API blocked
        window.prompt("Copy your checklist below:", text);
      }
    });
  }

  // Bind inline inventory adjustments on material cards
  plannerEl.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = btn.dataset.item;
      if (btn.dataset.target !== undefined) {
        // Set Full target
        state.setInventoryItem(item, parseInt(btn.dataset.target, 10) || 0);
        showToast(`Set ${item} to required amount!`, "success");
      } else if (btn.dataset.delta !== undefined) {
        const delta = parseInt(btn.dataset.delta, 10);
        state.adjustInventoryItem(item, delta);
      }
    });
  });

  plannerEl.querySelectorAll(".mat-inv-input").forEach(input => {
    input.addEventListener("change", () => {
      const item = input.dataset.item;
      const val = parseInt(input.value, 10) || 0;
      state.setInventoryItem(item, val);
    });
  });

  mainContent.appendChild(plannerEl);
}

let currentInventorySearchQuery = "";

/**
 * Inventory / Bag Tab
 */
function renderInventoryTab() {
  const invEl = renderInventoryView(state);

  // Quick Add / Update form
  const nameInput = invEl.querySelector("#quick-inv-name");
  const qtyInput = invEl.querySelector("#quick-inv-qty");
  const submitBtn = invEl.querySelector("#quick-inv-submit");
  const searchInput = invEl.querySelector("#inv-search-input");
  const gridContainer = invEl.querySelector("#inventory-grid-container");
  const countPill = invEl.querySelector("#inv-count-pill");

  // Attach dedicated item autocomplete dropdown
  if (nameInput) {
    attachItemAutocomplete(nameInput, {
      onSelect: () => {
        if (qtyInput) qtyInput.focus();
      }
    });
  }

  const handleQuickAdd = () => {
    const name = nameInput.value.trim();
    const qty = parseInt(qtyInput.value, 10);
    if (!name) {
      showToast("Please enter an item name.", "warning");
      return;
    }
    state.setInventoryItem(name, isNaN(qty) ? 1 : qty);
    showToast(`Updated bag: ${name} = ${state.inventory[name] || 0}`, "success");
    nameInput.value = "";
    qtyInput.value = "";
    nameInput.focus();
  };

  if (submitBtn) submitBtn.addEventListener("click", handleQuickAdd);
  if (qtyInput) {
    qtyInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleQuickAdd();
    });
  }

  // Bind inventory card controls (adjusters + delete buttons)
  function bindInventoryCardControls(container) {
    container.querySelectorAll(".qty-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = btn.dataset.item;
        const delta = parseInt(btn.dataset.delta, 10) || 0;
        state.adjustInventoryItem(item, delta);
      });
    });

    container.querySelectorAll(".inv-direct-input").forEach(input => {
      input.addEventListener("change", () => {
        const item = input.dataset.item;
        const val = parseInt(input.value, 10) || 0;
        state.setInventoryItem(item, val);
      });
    });

    container.querySelectorAll(".btn-delete-inv").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = btn.dataset.item;
        if (confirm(`Remove "${item}" from your Farm Bag?`)) {
          state.setInventoryItem(item, 0);
          showToast(`Removed "${item}" from Farm Bag`, "info");
        }
      });
    });
  }

  // Live filter inventory items by search query
  function filterAndRenderInventoryGrid() {
    const query = (searchInput ? searchInput.value : currentInventorySearchQuery).trim().toLowerCase();
    currentInventorySearchQuery = searchInput ? searchInput.value : "";

    const allItemNames = new Set(Object.keys(state.inventory));
    for (const q of state.quests) {
      for (const r of q.requirements || []) {
        if (r.item) allItemNames.add(r.item.trim());
      }
    }
    let items = Array.from(allItemNames).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    if (query) {
      items = items.filter(name => name.toLowerCase().includes(query));
    }

    if (gridContainer) {
      gridContainer.innerHTML = renderInventoryCardsHtml(items, state);
      bindInventoryCardControls(gridContainer);
    }
    if (countPill) {
      countPill.textContent = `${items.length} ${items.length === 1 ? 'Item' : 'Items'}`;
    }
  }

  if (searchInput) {
    searchInput.value = currentInventorySearchQuery;
    searchInput.addEventListener("input", filterAndRenderInventoryGrid);
  }

  // Initial binding of card controls
  if (gridContainer) {
    if (currentInventorySearchQuery) {
      filterAndRenderInventoryGrid();
    } else {
      bindInventoryCardControls(gridContainer);
    }
  }

  // Clear All
  const clearBtn = invEl.querySelector("#clear-all-inventory-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to reset all item counts in your bag to 0?")) {
        state.inventory = {};
        state.saveInventory();
        state.notify();
        showToast("Bag inventory cleared.", "info");
      }
    });
  }

  mainContent.appendChild(invEl);
}

/**
 * Settings & Backup Tab
 */
function renderSettingsTab() {
  const settingsEl = renderSettingsView(state);

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
      if (confirm("Reset and clear all quests and farm bag inventory? Your current changes will be overwritten unless exported.")) {
        state.resetToDefaults();
        showToast("Cleared all quests and inventory!", "info");
      }
    });
  }

  mainContent.appendChild(settingsEl);
}

// Start application
document.addEventListener("DOMContentLoaded", initApp);

import { getItemIcon, renderItemIconHtml, getSkillIconHtml, NPC_LIST, KNOWN_ITEM_NAMES } from "./quests-data.js";
import { getQuestRequirementsStatus, aggregateMaterials, aggregateRewards, formatMaterialsAsText } from "./calculator.js";
import { attachItemAutocomplete } from "./autocomplete.js";
import { fetchBuddyFarmQuest } from "./buddy-fetch.js";

/**
 * Creates and displays a floating toast notification.
 */
export function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;

  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.remove();
  });

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-fadeout");
    setTimeout(() => toast.remove(), 300);
  }, 2700);
}

/**
 * Render single quest card HTML
 */
export function renderQuestCard(quest, state) {
  const reqStatus = getQuestRequirementsStatus(quest);
  const isCompleted = quest.status === "completed";

  const card = document.createElement("div");
  card.className = `quest-card ${isCompleted ? "is-completed" : ""} ${quest.pinned ? "is-pinned" : ""}`;
  card.dataset.questId = quest.id;

  // Requirements HTML
  const reqsHtml = reqStatus.map(req => {
    return `
      <div class="req-item">
        <div class="req-item-left">
          <span class="req-item-slot">${renderItemIconHtml(req.item, "icon-md")}</span>
          <span class="req-item-name" title="${req.item}">${req.item}</span>
        </div>
        <div class="req-item-right">
          <span class="req-qty-badge">× ${req.amount.toLocaleString()}</span>
        </div>
      </div>
    `;
  }).join("");

  // Skills Level Badges
  const skillItems = [];
  const skillNames = {
    farming: "Farming",
    fishing: "Fishing",
    crafting: "Crafting",
    exploring: "Exploring",
    cooking: "Cooking",
    mining: "Mining"
  };

  if (quest.skills && typeof quest.skills === "object") {
    for (const [sKey, sVal] of Object.entries(quest.skills)) {
      const lvl = parseInt(sVal, 10) || 0;
      if (lvl > 0) {
        skillItems.push(`
          <span class="prereq-chip" title="${skillNames[sKey] || sKey} requirement: Level ${lvl}">
            ${getSkillIconHtml(sKey, "skill-icon-xs")}
            <span class="prereq-name">${skillNames[sKey] || sKey}</span>
            <span class="prereq-level">${lvl}</span>
          </span>
        `);
      }
    }
  }
  if (skillItems.length === 0 && quest.levelReq) {
    skillItems.push(`<span class="prereq-chip" title="Requirement">🎯 ${quest.levelReq}</span>`);
  }

  // Rewards HTML
  const rewardsHtml = (quest.rewards || []).map(rew => {
    const type = (rew.type || "").toLowerCase();
    const itemName = (rew.item || rew.label || "").trim();
    const amountStr = rew.amount ? Number(rew.amount).toLocaleString() : "";

    if (type === "silver" || itemName.toLowerCase() === "silver") {
      return `
        <span class="reward-pill badge-reward-silver" title="${amountStr} Silver">
          ${renderItemIconHtml("Silver", "icon-sm")}
          <span class="reward-val">${amountStr}</span>
          <span class="reward-label">Silver</span>
        </span>
      `;
    } else if (type === "gold" || itemName.toLowerCase() === "gold") {
      return `
        <span class="reward-pill badge-reward-gold" title="${amountStr} Gold">
          ${renderItemIconHtml("Gold", "icon-sm")}
          <span class="reward-val">${amountStr}</span>
          <span class="reward-label">Gold</span>
        </span>
      `;
    } else if (type === "xp") {
      return "";
    } else {
      return `
        <span class="reward-pill badge-reward-item" title="${amountStr ? amountStr + ' ' : ''}${itemName}">
          ${renderItemIconHtml(itemName, "icon-sm")}
          ${amountStr ? `<span class="reward-val">${amountStr}</span>` : ''}
          <span class="reward-label">${itemName}</span>
        </span>
      `;
    }
  }).filter(Boolean).join("");

  card.innerHTML = `
    <div class="quest-card-header">
      <div class="quest-meta-row">
        <div class="npc-badge" title="Quest Giver">
          <svg class="npc-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span class="npc-name">${quest.npc}</span>
        </div>
        <div class="quest-header-actions">
          ${isCompleted ? `
            <span class="completed-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Completed</span>
            </span>
          ` : ''}
          <button class="pin-btn ${quest.pinned ? 'pinned' : ''}" data-id="${quest.id}" title="${quest.pinned ? 'Unpin quest' : 'Pin quest'}" aria-label="${quest.pinned ? 'Unpin quest' : 'Pin quest'}">
            <svg class="pin-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
        </div>
      </div>

      <h3 class="quest-title">${quest.title}</h3>

      ${skillItems.length > 0 ? `
        <div class="quest-prereqs-bar">
          <span class="prereqs-label">Prerequisites:</span>
          <div class="prereqs-list">
            ${skillItems.join("")}
          </div>
        </div>
      ` : ''}
    </div>

    ${quest.description ? `<p class="quest-desc">${quest.description}</p>` : ''}

    <div class="quest-card-body">
      <div class="quest-section-header">
        <span class="quest-section-title">Requirements</span>
        <span class="quest-section-count">${reqStatus.length}</span>
      </div>
      <div class="quest-requirements-list">
        ${reqsHtml || '<p class="empty-text">No requirements specified.</p>'}
      </div>

      ${rewardsHtml ? `
        <div class="quest-section-header rewards-header">
          <span class="quest-section-title">Rewards</span>
        </div>
        <div class="quest-rewards-list">
          ${rewardsHtml}
        </div>
      ` : ''}
    </div>

    <div class="quest-card-footer">
      <div class="quest-actions-left">
        <button class="btn btn-sm btn-secondary edit-quest-btn" data-id="${quest.id}" title="Edit quest">
          <svg class="btn-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
          </svg>
          <span>Edit</span>
        </button>
        <button class="btn btn-sm btn-icon-only btn-ghost delete-quest-btn" data-id="${quest.id}" title="Delete quest" aria-label="Delete quest">
          <svg class="btn-icon delete-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
      <div class="quest-actions-right">
        <button class="btn btn-sm ${isCompleted ? 'btn-secondary' : 'btn-primary btn-complete'} toggle-status-btn" data-id="${quest.id}">
          ${isCompleted ? `
            <svg class="btn-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
            <span>Reopen</span>
          ` : `
            <svg class="btn-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Complete</span>
          `}
        </button>
      </div>
    </div>
  `;

  return card;
}

/**
 * Render the Planner view (materials breakdown & total requirements)
 */
export function renderPlannerView(state) {
  const container = document.createElement("div");
  container.className = "planner-view";

  // Filter quests based on plannerFilter mode (default: pinned)
  let filteredQuests = [];
  if (state.plannerFilter === "active") {
    filteredQuests = state.quests.filter(q => q.status === "active");
  } else {
    // "pinned" mode
    filteredQuests = state.quests.filter(q => q.pinned && q.status === "active");
  }

  const materials = aggregateMaterials(filteredQuests, state.inventoryCap);
  const rewards = aggregateRewards(filteredQuests);

  const totalItemsCount = materials.reduce((acc, m) => acc + m.totalRequired, 0);
  const overCapMaterials = materials.filter(m => m.exceedsCap);

  const pinnedActiveCount = state.quests.filter(q => q.pinned && q.status === "active").length;
  const allActiveCount = state.quests.filter(q => q.status === "active").length;

  container.innerHTML = `
    <div class="planner-header-card">
      <div class="planner-header-top">
        <div>
          <h2 class="view-heading">🧺 Total Material Planner</h2>
          <p class="view-subheading">Aggregate materials needed across your pinned Farm RPG quests</p>
        </div>
        <div class="planner-header-actions">
          <div class="planner-cap-box">
            <label class="planner-cap-label" for="planner-cap-input">🎒 Inventory Cap:</label>
            <input type="number" id="planner-cap-input" class="planner-cap-input" min="1" value="${state.inventoryCap}" title="Your maximum inventory capacity" />
          </div>
          <button class="btn btn-secondary btn-sm" id="copy-materials-btn" title="Copy shopping list to clipboard">
            📋 Copy Shopping List
          </button>
        </div>
      </div>

      <!-- Planner Scope Switcher -->
      <div class="planner-scope-bar">
        <div class="segmented-control">
          <button class="segment-btn ${state.plannerFilter === 'pinned' ? 'active' : ''}" data-planner-mode="pinned">
            ⭐ Pinned Only (${pinnedActiveCount})
          </button>
          <button class="segment-btn ${state.plannerFilter === 'active' ? 'active' : ''}" data-planner-mode="active">
            All Active (${allActiveCount})
          </button>
        </div>
      </div>

      <!-- Planner Summary Stat Badges -->
      <div class="planner-stats-grid">
        <div class="stat-card">
          <span class="stat-icon">📜</span>
          <div class="stat-info">
            <div class="stat-value">${filteredQuests.length}</div>
            <div class="stat-label">Quests in Scope</div>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">📦</span>
          <div class="stat-info">
            <div class="stat-value">${materials.length}</div>
            <div class="stat-label">Unique Materials</div>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🔢</span>
          <div class="stat-info">
            <div class="stat-value">${totalItemsCount.toLocaleString()}</div>
            <div class="stat-label">Total Items Needed</div>
          </div>
        </div>
        <div class="stat-card ${overCapMaterials.length > 0 ? 'stat-card-warning' : ''}">
          <span class="stat-icon">${overCapMaterials.length > 0 ? '⚠️' : '✅'}</span>
          <div class="stat-info">
            <div class="stat-value ${overCapMaterials.length > 0 ? 'color-warning' : 'color-success'}">${overCapMaterials.length}</div>
            <div class="stat-label">${overCapMaterials.length === 1 ? 'Item' : 'Items'} Over Cap</div>
          </div>
        </div>
      </div>

      <!-- Aggregate Rewards Banner (if any) -->
      ${(rewards.silver > 0 || rewards.gold > 0 || Object.keys(rewards.items).length > 0) ? `
        <div class="planner-rewards-banner">
          <span class="rewards-banner-title">Potential Rewards:</span>
          ${rewards.silver > 0 ? `<span class="reward-pill badge-reward-silver">${renderItemIconHtml("Silver", "icon-sm")} ${rewards.silver.toLocaleString()} Silver</span>` : ''}
          ${rewards.gold > 0 ? `<span class="reward-pill badge-reward-gold">${renderItemIconHtml("Gold", "icon-sm")} ${rewards.gold.toLocaleString()} Gold</span>` : ''}
          ${Object.entries(rewards.items).map(([name, qty]) => `
            <span class="reward-pill badge-reward-item">${renderItemIconHtml(name, "icon-sm")} ${qty}x ${name}</span>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <!-- Materials List -->
    <div class="materials-list-container">
      ${materials.length === 0 ? `
        <div class="empty-state-card">
          <div class="empty-icon">
            <img src="assets/Corn.png" alt="Empty" class="empty-state-img" />
          </div>
          <h3>No Quests in this Scope</h3>
          <p>Select some quests or switch to "All Active" to see aggregate material requirements.</p>
        </div>
      ` : `
        <div class="materials-grid">
          ${materials.map(mat => renderMaterialCardHtml(mat, state.inventoryCap)).join("")}
        </div>
      `}
    </div>
  `;

  return { element: container, materials, filteredQuests };
}

function renderMaterialCardHtml(mat, inventoryCap) {
  const isOverCap = mat.exceedsCap;
  return `
    <div class="material-card ${isOverCap ? 'mat-over-cap' : ''}" data-item-name="${mat.item}">
      <div class="mat-card-header">
        <div class="mat-title-box">
          <span class="mat-icon-slot">${renderItemIconHtml(mat.item, "icon-md")}</span>
          <div>
            <h4 class="mat-name">${mat.item}</h4>
            <div class="mat-sources-count" title="Used in ${mat.questSources.length} quest(s)">
              Used in ${mat.questSources.length} quest${mat.questSources.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>
        ${isOverCap ? `
          <span class="cap-warning-badge" title="Requirement of ${mat.totalRequired.toLocaleString()} exceeds your inventory cap of ${inventoryCap.toLocaleString()}">
            ⚠️ Exceeds Cap (+${mat.overBy.toLocaleString()})
          </span>
        ` : `
          <span class="mat-status-tag tag-within-cap">
            ✓ Within Cap
          </span>
        `}
      </div>

      <!-- Quantity Display -->
      <div class="mat-qty-display">
        <div class="mat-qty-main">
          <span class="mat-qty-num">${mat.totalRequired.toLocaleString()}</span>
          <span class="mat-qty-unit">needed</span>
        </div>
        ${isOverCap ? `
          <div class="mat-cap-warning-msg">
            <span>⚠️ Exceeds your inventory cap of <strong>${inventoryCap.toLocaleString()}</strong> by <strong>${mat.overBy.toLocaleString()}</strong>. Plan multiple trips or upgrade bag space.</span>
          </div>
        ` : ''}
      </div>

      <!-- Expandable Quests Breakdown -->
      <details class="mat-breakdown-accordion">
        <summary>View Quests Requiring This (${mat.questSources.length})</summary>
        <ul class="mat-sources-list">
          ${mat.questSources.map(q => `
            <li>
              <span class="source-quest-name">👤 ${q.npc}: <strong>${q.questTitle}</strong></span>
              <span class="source-amount">${q.amount.toLocaleString()} required</span>
            </li>
          `).join('')}
        </ul>
      </details>
    </div>
  `;
}

/**
 * Render Settings & Backup View
 */
export function renderSettingsView(state) {
  const container = document.createElement("div");
  container.className = "settings-view";

  container.innerHTML = `
    <div class="settings-card">
      <h2 class="view-heading">⚙️ App Settings & Backup</h2>
      <p class="view-subheading">Your quest progress and settings are saved in your browser's local storage.</p>

      <div class="settings-section">
        <h3>🎒 Inventory Cap</h3>
        <p>Set your maximum inventory capacity in Farm RPG. The Material Planner will display a subtle warning for any items that exceed this limit.</p>
        <div class="settings-cap-form">
          <input type="number" id="settings-cap-input" class="input-field" min="1" value="${state.inventoryCap}" style="max-width: 160px;" />
          <button class="btn btn-primary" id="settings-save-cap-btn">Save Cap</button>
        </div>
      </div>

      <div class="settings-section">
        <h3>💾 Backup & Portability</h3>
        <p>Save a copy of all your custom quests and settings to a JSON file, or restore on another device.</p>
        <div class="settings-buttons-row">
          <button class="btn btn-primary" id="export-data-btn">
            📥 Export Backup (JSON)
          </button>
          <label class="btn btn-secondary file-upload-btn">
            📤 Import Backup
            <input type="file" id="import-data-file" accept=".json" style="display: none;" />
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h3>🔄 Reset Data</h3>
        <p>Want to clear all quests and reset settings to defaults?</p>
        <button class="btn btn-danger" id="reset-defaults-btn">
          ⚠️ Reset & Clear All Data
        </button>
      </div>
    </div>
  `;

  return container;
}

let activeModalAutocompletes = [];

/**
 * Setup and populate the Add/Edit Quest Modal
 */
export function openQuestModal(questToEdit = null, onSave, focusBuddyLink = false) {
  let modal = document.getElementById("quest-modal");
  if (!modal) return;

  activeModalAutocompletes.forEach(ac => ac.destroy());
  activeModalAutocompletes = [];

  const titleEl = document.getElementById("modal-quest-title");
  const form = document.getElementById("quest-form");
  const reqContainer = document.getElementById("modal-requirements-list");
  const rewContainer = document.getElementById("modal-rewards-list");
  const npcSelect = document.getElementById("quest-npc-input");
  const titleInput = document.getElementById("quest-name-input");
  const descInput = document.getElementById("quest-desc-input");
  const pinnedInput = document.getElementById("quest-pinned-input");

  // Buddy.farm quick fetch elements
  const buddyUrlInput = document.getElementById("buddy-url-input");
  const buddyFetchBtn = document.getElementById("btn-fetch-buddy");
  const buddyFetchSpinner = document.getElementById("buddy-fetch-spinner");
  const buddyFetchBtnText = document.getElementById("buddy-fetch-btn-text");
  const buddyFetchFeedback = document.getElementById("buddy-fetch-feedback");

  function setFetchingState(isFetching) {
    if (buddyFetchBtn) buddyFetchBtn.disabled = isFetching;
    if (buddyFetchSpinner) {
      if (isFetching) buddyFetchSpinner.classList.remove("is-hidden");
      else buddyFetchSpinner.classList.add("is-hidden");
    }
    if (buddyFetchBtnText) {
      buddyFetchBtnText.textContent = isFetching ? "Fetching..." : "Fetch";
    }
  }

  function showFeedback(msg, type = "info") {
    if (!buddyFetchFeedback) return;
    buddyFetchFeedback.textContent = msg;
    buddyFetchFeedback.className = `buddy-fetch-feedback feedback-${type}`;
    buddyFetchFeedback.classList.remove("is-hidden");
  }

  // Reset buddy fetch controls
  if (buddyUrlInput) buddyUrlInput.value = "";
  if (buddyFetchFeedback) {
    buddyFetchFeedback.textContent = "";
    buddyFetchFeedback.className = "buddy-fetch-feedback is-hidden";
  }
  setFetchingState(false);

  // Populate NPC options if not yet populated
  if (npcSelect.options.length <= 1) {
    npcSelect.innerHTML = NPC_LIST.map(npc => `<option value="${npc}">${npc}</option>`).join("");
  }

  // Clear previous rows
  reqContainer.innerHTML = "";
  rewContainer.innerHTML = "";

  const isEdit = !!questToEdit;
  titleEl.textContent = isEdit ? "Edit Quest" : "Add New Quest";

  const SKILL_KEYS = ["farming", "fishing", "crafting", "exploring", "cooking", "mining"];
  const SKILL_NAMES = { farming: "Farming", fishing: "Fishing", crafting: "Crafting", exploring: "Exploring", cooking: "Cooking", mining: "Mining" };

  // Fill form fields
  titleInput.value = questToEdit?.title || "";
  npcSelect.value = questToEdit?.npc || "Buddy";
  descInput.value = questToEdit?.description || "";
  pinnedInput.checked = !!questToEdit?.pinned;

  // Level Prerequisites Accordion setup
  const skillsSummaryBadge = document.getElementById("skills-summary-badge");
  const accordion = document.getElementById("modal-skills-accordion");
  if (accordion) accordion.open = false;

  function updateSkillsSummary() {
    const activeSkills = [];
    SKILL_KEYS.forEach(k => {
      const input = document.getElementById(`skill-req-${k}`);
      const val = parseInt(input?.value, 10) || 0;
      if (val > 0) {
        activeSkills.push(`${SKILL_NAMES[k]} ${val}`);
      }
    });

    if (skillsSummaryBadge) {
      if (activeSkills.length === 0) {
        skillsSummaryBadge.textContent = "Not set (all 0)";
        skillsSummaryBadge.classList.remove("is-active");
      } else {
        skillsSummaryBadge.textContent = activeSkills.join(" • ");
        skillsSummaryBadge.classList.add("is-active");
      }
    }
  }

  SKILL_KEYS.forEach(k => {
    const input = document.getElementById(`skill-req-${k}`);
    if (input) {
      let val = 0;
      if (questToEdit?.skills && questToEdit.skills[k] !== undefined) {
        val = parseInt(questToEdit.skills[k], 10) || 0;
      } else if (questToEdit?.levelReq) {
        const match = questToEdit.levelReq.match(new RegExp(`${k}\\s*(\\d+)`, "i"));
        if (match) val = parseInt(match[1], 10) || 0;
      }
      input.value = val;
      input.oninput = updateSkillsSummary;
    }
  });
  updateSkillsSummary();

  // Add requirement row helper
  function addRequirementRow(item = "", amount = "") {
    const row = document.createElement("div");
    row.className = "modal-dynamic-row";
    row.innerHTML = `
      <input type="text" class="modal-req-item input-field" placeholder="Search item (e.g. Wood, Corn)" value="${item}" required />
      <input type="number" class="modal-req-amount input-field" placeholder="Qty" value="${amount}" min="1" required />
      <button type="button" class="btn btn-ghost btn-sm remove-row-btn" title="Remove requirement">✕</button>
    `;
    const itemInput = row.querySelector(".modal-req-item");
    const amountInput = row.querySelector(".modal-req-amount");
    const ac = attachItemAutocomplete(itemInput, {
      onSelect: () => amountInput.focus()
    });
    if (ac) activeModalAutocompletes.push(ac);

    row.querySelector(".remove-row-btn").addEventListener("click", () => {
      if (ac) ac.destroy();
      activeModalAutocompletes = activeModalAutocompletes.filter(x => x !== ac);
      row.remove();
    });
    reqContainer.appendChild(row);

    if (!item && !amount) {
      itemInput.focus();
      row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  // Add reward row helper (Silver & Gold have no labels; Item has item name input; XP removed)
  function addRewardRow(type = "silver", item = "", amount = "") {
    const row = document.createElement("div");
    row.className = "modal-dynamic-row";
    const isItem = type === "item";
    row.innerHTML = `
      <select class="modal-rew-type input-field">
        <option value="silver" ${type === 'silver' ? 'selected' : ''}>Silver</option>
        <option value="gold" ${type === 'gold' ? 'selected' : ''}>Gold</option>
        <option value="item" ${type === 'item' ? 'selected' : ''}>Item</option>
      </select>
      <input type="text" class="modal-rew-item input-field ${isItem ? '' : 'is-hidden'}" placeholder="Search item (e.g. Orange Juice)" value="${isItem ? item : ''}" ${isItem ? 'required' : ''} />
      <input type="number" class="modal-rew-amount input-field" placeholder="Amount" value="${amount}" min="1" required />
      <button type="button" class="btn btn-ghost btn-sm remove-row-btn" title="Remove reward">✕</button>
    `;
    const typeSelect = row.querySelector(".modal-rew-type");
    const itemInput = row.querySelector(".modal-rew-item");
    const amountInput = row.querySelector(".modal-rew-amount");
    const ac = attachItemAutocomplete(itemInput, {
      onSelect: () => amountInput.focus()
    });
    if (ac) activeModalAutocompletes.push(ac);

    typeSelect.addEventListener("change", () => {
      if (typeSelect.value === "item") {
        itemInput.classList.remove("is-hidden");
        itemInput.required = true;
        itemInput.focus();
      } else {
        itemInput.classList.add("is-hidden");
        itemInput.required = false;
        itemInput.value = "";
        if (ac) ac.close();
      }
    });
    row.querySelector(".remove-row-btn").addEventListener("click", () => {
      if (ac) ac.destroy();
      activeModalAutocompletes = activeModalAutocompletes.filter(x => x !== ac);
      row.remove();
    });
    rewContainer.appendChild(row);

    if (!item && !amount) {
      amountInput.focus();
      row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  // Populate existing requirements & rewards or clean defaults
  if (isEdit && questToEdit.requirements?.length > 0) {
    questToEdit.requirements.forEach(r => addRequirementRow(r.item, r.amount));
  } else {
    addRequirementRow("", "");
  }

  if (isEdit && questToEdit.rewards?.length > 0) {
    questToEdit.rewards.forEach(r => {
      const rewType = (r.type || "").toLowerCase();
      const isItem = rewType === "item" || (!["silver", "gold", "xp"].includes(rewType));
      const normalizedType = isItem ? "item" : rewType;
      if (normalizedType !== "xp") {
        addRewardRow(normalizedType, r.item || r.label || "", r.amount);
      }
    });
  } else {
    addRewardRow("silver", "", "");
  }

  // Handle buddy.farm fetch logic
  async function handleBuddyFetch() {
    const rawInput = buddyUrlInput ? buddyUrlInput.value.trim() : "";
    if (!rawInput) {
      showFeedback("Please paste a buddy.farm link or enter a quest slug (e.g. https://buddy.farm/q/not-from-around-here/).", "error");
      if (buddyUrlInput) buddyUrlInput.focus();
      return;
    }

    setFetchingState(true);
    showFeedback("Connecting to buddy.farm...", "info");

    try {
      const questData = await fetchBuddyFarmQuest(rawInput);

      // 1. Populate Title
      if (questData.title && titleInput) {
        titleInput.value = questData.title;
      }

      // 2. Populate NPC
      if (questData.npc && npcSelect) {
        const matchingOpt = Array.from(npcSelect.options).find(
          o => o.value.toLowerCase() === questData.npc.toLowerCase()
        );
        if (matchingOpt) {
          npcSelect.value = matchingOpt.value;
        } else {
          const opt = document.createElement("option");
          opt.value = questData.npc;
          opt.textContent = questData.npc;
          npcSelect.appendChild(opt);
          npcSelect.value = questData.npc;
        }
      }

      // 3. Populate Description
      if (descInput) {
        descInput.value = questData.description || "";
      }

      // 4. Populate Skills
      let hasSkills = false;
      SKILL_KEYS.forEach(k => {
        const input = document.getElementById(`skill-req-${k}`);
        if (input) {
          const lvl = questData.skills[k] || 0;
          input.value = lvl;
          if (lvl > 0) hasSkills = true;
        }
      });
      updateSkillsSummary();
      if (hasSkills && accordion) {
        accordion.open = true;
      }

      // 5. Populate Requirements
      activeModalAutocompletes.forEach(ac => ac.destroy());
      activeModalAutocompletes = [];
      reqContainer.innerHTML = "";
      if (questData.requirements && questData.requirements.length > 0) {
        questData.requirements.forEach(r => addRequirementRow(r.item, r.amount));
      } else {
        addRequirementRow("", "");
      }

      // 6. Populate Rewards
      rewContainer.innerHTML = "";
      if (questData.rewards && questData.rewards.length > 0) {
        questData.rewards.forEach(r => {
          const rewType = (r.type || "").toLowerCase();
          const isItem = rewType === "item" || (!["silver", "gold", "xp"].includes(rewType));
          const normalizedType = isItem ? "item" : rewType;
          addRewardRow(normalizedType, r.item || r.label || "", r.amount);
        });
      } else {
        addRewardRow("silver", "", "");
      }

      showFeedback(`✓ Loaded "${questData.title}" (${questData.requirements.length} requirements, ${questData.rewards.length} rewards)!`, "success");
      showToast(`🎉 Imported "${questData.title}" from buddy.farm!`, "success");
    } catch (err) {
      showFeedback(`⚠️ ${err.message || "Failed to fetch quest details"}`, "error");
    } finally {
      setFetchingState(false);
    }
  }

  if (buddyFetchBtn) {
    buddyFetchBtn.onclick = (e) => {
      e.preventDefault();
      handleBuddyFetch();
    };
  }

  if (buddyUrlInput) {
    buddyUrlInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleBuddyFetch();
      }
    };
  }

  // Auto-transfer if user pastes buddy.farm link into Title input
  if (titleInput) {
    titleInput.oninput = () => {
      const val = titleInput.value.trim();
      if (val.includes("buddy.farm/q/")) {
        if (buddyUrlInput) buddyUrlInput.value = val;
        titleInput.value = "";
        handleBuddyFetch();
      }
    };
  }

  // Bind add row buttons
  document.getElementById("modal-add-req-btn").onclick = () => addRequirementRow();
  document.getElementById("modal-add-rew-btn").onclick = () => addRewardRow();

  // Handle submit
  form.onsubmit = (e) => {
    e.preventDefault();

    const title = document.getElementById("quest-name-input").value.trim();
    const npc = document.getElementById("quest-npc-input").value.trim();
    const description = document.getElementById("quest-desc-input").value.trim();
    const pinned = document.getElementById("quest-pinned-input").checked;

    // Extract skills
    const skills = {};
    const skillLevelsText = [];
    SKILL_KEYS.forEach(k => {
      const input = document.getElementById(`skill-req-${k}`);
      const val = parseInt(input?.value, 10) || 0;
      skills[k] = val;
      if (val > 0) {
        skillLevelsText.push(`${SKILL_NAMES[k]} ${val}`);
      }
    });
    const levelReq = skillLevelsText.join(", ");

    // Extract requirements
    const reqRows = reqContainer.querySelectorAll(".modal-dynamic-row");
    const requirements = [];
    reqRows.forEach(row => {
      const item = row.querySelector(".modal-req-item").value.trim();
      const amount = parseInt(row.querySelector(".modal-req-amount").value, 10) || 0;
      if (item && amount > 0) {
        requirements.push({ item, amount });
      }
    });

    // Extract rewards
    const rewRows = rewContainer.querySelectorAll(".modal-dynamic-row");
    const rewards = [];
    rewRows.forEach(row => {
      const type = row.querySelector(".modal-rew-type").value;
      const amount = parseInt(row.querySelector(".modal-rew-amount").value, 10) || 0;
      if (amount > 0) {
        if (type === "silver") {
          rewards.push({ type: "silver", amount, label: "Silver" });
        } else if (type === "gold") {
          rewards.push({ type: "gold", amount, label: "Gold" });
        } else if (type === "item") {
          const item = row.querySelector(".modal-rew-item").value.trim();
          if (item) {
            rewards.push({ type: "item", item, label: item, amount });
          }
        }
      }
    });

    const questData = {
      title,
      npc,
      levelReq,
      skills,
      description,
      pinned,
      requirements,
      rewards
    };

    onSave(questData);
    closeModal();
  };

  // Open modal
  modal.classList.add("is-active");
  document.body.style.overflow = "hidden";

  if (focusBuddyLink && buddyUrlInput) {
    setTimeout(() => {
      buddyUrlInput.focus();
      buddyUrlInput.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }
}

export function closeModal() {
  const modal = document.getElementById("quest-modal");
  if (modal) {
    modal.classList.remove("is-active");
    document.body.style.overflow = "";
  }
  const buddyFetchFeedback = document.getElementById("buddy-fetch-feedback");
  if (buddyFetchFeedback) {
    buddyFetchFeedback.textContent = "";
    buddyFetchFeedback.className = "buddy-fetch-feedback is-hidden";
  }
  activeModalAutocompletes.forEach(ac => ac.destroy());
  activeModalAutocompletes = [];
}

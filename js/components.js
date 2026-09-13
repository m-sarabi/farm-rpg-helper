import { getItemIcon, renderItemIconHtml, NPC_LIST, KNOWN_ITEM_NAMES } from "./quests-data.js";
import { getQuestRequirementsStatus, aggregateMaterials, aggregateRewards, formatMaterialsAsText } from "./calculator.js";
import { attachItemAutocomplete } from "./autocomplete.js";

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
        <div class="req-header">
          <span class="req-name">
            <span class="item-icon-slot">${renderItemIconHtml(req.item)}</span>
            <strong>${req.item}</strong>
          </span>
          <span class="req-counts">
            <span class="need-count">${req.amount.toLocaleString()}</span>
          </span>
        </div>
      </div>
    `;
  }).join("");

  // Skills Level Badges
  const skillBadges = [];
  const skillIcons = {
    farming: `<img src="assets/Corn.png" class="skill-badge-img" alt="Farming" />`,
    fishing: "🎣",
    crafting: "🔨",
    exploring: "🧭",
    cooking: "🍳",
    mining: "⛏️"
  };
  const skillNames = { farming: "Farming", fishing: "Fishing", crafting: "Crafting", exploring: "Exploring", cooking: "Cooking", mining: "Mining" };
  if (quest.skills && typeof quest.skills === "object") {
    for (const [sKey, sVal] of Object.entries(quest.skills)) {
      const lvl = parseInt(sVal, 10) || 0;
      if (lvl > 0) {
        skillBadges.push(`<span class="level-badge" title="${skillNames[sKey] || sKey} requirement">${skillIcons[sKey] || '🎯'} ${skillNames[sKey] || sKey} ${lvl}</span>`);
      }
    }
  }
  if (skillBadges.length === 0 && quest.levelReq) {
    skillBadges.push(`<span class="level-badge" title="Requirement">🎯 ${quest.levelReq}</span>`);
  }

  // Rewards HTML
  const rewardsHtml = (quest.rewards || []).map(rew => {
    const type = (rew.type || "").toLowerCase();
    const itemName = (rew.item || rew.label || "").trim();
    const amountStr = rew.amount ? Number(rew.amount).toLocaleString() : "";

    if (type === "silver" || itemName.toLowerCase() === "silver") {
      return `
        <span class="reward-pill badge-reward-silver">
          ${renderItemIconHtml("Silver", "icon-sm")} ${amountStr} Silver
        </span>
      `;
    } else if (type === "gold" || itemName.toLowerCase() === "gold") {
      return `
        <span class="reward-pill badge-reward-gold">
          ${renderItemIconHtml("Gold", "icon-sm")} ${amountStr} Gold
        </span>
      `;
    } else if (type === "xp") {
      return ""; // XP removed as reward
    } else {
      return `
        <span class="reward-pill badge-reward-item">
          ${renderItemIconHtml(itemName, "icon-sm")} ${amountStr ? amountStr + ' ' : ''}${itemName}
        </span>
      `;
    }
  }).filter(Boolean).join("");

  card.innerHTML = `
    <div class="quest-card-top">
      <div class="quest-title-area">
        <div class="quest-badges">
          <span class="npc-badge" title="Quest Giver">${quest.npc === "Unknown" ? "❓" : "👤"} ${quest.npc}</span>
          ${skillBadges.join("")}
          ${isCompleted ? `<span class="completed-badge">✅ Completed</span>` : ''}
        </div>
        <h3 class="quest-title">${quest.title}</h3>
      </div>
      <button class="pin-btn ${quest.pinned ? 'pinned' : ''}" data-id="${quest.id}" title="${quest.pinned ? 'Unpin quest' : 'Pin quest'}">
        ${quest.pinned ? '★' : '☆'}
      </button>
    </div>

    ${quest.description ? `<p class="quest-desc">${quest.description}</p>` : ''}

    <div class="quest-section-title">Requirements</div>
    <div class="quest-requirements-list">
      ${reqsHtml || '<p class="empty-text">No requirements specified.</p>'}
    </div>

    ${rewardsHtml ? `
      <div class="quest-section-title rewards-title">Rewards</div>
      <div class="quest-rewards-list">
        ${rewardsHtml}
      </div>
    ` : ''}

    <div class="quest-card-footer">
      <div class="quest-actions-left">
        <button class="btn btn-sm btn-outline edit-quest-btn" data-id="${quest.id}" title="Edit quest">
          ✏️ Edit
        </button>
        <button class="btn btn-sm btn-ghost delete-quest-btn" data-id="${quest.id}" title="Delete quest">
          🗑️
        </button>
      </div>
      <div class="quest-actions-right">
        <button class="btn btn-sm ${isCompleted ? 'btn-secondary' : 'btn-primary'} toggle-status-btn" data-id="${quest.id}">
          ${isCompleted ? '↺ Reopen' : '✓ Complete'}
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
export function openQuestModal(questToEdit = null, onSave) {
  let modal = document.getElementById("quest-modal");
  if (!modal) return;

  activeModalAutocompletes.forEach(ac => ac.destroy());
  activeModalAutocompletes = [];

  const titleEl = document.getElementById("modal-quest-title");
  const form = document.getElementById("quest-form");
  const reqContainer = document.getElementById("modal-requirements-list");
  const rewContainer = document.getElementById("modal-rewards-list");
  const npcSelect = document.getElementById("quest-npc-input");

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
  document.getElementById("quest-name-input").value = questToEdit?.title || "";
  document.getElementById("quest-npc-input").value = questToEdit?.npc || "Buddy";
  document.getElementById("quest-desc-input").value = questToEdit?.description || "";
  document.getElementById("quest-pinned-input").checked = !!questToEdit?.pinned;

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
}

export function closeModal() {
  const modal = document.getElementById("quest-modal");
  if (modal) {
    modal.classList.remove("is-active");
    document.body.style.overflow = "";
  }
  activeModalAutocompletes.forEach(ac => ac.destroy());
  activeModalAutocompletes = [];
}

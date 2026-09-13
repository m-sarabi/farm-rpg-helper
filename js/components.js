import { getItemIcon, renderItemIconHtml, NPC_LIST, KNOWN_ITEM_NAMES } from "./quests-data.js";
import { isQuestReady, getQuestRequirementsStatus, aggregateMaterials, aggregateRewards, formatMaterialsAsText } from "./calculator.js";

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
  const isReady = quest.status === "active" && isQuestReady(quest, state.inventory);
  const isSelected = state.selectedQuestIds.has(quest.id);
  const reqStatus = getQuestRequirementsStatus(quest, state.inventory);

  const card = document.createElement("div");
  card.className = `quest-card ${quest.status === "completed" ? "is-completed" : ""} ${isReady ? "is-ready" : ""} ${quest.pinned ? "is-pinned" : ""}`;
  card.dataset.questId = quest.id;

  // Requirements HTML
  const reqsHtml = reqStatus.map(req => {
    const isDone = req.fulfilled;
    return `
      <div class="req-item ${isDone ? 'req-done' : ''}">
        <div class="req-header">
          <span class="req-name">
            <span class="item-icon-slot">${renderItemIconHtml(req.item)}</span>
            <strong>${req.item}</strong>
          </span>
          <span class="req-counts">
            <span class="have-count ${isDone ? 'have-good' : 'have-short'}">${req.have.toLocaleString()}</span>
            <span class="req-sep">/</span>
            <span class="need-count">${req.amount.toLocaleString()}</span>
          </span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${req.percent}%;"></div>
        </div>
      </div>
    `;
  }).join("");

  // Rewards HTML
  const rewardsHtml = (quest.rewards || []).map(rew => {
    const type = (rew.type || "").toLowerCase();
    let badgeClass = "badge-reward-item";
    let icon = "🎁";

    if (type === "silver" || rew.label?.toLowerCase().includes("silver")) {
      badgeClass = "badge-reward-silver";
      icon = renderItemIconHtml("Silver", "icon-sm");
    } else if (type === "gold" || rew.label?.toLowerCase().includes("gold")) {
      badgeClass = "badge-reward-gold";
      icon = renderItemIconHtml("Gold", "icon-sm");
    } else if (type === "xp" || rew.label?.toLowerCase().includes("xp")) {
      badgeClass = "badge-reward-xp";
      icon = `<span class="reward-emoji">⭐</span>`;
    } else {
      icon = renderItemIconHtml(rew.label, "icon-sm");
    }

    return `
      <span class="reward-pill ${badgeClass}">
        ${icon} ${rew.amount ? rew.amount.toLocaleString() + ' ' : ''}${rew.label}
      </span>
    `;
  }).join("");

  card.innerHTML = `
    <div class="quest-card-top">
      <div class="quest-select-wrapper" title="Select for Material Planner">
        <input type="checkbox" class="quest-select-checkbox" ${isSelected ? 'checked' : ''} data-id="${quest.id}" aria-label="Select quest ${quest.title}">
      </div>
      <div class="quest-title-area">
        <div class="quest-badges">
          <span class="npc-badge" title="Quest Giver">👤 ${quest.npc}</span>
          ${quest.levelReq ? `<span class="level-badge" title="Requirement">🎯 ${quest.levelReq}</span>` : ''}
          ${isReady ? `<span class="ready-badge">✨ Ready to Turn In!</span>` : ''}
          ${quest.status === "completed" ? `<span class="completed-badge">✅ Completed</span>` : ''}
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

    ${(quest.rewards && quest.rewards.length > 0) ? `
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
        <button class="btn btn-sm ${quest.status === 'completed' ? 'btn-secondary' : isReady ? 'btn-primary pulse-ready' : 'btn-primary'} toggle-status-btn" data-id="${quest.id}">
          ${quest.status === 'completed' ? '↺ Reopen' : '✓ Complete'}
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

  // Filter quests based on plannerFilter mode
  let filteredQuests = [];
  if (state.plannerFilter === "selected") {
    filteredQuests = state.quests.filter(q => state.selectedQuestIds.has(q.id));
  } else if (state.plannerFilter === "pinned") {
    filteredQuests = state.quests.filter(q => q.pinned && q.status === "active");
  } else {
    // "active" mode
    filteredQuests = state.quests.filter(q => q.status === "active");
  }

  const materials = aggregateMaterials(filteredQuests, state.inventory);
  const rewards = aggregateRewards(filteredQuests);

  const totalItemsCount = materials.reduce((acc, m) => acc + m.totalRequired, 0);
  const totalShortageCount = materials.reduce((acc, m) => acc + m.shortage, 0);
  const fulfilledItemsCount = materials.filter(m => m.isFulfilled).length;

  container.innerHTML = `
    <div class="planner-header-card">
      <div class="planner-header-top">
        <div>
          <h2 class="view-heading">🧺 Total Material Planner</h2>
          <p class="view-subheading">Aggregate materials needed across your selected Farm RPG quests</p>
        </div>
        <div class="planner-header-actions">
          <button class="btn btn-secondary btn-sm" id="copy-materials-btn" title="Copy to clipboard">
            📋 Copy Shopping List
          </button>
        </div>
      </div>

      <!-- Planner Scope Switcher -->
      <div class="planner-scope-bar">
        <div class="segmented-control">
          <button class="segment-btn ${state.plannerFilter === 'active' ? 'active' : ''}" data-planner-mode="active">
            All Active (${state.quests.filter(q => q.status === 'active').length})
          </button>
          <button class="segment-btn ${state.plannerFilter === 'selected' ? 'active' : ''}" data-planner-mode="selected">
            Selected Only (${state.selectedQuestIds.size})
          </button>
          <button class="segment-btn ${state.plannerFilter === 'pinned' ? 'active' : ''}" data-planner-mode="pinned">
            Pinned Only (${state.quests.filter(q => q.pinned && q.status === 'active').length})
          </button>
        </div>

        <div class="quick-select-buttons">
          <button class="btn btn-ghost btn-xs" id="planner-select-all">Select All Active</button>
          <span class="button-sep">•</span>
          <button class="btn btn-ghost btn-xs" id="planner-deselect-all">Deselect All</button>
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
          <span class="stat-icon">⏳</span>
          <div class="stat-info">
            <div class="stat-value ${totalShortageCount > 0 ? 'color-warning' : 'color-success'}">${totalShortageCount.toLocaleString()}</div>
            <div class="stat-label">Items Still Needed</div>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">✅</span>
          <div class="stat-info">
            <div class="stat-value color-success">${fulfilledItemsCount} / ${materials.length}</div>
            <div class="stat-label">Materials Ready</div>
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
          <div class="empty-icon">🌾</div>
          <h3>No Quests in this Scope</h3>
          <p>Select some quests or switch to "All Active" to see aggregate material requirements.</p>
        </div>
      ` : `
        <div class="materials-grid">
          ${materials.map(mat => renderMaterialCardHtml(mat)).join("")}
        </div>
      `}
    </div>
  `;

  return { element: container, materials, filteredQuests };
}

function renderMaterialCardHtml(mat) {
  const isDone = mat.isFulfilled;
  return `
    <div class="material-card ${isDone ? 'mat-fulfilled' : 'mat-shortage'}" data-item-name="${mat.item}">
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
        <div class="mat-status-tag ${isDone ? 'tag-ready' : 'tag-needed'}">
          ${isDone ? '✓ Ready' : `Need ${mat.shortage.toLocaleString()}`}
        </div>
      </div>

      <!-- Progress bar -->
      <div class="mat-progress-box">
        <div class="mat-progress-header">
          <span class="mat-progress-fraction">In Bag: <strong>${mat.inBag.toLocaleString()}</strong> / ${mat.totalRequired.toLocaleString()}</span>
          <span class="mat-progress-percent">${mat.percent}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill ${isDone ? 'fill-done' : ''}" style="width: ${mat.percent}%;"></div>
        </div>
      </div>

      <!-- Quick inventory adjuster -->
      <div class="mat-quick-adjust">
        <span class="quick-adjust-label">Quick Bag Update:</span>
        <div class="qty-control">
          <button class="qty-btn btn-mat-dec" data-item="${mat.item}" data-delta="-5" title="Minus 5">-5</button>
          <button class="qty-btn btn-mat-dec" data-item="${mat.item}" data-delta="-1" title="Minus 1">-1</button>
          <input type="number" class="qty-input mat-inv-input" data-item="${mat.item}" value="${mat.inBag}" min="0" />
          <button class="qty-btn btn-mat-inc" data-item="${mat.item}" data-delta="1" title="Plus 1">+1</button>
          <button class="qty-btn btn-mat-inc" data-item="${mat.item}" data-delta="5" title="Plus 5">+5</button>
          <button class="qty-btn btn-mat-fill" data-item="${mat.item}" data-target="${mat.totalRequired}" title="Set to required count (${mat.totalRequired})">Set Full</button>
        </div>
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
 * Render Inventory / Bag management view
 */
export function renderInventoryView(state) {
  const container = document.createElement("div");
  container.className = "inventory-view";

  // Collect all unique item names from all quests + existing inventory
  const allItemNames = new Set(Object.keys(state.inventory));
  for (const q of state.quests) {
    for (const r of q.requirements || []) {
      if (r.item) allItemNames.add(r.item.trim());
    }
  }
  const sortedItems = Array.from(allItemNames).sort();

  container.innerHTML = `
    <div class="inventory-header-card">
      <div class="inventory-header-top">
        <div>
          <h2 class="view-heading">🎒 Your Farm Bag (Inventory)</h2>
          <p class="view-subheading">Track your item counts. Any updates reflect instantly in quest turn-ins and material planning.</p>
        </div>
        <div class="inventory-header-actions">
          <button class="btn btn-secondary btn-sm" id="clear-all-inventory-btn">
            Clear All Inventory
          </button>
        </div>
      </div>

      <!-- Quick Add Item Form -->
      <div class="add-inventory-inline">
        <div class="inline-form-group">
          <label>Add / Update Item:</label>
          <div class="inline-inputs">
            <input type="text" id="quick-inv-name" placeholder="Item name (e.g. Wood, Corn)" list="known-items-list" />
            <input type="number" id="quick-inv-qty" placeholder="Qty" min="0" style="max-width: 110px;" />
            <button class="btn btn-primary btn-sm" id="quick-inv-submit">Save Item</button>
          </div>
          <datalist id="known-items-list">
            ${sortedItems.map(item => `<option value="${item}"></option>`).join('')}
          </datalist>
        </div>
      </div>
    </div>

    <!-- Inventory Items Table / Grid -->
    <div class="inventory-grid">
      ${sortedItems.length === 0 ? `
        <div class="empty-state-card">
          <div class="empty-icon">🎒</div>
          <h3>Inventory is Empty</h3>
          <p>Add some items above or let them populate automatically from your quests!</p>
        </div>
      ` : sortedItems.map(item => {
        const count = state.inventory[item] || 0;
        return `
          <div class="inv-item-card" data-item="${item}">
            <div class="inv-item-info">
              <span class="inv-item-icon-slot">${renderItemIconHtml(item, "icon-md")}</span>
              <div>
                <div class="inv-item-name">${item}</div>
                <div class="inv-item-count-label">In Bag: <strong>${count.toLocaleString()}</strong></div>
              </div>
            </div>
            <div class="inv-item-controls">
              <button class="qty-btn btn-inv-dec" data-item="${item}" data-delta="-10">-10</button>
              <button class="qty-btn btn-inv-dec" data-item="${item}" data-delta="-1">-1</button>
              <input type="number" class="qty-input inv-direct-input" data-item="${item}" value="${count}" min="0" />
              <button class="qty-btn btn-inv-inc" data-item="${item}" data-delta="1">+1</button>
              <button class="qty-btn btn-inv-inc" data-item="${item}" data-delta="10">+10</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  return container;
}

/**
 * Render Settings & Backup View
 */
export function renderSettingsView(state) {
  const container = document.createElement("div");
  container.className = "settings-view";

  container.innerHTML = `
    <div class="settings-card">
      <h2 class="view-heading">⚙️ Data & GitHub Pages Settings</h2>
      <p class="view-subheading">Your quest progress and inventory are saved in your browser's local storage.</p>

      <div class="settings-section">
        <h3>💾 Backup & Portability</h3>
        <p>Save a copy of all your custom quests and inventory counts to a JSON file, or restore on another device.</p>
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
        <p>Want to start over with default Farm RPG starter quests?</p>
        <button class="btn btn-danger" id="reset-defaults-btn">
          ⚠️ Reset to Default Quests
        </button>
      </div>

      <div class="settings-section">
        <h3>🚀 GitHub Pages Deployment Guide</h3>
        <p>Deploy this site to your free GitHub Pages account with zero build steps:</p>
        <ol class="setup-steps-list">
          <li>Create a new repository on GitHub (e.g., <code>farm-rpg-helper</code>).</li>
          <li>Push these files directly to the <code>main</code> branch.</li>
          <li>Go to your repository <strong>Settings</strong> &rarr; <strong>Pages</strong>.</li>
          <li>Under <em>Build and deployment</em> &gt; <em>Source</em>, select <strong>Deploy from a branch</strong>.</li>
          <li>Select Branch: <strong>main</strong> and folder: <strong>/ (root)</strong>, then click <strong>Save</strong>.</li>
          <li>In 1-2 minutes, your website will be live at <code>https://&lt;your-username&gt;.github.io/farm-rpg-helper/</code>!</li>
        </ol>
      </div>
    </div>
  `;

  return container;
}

/**
 * Setup and populate the Add/Edit Quest Modal
 */
export function openQuestModal(questToEdit = null, onSave) {
  let modal = document.getElementById("quest-modal");
  if (!modal) return;

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

  // Fill form fields
  document.getElementById("quest-name-input").value = questToEdit?.title || "";
  document.getElementById("quest-npc-input").value = questToEdit?.npc || "Buddy";
  document.getElementById("quest-level-input").value = questToEdit?.levelReq || "";
  document.getElementById("quest-desc-input").value = questToEdit?.description || "";
  document.getElementById("quest-pinned-input").checked = !!questToEdit?.pinned;

  // Add requirement row helper
  function addRequirementRow(item = "", amount = "") {
    const row = document.createElement("div");
    row.className = "modal-dynamic-row";
    row.innerHTML = `
      <input type="text" class="modal-req-item input-field" placeholder="Item (e.g. Wood)" value="${item}" list="known-items-list" required />
      <input type="number" class="modal-req-amount input-field" placeholder="Qty" value="${amount}" min="1" required />
      <button type="button" class="btn btn-ghost btn-sm remove-row-btn" title="Remove requirement">✕</button>
    `;
    row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
    reqContainer.appendChild(row);
  }

  // Add reward row helper
  function addRewardRow(type = "silver", label = "Silver", amount = "") {
    const row = document.createElement("div");
    row.className = "modal-dynamic-row";
    row.innerHTML = `
      <select class="modal-rew-type input-field">
        <option value="silver" ${type === 'silver' ? 'selected' : ''}>Silver</option>
        <option value="gold" ${type === 'gold' ? 'selected' : ''}>Gold</option>
        <option value="item" ${type === 'item' ? 'selected' : ''}>Item</option>
        <option value="xp" ${type === 'xp' ? 'selected' : ''}>XP</option>
      </select>
      <input type="text" class="modal-rew-label input-field" placeholder="Label (e.g. Silver or Orange Juice)" value="${label}" list="known-items-list" required />
      <input type="number" class="modal-rew-amount input-field" placeholder="Amount" value="${amount}" min="1" required />
      <button type="button" class="btn btn-ghost btn-sm remove-row-btn" title="Remove reward">✕</button>
    `;
    const typeSelect = row.querySelector(".modal-rew-type");
    const labelInput = row.querySelector(".modal-rew-label");
    typeSelect.addEventListener("change", () => {
      if (typeSelect.value === "silver" && (!labelInput.value || labelInput.value === "Gold")) labelInput.value = "Silver";
      if (typeSelect.value === "gold" && (!labelInput.value || labelInput.value === "Silver")) labelInput.value = "Gold";
      if (typeSelect.value === "xp" && !labelInput.value.includes("XP")) labelInput.value = "Farming XP";
    });
    row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
    rewContainer.appendChild(row);
  }

  // Populate existing requirements & rewards or defaults
  if (isEdit && questToEdit.requirements?.length > 0) {
    questToEdit.requirements.forEach(r => addRequirementRow(r.item, r.amount));
  } else {
    addRequirementRow("Wood", 25);
  }

  if (isEdit && questToEdit.rewards?.length > 0) {
    questToEdit.rewards.forEach(r => addRewardRow(r.type, r.label, r.amount));
  } else {
    addRewardRow("silver", "Silver", 1000);
  }

  // Bind add row buttons
  document.getElementById("modal-add-req-btn").onclick = () => addRequirementRow();
  document.getElementById("modal-add-rew-btn").onclick = () => addRewardRow();

  // Handle submit
  form.onsubmit = (e) => {
    e.preventDefault();

    const title = document.getElementById("quest-name-input").value.trim();
    const npc = document.getElementById("quest-npc-input").value.trim();
    const levelReq = document.getElementById("quest-level-input").value.trim();
    const description = document.getElementById("quest-desc-input").value.trim();
    const pinned = document.getElementById("quest-pinned-input").checked;

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
      const label = row.querySelector(".modal-rew-label").value.trim();
      const amount = parseInt(row.querySelector(".modal-rew-amount").value, 10) || 0;
      if (label && amount > 0) {
        rewards.push({ type, label, amount });
      }
    });

    const questData = {
      title,
      npc,
      levelReq,
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
}

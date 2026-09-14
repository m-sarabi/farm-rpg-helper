import { getItemIcon, renderItemIconHtml, getSkillIconHtml, NPC_LIST, MAIN_NPCS, getNpcIcon } from "./quests-data.js";
import { getQuestRequirementsStatus, aggregateMaterials, aggregateRewards, formatMaterialsAsText } from "./calculator.js";

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
 * Calculates event timeline status (active_now, upcoming, expired)
 * and formats human-readable dates and countdown strings.
 */
export function getEventTimeline(quest, now = new Date()) {
  if (!quest || (!quest.startDate && !quest.endDate)) {
    return null;
  }

  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const start = quest.startDate ? new Date(quest.startDate) : null;
  const end = quest.endDate ? new Date(quest.endDate) : null;
  const startMs = start && !isNaN(start.getTime()) ? start.getTime() : null;
  const endMs = end && !isNaN(end.getTime()) ? end.getTime() : null;

  const formatDate = (d) => {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  };

  let dateRangeStr = "";
  if (start && end) {
    dateRangeStr = `${formatDate(start)} – ${formatDate(end)}`;
  } else if (start) {
    dateRangeStr = `Starts ${formatDate(start)}`;
  } else if (end) {
    dateRangeStr = `Ends ${formatDate(end)}`;
  }

  let status = "active_now";
  let statusLabel = "Active Now";
  let countdownText = "";

  if (endMs !== null && nowMs > endMs) {
    status = "expired";
    statusLabel = "Expired";
    const daysAgo = Math.max(1, Math.floor((nowMs - endMs) / (1000 * 60 * 60 * 24)));
    countdownText = daysAgo === 1 ? "Ended yesterday" : `Ended ${daysAgo} days ago`;
  } else if (startMs !== null && nowMs < startMs) {
    status = "upcoming";
    statusLabel = "Upcoming";
    const daysUntil = Math.max(1, Math.ceil((startMs - nowMs) / (1000 * 60 * 60 * 24)));
    countdownText = daysUntil === 1 ? "Starts tomorrow" : `Starts in ${daysUntil} days`;
  } else if (endMs !== null) {
    status = "active_now";
    statusLabel = "Active Now";
    const msLeft = endMs - nowMs;
    const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (daysLeft > 1) {
      countdownText = `⏳ ${daysLeft} days left`;
    } else if (daysLeft === 1) {
      countdownText = `⏳ 1 day left`;
    } else if (hoursLeft > 0) {
      countdownText = `⏳ ${hoursLeft}h left`;
    } else {
      countdownText = `⏳ Ends soon!`;
    }
  }

  return {
    status,
    statusLabel,
    countdownText,
    dateRangeStr,
    startDate: start,
    endDate: end
  };
}

/**
 * Render single quest card HTML
 */
export function renderQuestCard(quest, state) {
  const isEvent = state.isEventQuest ? state.isEventQuest(quest) : Boolean(quest.startDate || quest.endDate);
  const timeline = isEvent ? getEventTimeline(quest) : null;
  const isCompleted = state.isQuestCompleted(quest);
  const isMissed = quest.status === "missed";
  const isAvailable = state.isQuestAvailable(quest);
  const isLocked = !isCompleted && !isMissed && !isAvailable;
  const lockReasons = isLocked ? state.getQuestLockReasons(quest) : [];

  const card = document.createElement("div");
  card.className = `quest-card ${isCompleted ? "is-completed" : ""} ${isMissed ? "is-missed" : ""} ${isAvailable ? "is-available" : ""} ${isLocked ? "is-locked" : ""} ${quest.pinned ? "is-pinned" : ""} ${isEvent ? "is-event-quest" : ""}`;
  card.dataset.questId = quest.id;

  // Requirements HTML
  const reqStatus = getQuestRequirementsStatus(quest);
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
        const playerLvl = state.playerLevels[sKey] || 0;
        const isMet = playerLvl >= lvl && playerLvl > 0;
        skillItems.push(`
          <span class="prereq-chip ${isMet ? 'prereq-met' : 'prereq-unmet'}" title="${skillNames[sKey] || sKey} requirement: Level ${lvl} (Your Level: ${playerLvl})">
            ${getSkillIconHtml(sKey, "skill-icon-xs")}
            <span class="prereq-name">${skillNames[sKey] || sKey}</span>
            <span class="prereq-level">${lvl}</span>
            <span class="prereq-status-icon">${isMet ? '✓' : '🔒'}</span>
          </span>
        `);
      }
    }
  }

  if (quest.towerLevel > 0) {
    const playerTower = state.playerLevels.tower || 0;
    const isMet = playerTower >= quest.towerLevel && playerTower > 0;
    skillItems.push(`
      <span class="prereq-chip ${isMet ? 'prereq-met' : 'prereq-unmet'}" title="Tower Level requirement: ${quest.towerLevel} (Your Level: ${playerTower})">
        <span class="skill-icon-xs">🗼</span>
        <span class="prereq-name">Tower</span>
        <span class="prereq-level">${quest.towerLevel}</span>
        <span class="prereq-status-icon">${isMet ? '✓' : '🔒'}</span>
      </span>
    `);
  }

  if (quest.requiredNpcLevel > 0) {
    const npcName = quest.requiredNpc || "Townsfolk";
    const playerFriendship = state.getNpcFriendship ? state.getNpcFriendship(npcName) : (state.playerLevels.friendship || 0);
    const isMet = playerFriendship >= quest.requiredNpcLevel && playerFriendship > 0;
    const npcIcon = getNpcIcon(npcName);
    skillItems.push(`
      <span class="prereq-chip ${isMet ? 'prereq-met' : 'prereq-unmet'}" title="${npcName} Friendship requirement: Level ${quest.requiredNpcLevel} (Your Level: ${playerFriendship})">
        ${npcIcon ? `<img src="${npcIcon}" alt="${npcName}" class="skill-icon-xs" style="object-fit: contain; image-rendering: pixelated;" />` : '<span class="skill-icon-xs">🤝</span>'}
        <span class="prereq-name">${npcName}</span>
        <span class="prereq-level">${quest.requiredNpcLevel}</span>
        <span class="prereq-status-icon">${isMet ? '✓' : '🔒'}</span>
      </span>
    `);
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
        <div class="quest-meta-left">
          <div class="npc-badge" title="Quest Giver">
            <svg class="npc-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span class="npc-name">${quest.npc}</span>
          </div>

          ${quest.questline ? `
            <span class="questline-badge" title="Part of questline: ${quest.questline}">
              <span class="questline-icon">📜</span>
              <span class="questline-name">${quest.questline}</span>
              ${quest.totalSteps > 1 ? `<span class="questline-step">${quest.stepNumber}/${quest.totalSteps}</span>` : ''}
            </span>
          ` : ''}
        </div>

        <div class="quest-header-actions">
          ${isCompleted ? `
            <span class="status-badge badge-completed">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Completed</span>
            </span>
          ` : isMissed ? `
            <span class="status-badge badge-missed" title="Event missed">
              <span>❌ Missed</span>
            </span>
          ` : isAvailable ? `
            <span class="status-badge badge-available">
              <span>✨ Ready</span>
            </span>
          ` : `
            <span class="status-badge badge-locked" title="Requirements or prerequisites not met">
              <span>🔒 Locked</span>
            </span>
          `}

          <button class="pin-btn ${quest.pinned ? 'pinned' : ''}" data-id="${quest.id}" title="${quest.pinned ? 'Unpin quest' : 'Pin quest for Material Planner'}" aria-label="${quest.pinned ? 'Unpin quest' : 'Pin quest'}">
            <svg class="pin-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
        </div>
      </div>

      ${timeline ? `
        <div class="event-timeline-strip timeline-${timeline.status}">
          <div class="event-timeline-left">
            <span class="event-status-tag badge-event-${timeline.status}">
              ${timeline.status === 'active_now' ? '🟢 Active Now' : timeline.status === 'upcoming' ? '⏳ Upcoming' : '⌛ Expired'}
            </span>
            <span class="event-date-text">📅 ${timeline.dateRangeStr}</span>
          </div>
          ${timeline.countdownText ? `<span class="event-countdown-tag">${timeline.countdownText}</span>` : ''}
        </div>
      ` : ''}

      <h3 class="quest-title">${quest.title}</h3>

      ${skillItems.length > 0 ? `
        <div class="quest-prereqs-bar">
          <span class="prereqs-label">Required Levels:</span>
          <div class="prereqs-list">
            ${skillItems.join("")}
          </div>
        </div>
      ` : ''}

      ${isLocked && lockReasons.length > 0 ? `
        <div class="quest-lock-banner">
          <div class="lock-banner-header">
            <span class="lock-icon">🔒</span>
            <strong>Prerequisites Needed:</strong>
          </div>
          <ul class="lock-reasons-list">
            ${lockReasons.map(reason => `<li>${reason}</li>`).join("")}
          </ul>
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
        ${reqsHtml || '<p class="empty-text">No items required.</p>'}
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
        ${quest.prevQuestTitle && !isCompleted && !isMissed ? `
          <span class="prev-quest-hint" title="Requires completion of ${quest.prevQuestTitle}">
            ⬅️ Step ${quest.stepNumber} (After ${quest.prevQuestTitle})
          </span>
        ` : ''}
      </div>
      <div class="quest-actions-right">
        ${isEvent ? `
          ${isCompleted ? `
            <button class="btn btn-sm btn-secondary toggle-status-btn" data-id="${quest.id}">
              <svg class="btn-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
              <span>Reopen</span>
            </button>
          ` : isMissed ? `
            <button class="btn btn-sm btn-outline toggle-missed-btn" data-id="${quest.id}" title="Reopen quest">
              <svg class="btn-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
              <span>Reopen</span>
            </button>
            <button class="btn btn-sm btn-outline toggle-status-btn" data-id="${quest.id}" title="Mark completed directly">
              <svg class="btn-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Mark Completed</span>
            </button>
          ` : `
            <button class="btn btn-sm btn-outline-danger toggle-missed-btn" data-id="${quest.id}" title="Mark this event quest as missed">
              <span>❌ Mark Missed</span>
            </button>
            <button class="btn btn-sm ${isAvailable ? 'btn-primary btn-complete' : 'btn-outline'} toggle-status-btn" data-id="${quest.id}">
              <svg class="btn-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Mark Completed</span>
            </button>
          `}
        ` : `
          <button class="btn btn-sm ${isCompleted ? 'btn-secondary' : isAvailable ? 'btn-primary btn-complete' : 'btn-outline'} toggle-status-btn" data-id="${quest.id}">
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
              <span>Mark Completed</span>
            `}
          </button>
        `}
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
    filteredQuests = state.quests.filter(q => q.status === "active" && state.isQuestAvailable(q));
  } else {
    // "pinned" mode
    filteredQuests = state.quests.filter(q => q.pinned && q.status === "active");
  }

  const materials = aggregateMaterials(filteredQuests, state.inventoryCap);
  const rewards = aggregateRewards(filteredQuests);

  const totalItemsCount = materials.reduce((acc, m) => acc + m.totalRequired, 0);
  const overCapMaterials = materials.filter(m => m.exceedsCap);

  const pinnedActiveCount = state.quests.filter(q => q.pinned && q.status === "active").length;
  const availableCount = state.quests.filter(q => q.status === "active" && state.isQuestAvailable(q)).length;

  container.innerHTML = `
    <div class="planner-header-card">
      <div class="planner-header-top">
        <div>
          <h2 class="view-heading">🧺 Total Material Planner</h2>
          <p class="view-subheading">Aggregate materials needed across your pinned or available Farm RPG quests</p>
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
            ✨ All Ready / Available (${availableCount})
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
          <p>Pin some quests or switch to "All Ready / Available" to see aggregate material requirements.</p>
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
 * Compact Player Levels Bar component for the Quests view
 */
export function renderPlayerLevelsBar(state) {
  const bar = document.createElement("div");
  bar.className = "player-levels-bar";
  bar.id = "player-levels-bar";

  const skills = [
    { id: "farming", name: "Farming", icon: "assets/Corn.png", max: 99 },
    { id: "fishing", name: "Fishing", icon: "assets/Fishing Hook.png", max: 99 },
    { id: "crafting", name: "Crafting", icon: "assets/Hammer.png", max: 99 },
    { id: "exploring", name: "Exploring", icon: "assets/Compass.png", max: 99 },
    { id: "cooking", name: "Cooking", icon: "assets/Cooking Pot.png", max: 99 },
    { id: "mining", name: "Mining", icon: "assets/Pickaxe.png", max: 99 }
  ];

  bar.innerHTML = `
    <div class="levels-bar-header">
      <div class="levels-bar-title">
        <span class="levels-bar-icon">🎯</span>
        <span><strong>My Skill Levels</strong> <span class="levels-hint">(0 = locked)</span></span>
      </div>
      <div class="levels-bar-actions">
        <button type="button" class="btn btn-xs btn-outline" id="quick-max-levels" title="Set all to max level">Unlock All 99</button>
        <button type="button" class="btn btn-xs btn-outline" id="quick-zero-levels" title="Reset all to 0">Lock All (0)</button>
      </div>
    </div>
    <div class="levels-inputs-row">
      ${skills.map(s => {
        const val = state.playerLevels[s.id] || 0;
        return `
          <div class="level-input-pill ${val === 0 ? 'is-locked-level' : ''}">
            <img src="${s.icon}" alt="${s.name}" class="level-skill-icon" title="${s.name}" />
            <span class="level-skill-label">${s.name}</span>
            <input
              type="number"
              class="level-num-input"
              data-skill="${s.id}"
              min="0"
              max="${s.max}"
              value="${val}"
              title="${s.name} level (0 = locked)"
            />
          </div>
        `;
      }).join("")}

      <div class="level-input-pill ${state.playerLevels.tower === 0 ? 'is-locked-level' : ''}">
        <span class="level-skill-icon-emoji" title="Tower Level">🗼</span>
        <span class="level-skill-label">Tower</span>
        <input
          type="number"
          class="level-num-input"
          data-skill="tower"
          min="0"
          max="350"
          value="${state.playerLevels.tower || 0}"
          title="Tower floor level (0 = locked)"
        />
      </div>

      <div class="level-input-pill ${state.playerLevels.friendship === 0 ? 'is-locked-level' : ''}">
        <span class="level-skill-icon-emoji" title="Townsfolk Friendship Level">🤝</span>
        <span class="level-skill-label">Friends</span>
        <input
          type="number"
          class="level-num-input"
          data-skill="friendship"
          min="0"
          max="99"
          value="${state.playerLevels.friendship || 0}"
          title="General townsfolk friendship level (0 = locked)"
        />
      </div>
    </div>
  `;

  // Bind input listeners
  bar.querySelectorAll(".level-num-input").forEach(input => {
    input.addEventListener("change", () => {
      const skill = input.dataset.skill;
      const val = parseInt(input.value, 10);
      const updated = {};
      updated[skill] = !isNaN(val) && val >= 0 ? val : 0;
      state.setPlayerLevels(updated);
      showToast(`${skill.charAt(0).toUpperCase() + skill.slice(1)} set to ${updated[skill]}!`, "info");
    });
  });

  const btnMax = bar.querySelector("#quick-max-levels");
  if (btnMax) {
    btnMax.addEventListener("click", () => {
      state.setPlayerLevels({
        farming: 99,
        fishing: 99,
        crafting: 99,
        exploring: 99,
        cooking: 99,
        mining: 99,
        tower: 320,
        friendship: 99
      });
      showToast("All player levels set to max!", "success");
    });
  }

  const btnZero = bar.querySelector("#quick-zero-levels");
  if (btnZero) {
    btnZero.addEventListener("click", () => {
      state.setPlayerLevels({
        farming: 0,
        fishing: 0,
        crafting: 0,
        exploring: 0,
        cooking: 0,
        mining: 0,
        tower: 0,
        friendship: 0
      });
      showToast("All player levels set to 0 (Locked)!", "info");
    });
  }

  return bar;
}

/**
 * Render Settings View
 */
export function renderSettingsView(state) {
  const container = document.createElement("div");
  container.className = "settings-view";

  const lastImportText = state.importedAt
    ? `Last synced: ${new Date(state.importedAt).toLocaleString()} (${state.quests.length} quests loaded)`
    : "No quests imported yet.";

  container.innerHTML = `
    <div class="settings-card">
      <h2 class="view-heading">⚙️ App Settings</h2>
      <p class="view-subheading">Manage your buddy.farm quest data, player levels, inventory cap, and backups.</p>

      <!-- 1. buddy.farm Import & Sync Section -->
      <div class="settings-section">
        <div class="settings-section-header">
          <span class="settings-section-icon">🌐</span>
          <div>
            <h3>buddy.farm Quests Sync</h3>
            <p>Import all 2,487 official quests, questlines, level requirements, and material requirements directly from buddy.farm.</p>
          </div>
        </div>

        <div class="buddy-sync-status-box">
          <div class="sync-status-info">
            <span class="sync-status-indicator ${state.quests.length > 0 ? 'is-synced' : 'is-unsynced'}"></span>
            <span id="sync-status-label">${lastImportText}</span>
          </div>

          <div class="sync-actions-row">
            <button type="button" class="btn btn-primary" id="btn-sync-buddy-quests">
              <span class="btn-spinner is-hidden" id="buddy-sync-spinner"></span>
              <span id="buddy-sync-btn-text">📥 Import All Quests from buddy.farm</span>
            </button>
          </div>

          <div class="buddy-sync-feedback is-hidden" id="buddy-sync-feedback"></div>
        </div>
      </div>

      <!-- 2. Player Skills & Tower Progression Section -->
      <div class="settings-section">
        <div class="settings-section-header">
          <span class="settings-section-icon">🎯</span>
          <div>
            <h3>Player Skills & Tower Level</h3>
            <p>Specify your current skill and tower levels. Quests dynamically unlock as your levels satisfy requirements.</p>
          </div>
        </div>

        <div class="settings-alert-box">
          <span class="alert-icon">ℹ️</span>
          <span><strong>Level 0 = Locked</strong>: Setting any skill to <code>0</code> marks that skill as locked. Quests requiring that skill will remain locked until your level reaches or exceeds the quest requirement.</span>
        </div>

        <div class="settings-skills-grid">
          <div class="settings-skill-item">
            <label class="settings-skill-label" for="settings-lvl-farming">
              <img src="assets/Corn.png" alt="Farming" class="skill-badge-img" />
              <span>Farming (0-99)</span>
            </label>
            <input type="number" id="settings-lvl-farming" class="input-field settings-level-input" data-skill="farming" min="0" max="99" value="${state.playerLevels.farming || 0}" />
          </div>

          <div class="settings-skill-item">
            <label class="settings-skill-label" for="settings-lvl-fishing">
              <img src="assets/Fishing Hook.png" alt="Fishing" class="skill-badge-img" />
              <span>Fishing (0-99)</span>
            </label>
            <input type="number" id="settings-lvl-fishing" class="input-field settings-level-input" data-skill="fishing" min="0" max="99" value="${state.playerLevels.fishing || 0}" />
          </div>

          <div class="settings-skill-item">
            <label class="settings-skill-label" for="settings-lvl-crafting">
              <img src="assets/Hammer.png" alt="Crafting" class="skill-badge-img" />
              <span>Crafting (0-99)</span>
            </label>
            <input type="number" id="settings-lvl-crafting" class="input-field settings-level-input" data-skill="crafting" min="0" max="99" value="${state.playerLevels.crafting || 0}" />
          </div>

          <div class="settings-skill-item">
            <label class="settings-skill-label" for="settings-lvl-exploring">
              <img src="assets/Compass.png" alt="Exploring" class="skill-badge-img" />
              <span>Exploring (0-99)</span>
            </label>
            <input type="number" id="settings-lvl-exploring" class="input-field settings-level-input" data-skill="exploring" min="0" max="99" value="${state.playerLevels.exploring || 0}" />
          </div>

          <div class="settings-skill-item">
            <label class="settings-skill-label" for="settings-lvl-cooking">
              <img src="assets/Cooking Pot.png" alt="Cooking" class="skill-badge-img" />
              <span>Cooking (0-99)</span>
            </label>
            <input type="number" id="settings-lvl-cooking" class="input-field settings-level-input" data-skill="cooking" min="0" max="99" value="${state.playerLevels.cooking || 0}" />
          </div>

          <div class="settings-skill-item">
            <label class="settings-skill-label" for="settings-lvl-mining">
              <img src="assets/Pickaxe.png" alt="Mining" class="skill-badge-img" />
              <span>Mining (0-99)</span>
            </label>
            <input type="number" id="settings-lvl-mining" class="input-field settings-level-input" data-skill="mining" min="0" max="99" value="${state.playerLevels.mining || 0}" />
          </div>

          <div class="settings-skill-item">
            <label class="settings-skill-label" for="settings-lvl-tower">
              <span class="skill-badge-img emoji-badge">🗼</span>
              <span>Tower Level (0-350)</span>
            </label>
            <input type="number" id="settings-lvl-tower" class="input-field settings-level-input" data-skill="tower" min="0" max="350" value="${state.playerLevels.tower || 0}" />
          </div>
        </div>

        <div class="settings-buttons-row" style="margin-top: 1rem;">
          <button type="button" class="btn btn-primary" id="settings-save-levels-btn">💾 Save Skills</button>
          <button type="button" class="btn btn-secondary" id="settings-max-levels-btn">⚡ Set Skills to Max (99 / Tower 320)</button>
          <button type="button" class="btn btn-outline" id="settings-zero-levels-btn">🔒 Lock All Skills (All 0)</button>
        </div>
      </div>

      <!-- 3. Townsfolk NPC Friendships Section -->
      <div class="settings-section">
        <div class="settings-section-header">
          <span class="settings-section-icon">🤝</span>
          <div>
            <h3>Townsfolk NPC Friendships (24 Main NPCs)</h3>
            <p>Specify individual friendship levels (0-99) for each townsfolk NPC. Quests requiring friendship with a specific NPC will unlock once requirements are met (0 = locked).</p>
          </div>
        </div>

        <div class="settings-toolbar-row" style="display: flex; gap: 0.6rem; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-bottom: 1rem;">
          <div class="settings-search-box" style="display: flex; align-items: center; gap: 0.4rem;">
            <input type="text" id="settings-npc-search-input" class="input-field" placeholder="🔍 Filter NPCs..." style="max-width: 220px; font-size: 0.85rem;" />
          </div>
          <div class="settings-buttons-row">
            <button type="button" class="btn btn-primary" id="settings-save-friendships-btn">💾 Save Friendships</button>
            <button type="button" class="btn btn-secondary" id="settings-max-friendships-btn">⚡ Set All to 99</button>
            <button type="button" class="btn btn-outline" id="settings-zero-friendships-btn">🔒 Lock All (0)</button>
          </div>
        </div>

        <div class="settings-npcs-grid" id="settings-npcs-grid">
          ${MAIN_NPCS.map(npc => {
            const lvl = state.getNpcFriendship ? state.getNpcFriendship(npc.name) : 0;
            const safeId = "npc-lvl-" + npc.name.replace(/[^a-zA-Z0-9]/g, "_");
            return `
              <div class="settings-npc-card ${lvl === 0 ? 'is-locked-npc' : ''}" data-npc-name="${npc.name.toLowerCase()}">
                <div class="npc-card-header">
                  <img src="${npc.icon}" alt="${npc.name}" class="npc-bobblehead-img" />
                  <div class="npc-card-titles">
                    <span class="npc-card-name">${npc.name}</span>
                    <span class="npc-card-status ${lvl === 0 ? 'status-locked' : 'status-active'}">${lvl === 0 ? '🔒 Locked (0)' : `Level ${lvl}`}</span>
                  </div>
                </div>
                <div class="npc-card-input-row">
                  <label class="npc-card-label" for="${safeId}">Friendship:</label>
                  <input
                    type="number"
                    id="${safeId}"
                    class="input-field settings-npc-input"
                    data-npc="${npc.name}"
                    min="0"
                    max="99"
                    value="${lvl}"
                    title="${npc.name} Friendship Level (0-99)"
                  />
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <!-- 4. Inventory Cap Section -->
      <div class="settings-section">
        <div class="settings-section-header">
          <span class="settings-section-icon">🎒</span>
          <div>
            <h3>Inventory Cap</h3>
            <p>Set your maximum inventory capacity in Farm RPG. The Material Planner displays warnings for any items exceeding this limit.</p>
          </div>
        </div>
        <div class="settings-cap-form">
          <input type="number" id="settings-cap-input" class="input-field" min="1" value="${state.inventoryCap}" style="max-width: 160px;" />
          <button class="btn btn-primary" id="settings-save-cap-btn">Save Cap</button>
        </div>
      </div>

      <!-- 5. Backup & Portability Section -->
      <div class="settings-section">
        <div class="settings-section-header">
          <span class="settings-section-icon">💾</span>
          <div>
            <h3>Backup & Portability</h3>
            <p>Export your quest completion states, pinned quests, and settings to a JSON file, or restore on another device.</p>
          </div>
        </div>
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

      <!-- 6. Reset Data Section -->
      <div class="settings-section">
        <div class="settings-section-header">
          <span class="settings-section-icon">🔄</span>
          <div>
            <h3>Reset Progress</h3>
            <p>Clear completed statuses and restore all player levels to default 0 (locked).</p>
          </div>
        </div>
        <button class="btn btn-danger" id="reset-defaults-btn">
          ⚠️ Reset All Progress
        </button>
      </div>
    </div>
  `;

  return container;
}

import { ALL_FARM_RPG_ITEMS, getItemImageFilename } from "./items-data.js";
import { state } from "./state.js";

/**
 * Attaches a dedicated, high-performance item search dropdown to any text input.
 * Replaces the native system default <datalist>.
 *
 * Features:
 * - Smart search (prefix > word boundary > substring, case-insensitive)
 * - Renders authentic pixel-art item thumbnails from assets/
 * - Displays in-bag quantity indicator
 * - Full keyboard navigation (ArrowUp, ArrowDown, Enter, Tab, Escape)
 * - Auto-repositions and adjusts to modal or page scrolling
 * - Top 25 items cap for silky 60fps performance
 */
export function attachItemAutocomplete(inputEl, options = {}) {
  if (!inputEl) return null;

  // Disable native autocomplete and remove any datalist association
  inputEl.setAttribute("autocomplete", "off");
  inputEl.removeAttribute("list");

  const onSelect = options.onSelect || (() => {});
  const placeholder = options.placeholder;
  if (placeholder) inputEl.placeholder = placeholder;

  // Create dropdown container
  const dropdown = document.createElement("div");
  dropdown.className = "item-autocomplete-dropdown";
  dropdown.setAttribute("role", "listbox");
  dropdown.style.display = "none";
  document.body.appendChild(dropdown);

  let activeIndex = -1;
  let currentResults = [];
  let isOpen = false;

  // Smart search filter across all 1,558 items + any custom inventory keys
  function getMatchingItems(query) {
    const q = (query || "").trim().toLowerCase();
    const allItems = ALL_FARM_RPG_ITEMS;

    // Collect extra custom inventory items if any aren't in ALL_FARM_RPG_ITEMS
    const customItems = Object.keys(state.inventory || {}).filter(name => {
      return !allItems.some(it => it.name.toLowerCase() === name.toLowerCase());
    }).map(name => ({
      name,
      filename: `${name}.png`
    }));

    const pool = [...allItems, ...customItems];

    if (!q) {
      // If query is empty, show items currently in inventory first, then top popular items
      const inBag = pool.filter(it => (state.inventory[it.name] || 0) > 0);
      const remaining = pool.filter(it => !((state.inventory[it.name] || 0) > 0));
      return [...inBag, ...remaining].slice(0, 25);
    }

    const exactMatches = [];
    const prefixMatches = [];
    const wordBoundaryMatches = [];
    const substringMatches = [];

    for (let i = 0; i < pool.length; i++) {
      const item = pool[i];
      const lower = item.name.toLowerCase();

      if (lower === q) {
        exactMatches.push(item);
      } else if (lower.startsWith(q)) {
        prefixMatches.push(item);
      } else {
        const words = lower.split(/[\s\-_]+/);
        if (words.some(w => w.startsWith(q))) {
          wordBoundaryMatches.push(item);
        } else if (lower.includes(q)) {
          substringMatches.push(item);
        }
      }

      // Fast exit if we already have plenty of top-quality matches
      if (exactMatches.length + prefixMatches.length + wordBoundaryMatches.length >= 35) {
        break;
      }
    }

    return [...exactMatches, ...prefixMatches, ...wordBoundaryMatches, ...substringMatches].slice(0, 25);
  }

  // Highlight matched query substring safely
  function highlightMatch(text, query) {
    if (!query) return escapeHtml(text);
    const q = query.trim();
    if (!q) return escapeHtml(text);

    const regex = new RegExp(`(${escapeRegex(q)})`, "gi");
    return escapeHtml(text).replace(regex, "<mark class='autocomplete-highlight'>$1</mark>");
  }

  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Position dropdown right below input element
  function updatePosition() {
    if (!isOpen) return;
    const rect = inputEl.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;

    dropdown.style.width = `${Math.max(rect.width, 240)}px`;
    dropdown.style.left = `${rect.left + scrollX}px`;

    // Check space below vs above
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(dropdown.scrollHeight || 300, 320);

    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
      // Open above
      dropdown.style.top = `${rect.top + scrollY - dropdownHeight - 4}px`;
    } else {
      // Open below
      dropdown.style.top = `${rect.bottom + scrollY + 4}px`;
    }
  }

  // Render dropdown content
  function renderDropdown(items, query) {
    currentResults = items;
    activeIndex = -1;

    if (items.length === 0) {
      dropdown.innerHTML = `
        <div class="item-autocomplete-empty">
          <span>🔍 No matching Farm RPG items found</span>
        </div>
      `;
      openDropdown();
      return;
    }

    dropdown.innerHTML = items.map((item, idx) => {
      const filename = item.filename || getItemImageFilename(item.name);
      const encodedSrc = `assets/${encodeURIComponent(filename)}`;
      const inBag = state.inventory[item.name] || 0;
      const bagBadge = inBag > 0
        ? `<span class="autocomplete-bag-badge" title="${inBag.toLocaleString()} in Farm Bag">In Bag: ${inBag.toLocaleString()}</span>`
        : "";

      return `
        <div class="item-autocomplete-option" data-index="${idx}" role="option">
          <span class="autocomplete-thumb-wrap">
            <img class="autocomplete-thumb" src="${encodedSrc}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';" />
            <span class="autocomplete-thumb-fallback" style="display: none;">📦</span>
          </span>
          <span class="autocomplete-item-name">${highlightMatch(item.name, query)}</span>
          ${bagBadge}
        </div>
      `;
    }).join("");

    // Bind option click events
    dropdown.querySelectorAll(".item-autocomplete-option").forEach(optEl => {
      optEl.addEventListener("mousedown", (e) => {
        // Prevent input blur before click triggers
        e.preventDefault();
      });

      optEl.addEventListener("click", () => {
        const idx = parseInt(optEl.dataset.index, 10);
        selectItem(idx);
      });

      optEl.addEventListener("mouseenter", () => {
        setActiveIndex(parseInt(optEl.dataset.index, 10), false);
      });
    });

    openDropdown();
  }

  function setActiveIndex(index, scrollIntoView = true) {
    const options = dropdown.querySelectorAll(".item-autocomplete-option");
    options.forEach(opt => opt.classList.remove("is-focused"));

    activeIndex = index;
    if (activeIndex >= 0 && activeIndex < options.length) {
      const activeOption = options[activeIndex];
      activeOption.classList.add("is-focused");
      if (scrollIntoView) {
        activeOption.scrollIntoView({ block: "nearest" });
      }
    }
  }

  function selectItem(index) {
    if (index >= 0 && index < currentResults.length) {
      const selected = currentResults[index];
      inputEl.value = selected.name;
      closeDropdown();
      onSelect(selected);
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function openDropdown() {
    isOpen = true;
    dropdown.style.display = "block";
    updatePosition();
  }

  function closeDropdown() {
    isOpen = false;
    dropdown.style.display = "none";
    activeIndex = -1;
  }

  // Event Listeners on Input
  inputEl.addEventListener("focus", () => {
    const items = getMatchingItems(inputEl.value);
    renderDropdown(items, inputEl.value);
  });

  inputEl.addEventListener("input", () => {
    const items = getMatchingItems(inputEl.value);
    renderDropdown(items, inputEl.value);
  });

  inputEl.addEventListener("keydown", (e) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      const items = getMatchingItems(inputEl.value);
      renderDropdown(items, inputEl.value);
      e.preventDefault();
      return;
    }

    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = activeIndex + 1 < currentResults.length ? activeIndex + 1 : 0;
      setActiveIndex(nextIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = activeIndex - 1 >= 0 ? activeIndex - 1 : currentResults.length - 1;
      setActiveIndex(prevIndex);
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < currentResults.length) {
        e.preventDefault();
        e.stopPropagation();
        selectItem(activeIndex);
      }
    } else if (e.key === "Tab") {
      if (activeIndex >= 0 && activeIndex < currentResults.length) {
        selectItem(activeIndex);
      } else {
        closeDropdown();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
    }
  });

  // Handle click outside to close
  const handleDocClick = (e) => {
    if (!inputEl.contains(e.target) && !dropdown.contains(e.target)) {
      closeDropdown();
    }
  };

  // Reposition on window resize or scroll
  const handleScrollResize = () => {
    if (isOpen) updatePosition();
  };

  document.addEventListener("click", handleDocClick);
  window.addEventListener("resize", handleScrollResize);
  window.addEventListener("scroll", handleScrollResize, true);

  // Return cleanup method
  return {
    destroy() {
      document.removeEventListener("click", handleDocClick);
      window.removeEventListener("resize", handleScrollResize);
      window.removeEventListener("scroll", handleScrollResize, true);
      if (dropdown.parentNode) dropdown.parentNode.removeChild(dropdown);
    },
    close: closeDropdown,
    open() {
      const items = getMatchingItems(inputEl.value);
      renderDropdown(items, inputEl.value);
    }
  };
}

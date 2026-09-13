# 🌾 Farm RPG Quest & Material Tracker

A friendly, modern, and mobile-responsive web companion for **Farm RPG**. Track your quests, calculate aggregate material requirements across multiple quests, check requirements against your inventory cap, and know exactly what you need to farm, fish, or craft next!

---

## ✨ Features

- **📜 Complete Quest Management**:
  - Preloaded with authentic starter Farm RPG quests (Buddy, Rosalie, Holger, Beatrix, Cecil, Vincent, Jill, Borgen).
  - Add, edit, pin, and delete quests with customizable requirements and rewards (Silver, Gold, Items).
  - Mark quests as **Completed** or **Reopen** them at any time.

- **🧺 Total Material Requirements & Shopping Planner**:
  - Aggregate items across **All Active Quests** or **Pinned Quests**.
  - **🎒 Configurable Inventory Cap**: Set your player's maximum inventory capacity (default: 1,000) directly in the planner header or in settings.
  - **⚠️ Subtle Over-Cap Warnings**: Immediately highlights any material requirement that exceeds your inventory cap with a subtle warning indicator and note detailing how many items over cap it is.
  - Expandable breakdown showing every quest that requires a specific material.
  - **Copy Shopping List** button: formatted checklist with cap annotations ready to paste into Farm RPG chat or personal notes.

- **🎨 Farm RPG-Inspired Cozy Aesthetic**:
  - Warm parchment / forest green theme matching the game's cozy medieval vibe.
  - Built-in **Dark / Night Farm Mode** toggle (`🌓`).
  - Mobile-friendly responsive layout for players on phones or split-screen.

- **💾 Data Persistence & Backups**:
  - Saves quests and inventory cap settings automatically to browser `localStorage`.
  - One-click **Export Backup (JSON)** and **Import Backup (JSON)** to transfer data across devices.
  - "Reset to Defaults" option anytime you want a fresh start.

---

## 💻 Local Preview

To preview the website locally on your computer:

### Option A: Python Built-in Server
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000` in your browser.

### Option B: VS Code Live Server
Right-click `index.html` and select **"Open with Live Server"**.

### Option C: Any Static File Server
```bash
npx serve .
```

---

## 🎨 Authentic Farm RPG Item Icons & Automation

Farm RPG Helper includes real item icons and item names scraped directly from authentic Farm RPG endpoints.

### Automatic Asset & Catalog Downloader

To download the full catalog of ~1,550+ Farm RPG items and icons:

#### With Python 3 (zero dependencies):
```bash
python scripts/download_farmrpg_items.py
```
- **Filter items**: `python scripts/download_farmrpg_items.py --search "Carrot"`
- **Test batch**: `python scripts/download_farmrpg_items.py --limit 20`
- **Catalog data only**: `python scripts/download_farmrpg_items.py --data-only`

#### With Node.js:
```bash
node scripts/download_farmrpg_items.js
```

All images are saved to `assets/<Item Name>.png`. Already downloaded images are automatically detected and skipped.

---

## 📁 Project Structure

```
Farm RPG Helper/
├── index.html              # Core app shell, item search dropdown, and modal dialogs
├── assets/                 # Authentic Farm RPG game item icons (<Item Name>.png)
├── data/
│   └── items.json          # Complete Farm RPG item catalog (IDs, names, images)
├── scripts/
│   ├── download_farmrpg_items.py # Pure Python concurrent item & icon scraper
│   └── download_farmrpg_items.js # Node.js equivalent item & icon scraper
├── styles/
│   └── main.css            # Farm RPG theme variables, pixel-art icons, cards, responsive layout
├── js/
│   ├── app.js              # Main coordinator, navigation, and modal management
│   ├── autocomplete.js     # Fast item search dropdown with thumbnails
│   ├── calculator.js       # Material aggregation, over-cap math & reward summaries
│   ├── components.js       # UI rendering for quest cards, material planner, and settings
│   ├── items-data.js       # Full 1,550+ Farm RPG items database & name lookup map
│   ├── quests-data.js      # Starter quests and dynamic item icon HTML generator
│   └── state.js            # State store, localStorage sync, inventory cap, JSON import/export
└── README.md               # Documentation and usage guide
```

---

## 🤝 Contributing & Customization

Feel free to customize the default quests in `js/quests-data.js` or tweak colors in `styles/main.css`.
Happy farming! 🌾


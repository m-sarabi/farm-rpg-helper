# 🌾 Farm RPG Quest & Material Tracker

A friendly, modern, and mobile-responsive web companion for **Farm RPG**. Track your quests, calculate aggregate material requirements across multiple quests, manage your bag inventory, and know exactly what you need to farm, fish, or craft next!

Designed specifically for **zero-build, one-click deployment to GitHub Pages**.

---

## ✨ Features

- **📜 Complete Quest Management**:
  - Preloaded with authentic starter Farm RPG quests (Buddy, Rosalie, Holger, Beatrix, Cecil, Vincent, Jill, Borgen).
  - Add, edit, pin, and delete quests with customizable requirements and rewards (Silver, Gold, Items, XP).
  - Mark quests as **Completed** or **Reopen** them at any time.
  - Automatic **"✨ Ready to Turn In!"** badges when your inventory has all required items for a quest.

- **🧺 Total Material Requirements & Shopping Planner**:
  - Aggregate items across **All Active Quests**, **Selected Quests**, or **Pinned Quests**.
  - Visual shortage indicators: see exactly how many more Wood, Boards, Iron, or Crops you need.
  - Inline bag updater (`-5`, `-1`, `+1`, `+5`, `Set Full`) to quickly adjust your item counts right from the planner.
  - Expandable breakdown showing every quest that requires a specific material.
  - **Copy Shopping List** button: formatted checklist ready to paste into Farm RPG chat or your personal notes.

- **🎒 Farm Bag (Inventory Tracker)**:
  - Keep track of the items currently in your bag.
  - Automatically syncs with quest progress and material planner calculations.

- **🎨 Farm RPG-Inspired Cozy Aesthetic**:
  - Warm parchment / forest green theme matching the game's cozy medieval vibe.
  - Built-in **Dark / Night Farm Mode** toggle (`🌓`).
  - Mobile-friendly responsive layout for players on phones or split-screen.

- **💾 Data Persistence & Backups**:
  - Saves automatically to browser `localStorage`.
  - One-click **Export Backup (JSON)** and **Import Backup (JSON)** to transfer data across devices.
  - "Reset to Defaults" option anytime you want a fresh start.

---

## 🚀 How to Deploy to GitHub Pages (Zero-Build)

You can host this website completely free on **GitHub Pages** in less than 2 minutes:

### Step 1: Create a GitHub Repository
1. Go to [GitHub](https://github.com) and click **New Repository**.
2. Name it `farm-rpg-helper` (or any name you prefer).
3. Set it to **Public** and click **Create repository**.

### Step 2: Push Your Files
Open your terminal in this project folder and run:
```bash
git init
git add .
git commit -m "Initial Farm RPG Helper release"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/farm-rpg-helper.git
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. In your GitHub repository, click on **Settings** (top menu).
2. On the left sidebar, click **Pages**.
3. Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
4. Set **Branch** to `main` and folder to `/ (root)`.
5. Click **Save**.

That's it! In about 1 minute, GitHub will give you a live link:
```
https://<YOUR-USERNAME>.github.io/farm-rpg-helper/
```

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

## 📁 Project Structure

```
Farm RPG Helper/
├── index.html              # Core app shell and modal dialogs
├── styles/
│   └── main.css            # Farm RPG theme variables, cards, responsive layout
├── js/
│   ├── app.js              # Main coordinator, navigation, and event handlers
│   ├── calculator.js       # Material aggregation, shortage math & reward summaries
│   ├── components.js       # UI rendering for quest cards, planner, bag, and modals
│   ├── quests-data.js      # Authentic starter Farm RPG quests & item icon database
│   └── state.js            # State store, localStorage sync, and JSON backup import/export
└── README.md               # Documentation and GitHub Pages deployment guide
```

---

## 🤝 Contributing & Customization

Feel free to customize the default quests in `js/quests-data.js` or tweak colors in `styles/main.css`.
Happy farming! 🌾

# AscendOne

Personal development & goal-tracking desktop app built with **Tauri + React + TypeScript + SQLite**.

Features: Goals, Tasks, Journal, Gratitude, Habits, Calendar, Vision Board, 30-Day Ascend Challenge, Letter to Future Self, Points & Rewards.

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (stable toolchain)
- Tauri system dependencies for your OS:
  - **Windows** — Microsoft C++ Build Tools (via Visual Studio Installer)
  - **macOS** — Xcode Command Line Tools (`xcode-select --install`)
  - **Linux** — See [Tauri Linux deps](https://tauri.app/v1/guides/getting-started/prerequisites#setting-up-linux)

---

## Setup

```bash
cd app
npm install
npm run tauri dev
```

On first run the app launches an onboarding wizard and creates a fresh local database in your OS app data directory:

- **Windows** — `C:\Users\<you>\AppData\Local\com.ascendone.app\`
- **macOS** — `~/Library/Application Support/com.ascendone.app/`
- **Linux** — `~/.local/share/com.ascendone.app/`

Your data lives entirely on your own machine and is never committed to this repo.

---

## Build (production)

```bash
cd app
npm run tauri build
```

Outputs an installer to `app/src-tauri/target/release/bundle/`.

---

## Project Structure

```
app/
├── src/                  # React + TypeScript frontend
│   ├── pages/            # Page components (Goals, Tasks, Journal, etc.)
│   ├── components/       # Shared UI components
│   ├── db/               # SQLite schema & migrations (database.ts)
│   ├── store/            # Zustand state (appStore, themeStore)
│   └── utils/            # Date helpers, etc.
├── src-tauri/            # Rust / Tauri backend
│   ├── src/              # main.rs, lib.rs
│   ├── tauri.conf.json   # App config & identifier
│   └── capabilities/     # Permission definitions
└── package.json
```

---

## Data Isolation Note for Collaborators

All user data (journal entries, goals, tasks, vision board images, etc.) is stored in the local SQLite database on each developer's own machine. **Nothing personal is ever in the repo.** Each developer gets a completely independent data environment automatically.

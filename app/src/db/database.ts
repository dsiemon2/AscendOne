import Database from "@tauri-apps/plugin-sql";
import { logger } from "../utils/logger";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;
  try {
    const newDb = await Database.load("sqlite:ascendone.db");
    await initializeSchema(newDb);
    db = newDb; // Only cache AFTER successful initialization
    return db;
  } catch (e) {
    logger.error("database/getDb", "Failed to load or initialize database", { error: String(e) });
    throw e;
  }
}

async function runMigrations(db: Database): Promise<void> {
  // Create migrations tracking table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS db_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const applied = await db.select<{ version: number }[]>(
    "SELECT version FROM db_migrations ORDER BY version"
  );
  const versions = new Set(applied.map((r) => r.version));
  logger.info("database/migrations", `Applied migrations: [${[...versions].join(", ")}]`);

  // Migration 1: Add new profile columns if upgrading from old schema
  if (!versions.has(1)) {
    const profileCols = await db.select<{ name: string }[]>(
      "PRAGMA table_info(profile)"
    );
    const colNames = profileCols.map((c) => c.name);
    if (profileCols.length > 0) {
      // Table exists — add any missing columns
      if (!colNames.includes("first_name"))
        await db.execute("ALTER TABLE profile ADD COLUMN first_name TEXT NOT NULL DEFAULT ''");
      if (!colNames.includes("last_name"))
        await db.execute("ALTER TABLE profile ADD COLUMN last_name TEXT");
      if (!colNames.includes("username"))
        await db.execute("ALTER TABLE profile ADD COLUMN username TEXT");
      if (!colNames.includes("pin"))
        await db.execute("ALTER TABLE profile ADD COLUMN pin TEXT");
      if (!colNames.includes("country"))
        await db.execute("ALTER TABLE profile ADD COLUMN country TEXT");
      if (!colNames.includes("avatar_path"))
        await db.execute("ALTER TABLE profile ADD COLUMN avatar_path TEXT");
    }
    // Gratitudes: only migrate if table already exists
    const gratCols = await db.select<{ name: string }[]>(
      "PRAGMA table_info(gratitudes)"
    );
    if (gratCols.length > 0) {
      const gratColNames = gratCols.map((c) => c.name);
      if (gratColNames.includes("entry") && !gratColNames.includes("text")) {
        await db.execute("ALTER TABLE gratitudes RENAME COLUMN entry TO text");
      }
      if (!gratColNames.includes("points_awarded")) {
        await db.execute("ALTER TABLE gratitudes ADD COLUMN points_awarded INTEGER DEFAULT 0");
      }
    }
    // Journal entries: only migrate if table already exists
    const jeCols = await db.select<{ name: string }[]>(
      "PRAGMA table_info(journal_entries)"
    );
    if (jeCols.length > 0) {
      const jeColNames = jeCols.map((c) => c.name);
      if (!jeColNames.includes("word_count")) {
        await db.execute("ALTER TABLE journal_entries ADD COLUMN word_count INTEGER DEFAULT 0");
      }
      if (!jeColNames.includes("points_awarded")) {
        await db.execute("ALTER TABLE journal_entries ADD COLUMN points_awarded INTEGER DEFAULT 0");
      }
    }
    await db.execute("INSERT INTO db_migrations (version) VALUES (1)");
  }

  // Migration 2: Add vision_board_items table
  if (!versions.has(2)) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS vision_board_items (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        description TEXT,
        image_url   TEXT,
        category    TEXT NOT NULL DEFAULT 'general',
        size        TEXT NOT NULL DEFAULT 'medium',
        sort_order  INTEGER DEFAULT 0,
        accent_color TEXT DEFAULT '#5090e0',
        created_at  TEXT DEFAULT (datetime('now')),
        updated_at  TEXT DEFAULT (datetime('now'))
      )
    `);
    await db.execute("INSERT INTO db_migrations (version) VALUES (2)");
  }

  // Migration 3: Add event_status and status_reason to events table
  if (!versions.has(3)) {
    const eventCols = await db.select<{ name: string }[]>("PRAGMA table_info(events)");
    const colNames  = eventCols.map(c => c.name);
    if (!colNames.includes("event_status"))
      await db.execute("ALTER TABLE events ADD COLUMN event_status TEXT DEFAULT 'active'");
    if (!colNames.includes("status_reason"))
      await db.execute("ALTER TABLE events ADD COLUMN status_reason TEXT");
    await db.execute("INSERT INTO db_migrations (version) VALUES (3)");
  }

  // Migration 4: Add is_comeback to tasks + create missed_log table
  if (!versions.has(4)) {
    const taskCols = await db.select<{ name: string }[]>("PRAGMA table_info(tasks)");
    const taskColNames = taskCols.map(c => c.name);
    if (!taskColNames.includes("is_comeback"))
      await db.execute("ALTER TABLE tasks ADD COLUMN is_comeback INTEGER DEFAULT 0");
    await db.execute(`
      CREATE TABLE IF NOT EXISTS missed_log (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type      TEXT NOT NULL DEFAULT 'task',
        source_id        INTEGER,
        title            TEXT NOT NULL,
        reflection_text  TEXT,
        reflection_points INTEGER DEFAULT 0,
        missed_date      TEXT DEFAULT (date('now')),
        created_at       TEXT DEFAULT (datetime('now'))
      )
    `);
    await db.execute("INSERT INTO db_migrations (version) VALUES (4)");
  }

  // Migration 5: Add award_points + points_value to events; create event_occurrences table
  if (!versions.has(5)) {
    const eventCols = await db.select<{ name: string }[]>("PRAGMA table_info(events)");
    const colNames  = eventCols.map(c => c.name);
    if (!colNames.includes("award_points"))
      await db.execute("ALTER TABLE events ADD COLUMN award_points INTEGER DEFAULT 0");
    if (!colNames.includes("points_value"))
      await db.execute("ALTER TABLE events ADD COLUMN points_value INTEGER DEFAULT 10");
    await db.execute(`
      CREATE TABLE IF NOT EXISTS event_occurrences (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id         INTEGER NOT NULL,
        occurrence_date  TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'completed',
        points_awarded   INTEGER DEFAULT 0,
        created_at       TEXT DEFAULT (datetime('now')),
        UNIQUE(event_id, occurrence_date)
      )
    `);
    await db.execute("INSERT INTO db_migrations (version) VALUES (5)");
  }

  // Migration 6: Expand goals table with type/tracking columns + 3 new tables
  if (!versions.has(6)) {
    const goalCols = await db.select<{ name: string }[]>("PRAGMA table_info(goals)");
    const gcNames  = goalCols.map(c => c.name);
    if (!gcNames.includes("goal_type"))
      await db.execute("ALTER TABLE goals ADD COLUMN goal_type TEXT DEFAULT 'standard'");
    if (!gcNames.includes("target_value"))
      await db.execute("ALTER TABLE goals ADD COLUMN target_value REAL");
    if (!gcNames.includes("current_value"))
      await db.execute("ALTER TABLE goals ADD COLUMN current_value REAL DEFAULT 0");
    if (!gcNames.includes("unit"))
      await db.execute("ALTER TABLE goals ADD COLUMN unit TEXT");
    if (!gcNames.includes("check_in_frequency"))
      await db.execute("ALTER TABLE goals ADD COLUMN check_in_frequency TEXT DEFAULT 'manual'");
    if (!gcNames.includes("start_date"))
      await db.execute("ALTER TABLE goals ADD COLUMN start_date TEXT");
    if (!gcNames.includes("streak_mode"))
      await db.execute("ALTER TABLE goals ADD COLUMN streak_mode TEXT DEFAULT 'strict'");
    if (!gcNames.includes("cheat_days_per_week"))
      await db.execute("ALTER TABLE goals ADD COLUMN cheat_days_per_week INTEGER DEFAULT 0");
    if (!gcNames.includes("streak_current"))
      await db.execute("ALTER TABLE goals ADD COLUMN streak_current INTEGER DEFAULT 0");
    if (!gcNames.includes("streak_best"))
      await db.execute("ALTER TABLE goals ADD COLUMN streak_best INTEGER DEFAULT 0");
    if (!gcNames.includes("last_check_in_date"))
      await db.execute("ALTER TABLE goals ADD COLUMN last_check_in_date TEXT");

    await db.execute(`
      CREATE TABLE IF NOT EXISTS goal_check_ins (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id         INTEGER NOT NULL,
        check_in_date   TEXT NOT NULL,
        value           REAL,
        notes           TEXT,
        is_success      INTEGER DEFAULT 1,
        is_cheat_day    INTEGER DEFAULT 0,
        points_awarded  INTEGER DEFAULT 0,
        created_at      TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS goal_milestones (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id        INTEGER NOT NULL,
        title          TEXT NOT NULL,
        target_date    TEXT,
        completed_date TEXT,
        points_value   INTEGER DEFAULT 5,
        sort_order     INTEGER DEFAULT 0,
        created_at     TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS goal_event_links (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id     INTEGER NOT NULL,
        event_type  TEXT NOT NULL,
        created_at  TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
      )
    `);
    await db.execute("INSERT INTO db_migrations (version) VALUES (6)");
  }

  // Migration 7: Add more motivational & LOA quotes
  if (!versions.has(7)) {
    const countResult = await db.select<[{ count: number }]>(
      "SELECT COUNT(*) as count FROM quotes WHERE is_custom = 0"
    );
    if (countResult[0].count <= 15) {
      const newQuotes: [string, string][] = [
        ["What you think, you become. What you feel, you attract. What you imagine, you create.", "Buddha"],
        ["Ask for what you want and be prepared to get it.", "Maya Angelou"],
        ["What you seek is seeking you.", "Rumi"],
        ["When you want something, all the universe conspires in helping you to achieve it.", "Paulo Coelho"],
        ["Change your thoughts and you change your world.", "Norman Vincent Peale"],
        ["Abundance is not something we acquire. It is something we tune into.", "Wayne Dyer"],
        ["Act as if what you intend to manifest is already a reality.", "Wayne Dyer"],
        ["Your imagination is your preview of life's coming attractions.", "Albert Einstein"],
        ["Everything is energy and that's all there is to it.", "Albert Einstein"],
        ["A burning desire is the starting point of all accomplishment.", "Napoleon Hill"],
        ["You are the master of your destiny. You can influence, direct and control your own environment.", "Napoleon Hill"],
        ["Success comes to those who become success-conscious.", "Napoleon Hill"],
        ["The universe is responding to the vibrational attitude you are emitting.", "Abraham Hicks"],
        ["You are the creator of your own reality.", "Abraham Hicks"],
        ["Be the energy you want to attract.", "Unknown"],
        ["Energy flows where intention goes.", "Unknown"],
        ["See the things you want as already yours.", "Rhonda Byrne"],
        ["Ask. Believe. Receive.", "Rhonda Byrne"],
        ["The universe always has your back.", "Gabrielle Bernstein"],
        ["Gratitude is the open door to abundance.", "Yogi Bhajan"],
        ["To bring anything into your life, imagine that it's already there.", "Richard Bach"],
        ["You attract what you are, not what you want. If you want great, then be great.", "Unknown"],
        ["In order to attract more of the blessings life has to offer, you must truly appreciate what you already have.", "Ralph Marston"],
        ["The secret of attraction is to love yourself.", "Unknown"],
        ["Set your intentions, take inspired action, and trust the process.", "Unknown"],
      ];
      for (const [text, author] of newQuotes) {
        await db.execute(
          "INSERT INTO quotes (text, author, is_custom) VALUES (?, ?, 0)",
          [text, author]
        );
      }
    }
    await db.execute("INSERT INTO db_migrations (version) VALUES (7)");
  }

  // Migration 8: Ensure affirmations.is_active + quotes.is_active columns exist
  if (!versions.has(8)) {
    const affCols = await db.select<{ name: string }[]>("PRAGMA table_info(affirmations)");
    const affNames = affCols.map(c => c.name);
    if (!affNames.includes("is_active"))
      await db.execute("ALTER TABLE affirmations ADD COLUMN is_active INTEGER DEFAULT 1");

    const qtCols = await db.select<{ name: string }[]>("PRAGMA table_info(quotes)");
    const qtNames = qtCols.map(c => c.name);
    if (!qtNames.includes("is_active"))
      await db.execute("ALTER TABLE quotes ADD COLUMN is_active INTEGER DEFAULT 1");

    await db.execute("INSERT INTO db_migrations (version) VALUES (8)");
  }

  // Migration 9: Fix NULL is_active values — ALTER TABLE ADD COLUMN leaves existing
  // rows as NULL (not the DEFAULT), so the QuoteStrip WHERE is_active=1 filter
  // returns nothing. Patch all NULLs to 1 so existing seeded data is visible.
  if (!versions.has(9)) {
    await db.execute("UPDATE quotes SET is_active = 1 WHERE is_active IS NULL");
    await db.execute("UPDATE affirmations SET is_active = 1 WHERE is_active IS NULL");
    await db.execute("INSERT INTO db_migrations (version) VALUES (9)");
  }

  // Migration 10: Add image_fit to vision_board_items
  // 'cover' = crop to fill card (good for landscape)
  // 'contain' = show full image with blurred backdrop (good for portrait)
  if (!versions.has(10)) {
    const vbCols  = await db.select<{ name: string }[]>("PRAGMA table_info(vision_board_items)");
    const vbNames = vbCols.map(c => c.name);
    if (!vbNames.includes("image_fit"))
      await db.execute("ALTER TABLE vision_board_items ADD COLUMN image_fit TEXT DEFAULT 'cover'");
    await db.execute("INSERT INTO db_migrations (version) VALUES (10)");
  }

  // Migration 11: Add text_font to vision_board_items
  // Stores Google Font family name for decorative text-only cards.
  // Empty string = normal card style.
  if (!versions.has(11)) {
    const vbCols  = await db.select<{ name: string }[]>("PRAGMA table_info(vision_board_items)");
    const vbNames = vbCols.map(c => c.name);
    if (!vbNames.includes("text_font"))
      await db.execute("ALTER TABLE vision_board_items ADD COLUMN text_font TEXT DEFAULT ''");
    await db.execute("INSERT INTO db_migrations (version) VALUES (11)");
  }

  // Migration 12: Daily to-do list
  if (!versions.has(12)) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS todos (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        text       TEXT NOT NULL,
        completed  INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await db.execute("INSERT INTO db_migrations (version) VALUES (12)");
  }

  // Migration 13: Add date column to todos for daily pagination
  if (!versions.has(13)) {
    const todoCols = await db.select<{ name: string }[]>("PRAGMA table_info(todos)");
    const todoNames = todoCols.map(c => c.name);
    if (!todoNames.includes("date"))
      await db.execute(`ALTER TABLE todos ADD COLUMN "date" TEXT`);
    // Backfill existing rows from created_at so they appear on the correct day
    await db.execute(`UPDATE todos SET "date" = date(created_at) WHERE "date" IS NULL`);
    await db.execute("INSERT INTO db_migrations (version) VALUES (13)");
  }

  // Migration 14: Add notes column to todos
  if (!versions.has(14)) {
    const todoCols = await db.select<{ name: string }[]>("PRAGMA table_info(todos)");
    const todoNames = todoCols.map(c => c.name);
    if (!todoNames.includes("notes"))
      await db.execute(`ALTER TABLE todos ADD COLUMN notes TEXT DEFAULT ''`);
    await db.execute("INSERT INTO db_migrations (version) VALUES (14)");
  }

  // Migration 15: 30-Day Ascend Challenge tables
  if (!versions.has(15)) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS challenge_enrollments (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        challenge_id  TEXT NOT NULL DEFAULT '30day_ascend',
        started_at    TEXT NOT NULL DEFAULT (datetime('now')),
        deadline_date TEXT NOT NULL,
        completed_at  TEXT,
        failed_at     TEXT,
        points_awarded INTEGER DEFAULT 0,
        created_at    TEXT DEFAULT (datetime('now'))
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS challenge_responses (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_id INTEGER NOT NULL,
        day_number    INTEGER NOT NULL,
        response_text TEXT NOT NULL DEFAULT '',
        completed_at  TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (enrollment_id) REFERENCES challenge_enrollments(id) ON DELETE CASCADE
      )
    `);
    await db.execute("INSERT INTO db_migrations (version) VALUES (15)");
  }

  // Migration 16: Letter to Future Self
  if (!versions.has(16)) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS future_letters (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        content        TEXT NOT NULL DEFAULT '',
        written_at     TEXT NOT NULL DEFAULT (datetime('now')),
        unlock_date    TEXT NOT NULL,
        opened_at      TEXT,
        points_awarded INTEGER DEFAULT 0,
        created_at     TEXT DEFAULT (datetime('now'))
      )
    `);
    await db.execute("INSERT INTO db_migrations (version) VALUES (16)");
  }

  // Migration 17: Recalculate all points with final approved point values
  // Journal: 5 pts, Gratitude: 3 pts for first 3/day then 1 pt, +10 bonus at 9/day
  // Task default: 10 pts, Goal default: 25 pts, Milestone default: 15 pts
  // Challenge: 500 pts, Letters: 75 pts each
  if (!versions.has(17)) {
    // Step 1: Update existing records to new default point values
    // Only update items that still have the old default (user may have customized some)
    await db.execute(`UPDATE tasks SET points_value = 10 WHERE points_value = 5`);
    await db.execute(`UPDATE goals SET points_value = 25 WHERE points_value = 10`);
    await db.execute(`UPDATE goal_milestones SET points_value = 15 WHERE points_value = 5`);

    // Step 2: Wipe points_log entirely
    await db.execute(`DELETE FROM points_log`);

    // Step 3: Rebuild from journal entries (5 pts each)
    await db.execute(`
      INSERT INTO points_log (points, reason, source_type, source_id, entry_date)
      SELECT 5, 'Journal entry', 'journal', id, entry_date
      FROM journal_entries
    `);

    // Step 4: Rebuild from gratitudes — tiered: 3 pts for positions 1-3 per day, 1 pt after
    await db.execute(`
      INSERT INTO points_log (points, reason, source_type, source_id, entry_date)
      SELECT
        CASE WHEN row_num <= 3 THEN 3 ELSE 1 END,
        'Gratitude',
        'gratitude',
        id,
        entry_date
      FROM (
        SELECT id, entry_date,
          ROW_NUMBER() OVER (PARTITION BY entry_date ORDER BY id) as row_num
        FROM gratitudes
      )
    `);

    // Step 5: Bonus 10 pts for each day with 9+ gratitudes
    await db.execute(`
      INSERT INTO points_log (points, reason, source_type, entry_date)
      SELECT 10, 'Daily gratitude bonus (9+ gratitudes)', 'gratitude', entry_date
      FROM (
        SELECT entry_date, COUNT(*) as cnt
        FROM gratitudes
        GROUP BY entry_date
        HAVING cnt >= 9
      )
    `);

    // Step 6: Rebuild from completed tasks
    await db.execute(`
      INSERT INTO points_log (points, reason, source_type, source_id, entry_date)
      SELECT points_value, 'Completed: ' || title, 'task', id,
             COALESCE(date(completed_at, 'localtime'), date('now'))
      FROM tasks
      WHERE status = 'completed' AND completed_at IS NOT NULL
    `);

    // Step 7: Rebuild from completed goals
    await db.execute(`
      INSERT INTO points_log (points, reason, source_type, source_id, entry_date)
      SELECT points_value, 'Completed goal: ' || title, 'goal', id,
             COALESCE(date(completed_at, 'localtime'), date('now'))
      FROM goals
      WHERE status = 'completed' AND completed_at IS NOT NULL
    `);

    // Step 8: Rebuild from completed milestones
    await db.execute(`
      INSERT INTO points_log (points, reason, source_type, source_id, entry_date)
      SELECT points_value, '🏁 Milestone: ' || title, 'milestone', id, completed_date
      FROM goal_milestones
      WHERE completed_date IS NOT NULL
    `);

    // Step 9: Rebuild from completed challenges (500 pts each)
    try {
      await db.execute(`
        INSERT INTO points_log (points, reason, source_type, source_id, entry_date)
        SELECT 500, '🏆 Completed the 30-Day Ascend Challenge!', 'challenge', id,
               COALESCE(date(completed_at, 'localtime'), date('now'))
        FROM challenge_enrollments
        WHERE completed_at IS NOT NULL
      `);
    } catch { /* table may not exist */ }

    // Step 10: Rebuild from future letters written (75 pts each)
    try {
      await db.execute(`
        INSERT INTO points_log (points, reason, source_type, source_id, entry_date)
        SELECT 75, '✉️ Wrote a Letter to My Future Self', 'future_letter', id,
               date(written_at, 'localtime')
        FROM future_letters
      `);
    } catch { /* table may not exist */ }

    // Step 11: Rebuild from future letters read (75 pts each)
    try {
      await db.execute(`
        INSERT INTO points_log (points, reason, source_type, source_id, entry_date)
        SELECT 75, '📬 Read my Letter to Future Self', 'future_letter', id,
               date(opened_at, 'localtime')
        FROM future_letters
        WHERE opened_at IS NOT NULL
      `);
    } catch { /* table may not exist */ }

    await db.execute("INSERT INTO db_migrations (version) VALUES (17)");
  }
}

async function initializeSchema(db: Database): Promise<void> {
  // Run migrations first (handles existing DBs with old schema)
  await runMigrations(db);

  // Profile
  await db.execute(`
    CREATE TABLE IF NOT EXISTS profile (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      first_name TEXT NOT NULL DEFAULT '',
      last_name  TEXT,
      username   TEXT,
      email      TEXT NOT NULL DEFAULT '',
      pin        TEXT,
      country    TEXT,
      timezone   TEXT DEFAULT 'America/Chicago',
      avatar_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Goals
  await db.execute(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'life',
      type TEXT NOT NULL DEFAULT 'daily',
      status TEXT NOT NULL DEFAULT 'active',
      is_long_term INTEGER DEFAULT 0,
      parent_goal_id INTEGER,
      target_date TEXT,
      completed_at TEXT,
      points_value INTEGER DEFAULT 25,
      goal_type TEXT DEFAULT 'standard',
      target_value REAL,
      current_value REAL DEFAULT 0,
      unit TEXT,
      check_in_frequency TEXT DEFAULT 'manual',
      start_date TEXT,
      streak_mode TEXT DEFAULT 'strict',
      cheat_days_per_week INTEGER DEFAULT 0,
      streak_current INTEGER DEFAULT 0,
      streak_best INTEGER DEFAULT 0,
      last_check_in_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (parent_goal_id) REFERENCES goals(id)
    )
  `);

  // Goal Check-ins (per-occurrence tracking for metric & habit goals)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS goal_check_ins (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id         INTEGER NOT NULL,
      check_in_date   TEXT NOT NULL,
      value           REAL,
      notes           TEXT,
      is_success      INTEGER DEFAULT 1,
      is_cheat_day    INTEGER DEFAULT 0,
      points_awarded  INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
    )
  `);

  // Goal Milestones (ordered checklist items for milestone goals)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS goal_milestones (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id        INTEGER NOT NULL,
      title          TEXT NOT NULL,
      target_date    TEXT,
      completed_date TEXT,
      points_value   INTEGER DEFAULT 15,
      sort_order     INTEGER DEFAULT 0,
      created_at     TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
    )
  `);

  // Goal Event Links (link calendar event types to goals for auto check-in)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS goal_event_links (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id     INTEGER NOT NULL,
      event_type  TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
    )
  `);

  // Tasks
  await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'general',
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      goal_id INTEGER,
      scheduled_date TEXT,
      scheduled_time TEXT,
      due_date TEXT,
      completed_at TEXT,
      points_value INTEGER DEFAULT 10,
      is_from_journal INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (goal_id) REFERENCES goals(id)
    )
  `);

  // Calendar Events / Appointments
  await db.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      event_type TEXT DEFAULT 'appointment',
      start_datetime TEXT NOT NULL,
      end_datetime TEXT,
      all_day INTEGER DEFAULT 0,
      recurrence TEXT,
      reminder_minutes INTEGER DEFAULT 15,
      task_id INTEGER,
      goal_id INTEGER,
      color TEXT DEFAULT '#f59e0b',
      event_status TEXT DEFAULT 'active',
      status_reason TEXT,
      award_points INTEGER DEFAULT 0,
      points_value INTEGER DEFAULT 10,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Event Occurrences (tracks completion/missed status for individual recurring occurrences)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS event_occurrences (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id         INTEGER NOT NULL,
      occurrence_date  TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'completed',
      points_awarded   INTEGER DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now')),
      UNIQUE(event_id, occurrence_date)
    )
  `);

  // Gratitudes
  await db.execute(`
    CREATE TABLE IF NOT EXISTS gratitudes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      period TEXT NOT NULL DEFAULT 'morning',
      entry_date TEXT NOT NULL DEFAULT (date('now')),
      points_awarded INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Journal Entries
  await db.execute(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      entry_date TEXT NOT NULL DEFAULT (date('now')),
      mood INTEGER DEFAULT 5,
      word_count INTEGER DEFAULT 0,
      points_awarded INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Journal Detected Items (temp holding for approval)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS journal_detected (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journal_entry_id INTEGER NOT NULL,
      detected_text TEXT NOT NULL,
      suggested_type TEXT NOT NULL DEFAULT 'task',
      suggested_title TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
    )
  `);

  // Affirmations
  await db.execute(`
    CREATE TABLE IF NOT EXISTS affirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      author TEXT,
      category TEXT DEFAULT 'general',
      is_custom INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Quotes
  await db.execute(`
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      author TEXT,
      category TEXT DEFAULT 'general',
      is_custom INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Points Log
  await db.execute(`
    CREATE TABLE IF NOT EXISTS points_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      points INTEGER NOT NULL,
      reason TEXT NOT NULL,
      source_type TEXT,
      source_id INTEGER,
      entry_date TEXT DEFAULT (date('now')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Vision Board Items
  await db.execute(`
    CREATE TABLE IF NOT EXISTS vision_board_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      description TEXT,
      image_url   TEXT,
      category    TEXT NOT NULL DEFAULT 'general',
      size        TEXT NOT NULL DEFAULT 'medium',
      sort_order  INTEGER DEFAULT 0,
      accent_color TEXT DEFAULT '#5090e0',
      image_fit   TEXT DEFAULT 'cover',
      text_font   TEXT DEFAULT '',
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  // Rewards
  await db.execute(`
    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      points_required INTEGER NOT NULL,
      is_claimed INTEGER DEFAULT 0,
      claimed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Seed default affirmations if empty
  const affCount = await db.select<[{ count: number }]>(
    "SELECT COUNT(*) as count FROM affirmations"
  );
  if (affCount[0].count === 0) {
    await seedAffirmations(db);
  }

  // Seed default quotes if empty
  const quoteCount = await db.select<[{ count: number }]>(
    "SELECT COUNT(*) as count FROM quotes"
  );
  if (quoteCount[0].count === 0) {
    await seedQuotes(db);
  }
}

async function seedAffirmations(db: Database): Promise<void> {
  const affirmations = [
    ["I am worthy of all the abundance life has to offer.", "LOA"],
    ["Every day I am becoming a better version of myself.", "LOA"],
    ["I attract positive energy and positive people.", "LOA"],
    ["My goals and dreams are within reach.", "LOA"],
    ["I am grateful for everything I have and everything coming to me.", "LOA"],
    ["I radiate confidence, self-respect, and inner harmony.", "LOA"],
    ["I am aligned with the energy of abundance and prosperity.", "LOA"],
    ["I trust the process and believe in my journey.", "LOA"],
    ["I am open to receiving miracles.", "LOA"],
    ["My mind is clear, focused, and full of positive thoughts.", "LOA"],
    ["I am the architect of my life and I build its foundation.", "LOA"],
    ["Success flows to me naturally and effortlessly.", "LOA"],
    ["I deserve love, happiness, and the best life has to offer.", "LOA"],
    ["I am grateful for my healthy body, mind, and spirit.", "LOA"],
    ["I am a magnet for all things wonderful.", "LOA"],
    ["Every challenge I face is an opportunity to grow.", "LOA"],
    ["I have the power to create the life I desire.", "LOA"],
    ["I am surrounded by people who lift me higher.", "LOA"],
    ["My potential is limitless and my future is bright.", "LOA"],
    ["I choose joy, growth, and gratitude every single day.", "LOA"],
  ];
  for (const [text, author] of affirmations) {
    await db.execute(
      "INSERT INTO affirmations (text, author, is_custom) VALUES (?, ?, 0)",
      [text, author]
    );
  }
}

async function seedQuotes(db: Database): Promise<void> {
  const quotes = [
    ["The only way to do great work is to love what you do.", "Steve Jobs"],
    ["Believe you can and you're halfway there.", "Theodore Roosevelt"],
    ["It always seems impossible until it's done.", "Nelson Mandela"],
    ["Your only limit is your mind.", "Unknown"],
    ["Dream big and dare to fail.", "Norman Vaughan"],
    ["The future belongs to those who believe in the beauty of their dreams.", "Eleanor Roosevelt"],
    ["What you think, you become. What you feel, you attract. What you imagine, you create.", "Buddha"],
    ["Ask for what you want and be prepared to get it.", "Maya Angelou"],
    ["The secret of getting ahead is getting started.", "Mark Twain"],
    ["You are never too old to set another goal or dream a new dream.", "C.S. Lewis"],
    ["Everything you want is on the other side of fear.", "Jack Canfield"],
    ["Once you make a decision, the universe conspires to make it happen.", "Ralph Waldo Emerson"],
    ["Visualization is daydreaming with a purpose.", "Bo Bennett"],
    ["The more you praise and celebrate your life, the more there is in life to celebrate.", "Oprah Winfrey"],
    ["Whatever the mind can conceive and believe, it can achieve.", "Napoleon Hill"],
  ];
  for (const [text, author] of quotes) {
    await db.execute(
      "INSERT INTO quotes (text, author, is_custom) VALUES (?, ?, 0)",
      [text, author]
    );
  }
}

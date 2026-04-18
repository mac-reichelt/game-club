/**
 * Seed the database with real election data from game club history.
 * Run with: npm run seed
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(salt + password)
    .digest("hex");
  return `${salt}:${hash}`;
}

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, "gameclub.db");
// Remove existing database so we start fresh
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create schema
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    avatar TEXT NOT NULL DEFAULT '🎮',
    password_hash TEXT NOT NULL DEFAULT '',
    disabled INTEGER NOT NULL DEFAULT 0,
    joined_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    stores_json TEXT NOT NULL DEFAULT '',
    trailer_url TEXT NOT NULL DEFAULT '',
    nominated_by INTEGER NOT NULL REFERENCES members(id),
    nominated_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'nominated' CHECK(status IN ('nominated', 'current', 'completed')),
    scheduled_date TEXT,
    completed_date TEXT,
    avg_rating REAL
  );

  CREATE TABLE IF NOT EXISTS elections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT,
    closes_at TEXT,
    winner_id INTEGER REFERENCES games(id)
  );

  CREATE TABLE IF NOT EXISTS election_games (
    election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    PRIMARY KEY (election_id, game_id)
  );

  CREATE TABLE IF NOT EXISTS ballots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id),
    game_id INTEGER NOT NULL REFERENCES games(id),
    rank INTEGER NOT NULL CHECK(rank >= 1),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(election_id, member_id, rank),
    UNIQUE(election_id, member_id, game_id)
  );

  CREATE TABLE IF NOT EXISTS election_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    eliminated_game_id INTEGER REFERENCES games(id),
    summary TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id),
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(game_id, member_id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
`);

// ----- Members (anonymous voters, disabled) -----
const pw = hashPassword("gameclub");
db.prepare("INSERT INTO members (name, avatar, password_hash, disabled) VALUES (?, ?, ?, 1)").run("P1", "🎮", pw);
db.prepare("INSERT INTO members (name, avatar, password_hash, disabled) VALUES (?, ?, ?, 1)").run("P2", "🕹️", pw);
db.prepare("INSERT INTO members (name, avatar, password_hash, disabled) VALUES (?, ?, ?, 1)").run("P3", "👾", pw);
db.prepare("INSERT INTO members (name, avatar, password_hash, disabled) VALUES (?, ?, ?, 1)").run("P4", "🎯", pw);
db.prepare("INSERT INTO members (name, avatar, password_hash, disabled) VALUES (?, ?, ?, 1)").run("P5", "🏆", pw);
db.prepare("INSERT INTO members (name, avatar, password_hash, disabled) VALUES (?, ?, ?, 1)").run("P6", "⭐", pw);
db.prepare("INSERT INTO members (name, avatar, password_hash, disabled) VALUES (?, ?, ?, 1)").run("P7", "🎲", pw);

// ----- Games -----
const insertGame = db.prepare(
  "INSERT INTO games (id, title, nominated_by, status, completed_date) VALUES (?, ?, 1, ?, ?)"
);
insertGame.run(1, "The Ascent", "nominated", null);
insertGame.run(2, "Darkest Dungeon", "nominated", null);
insertGame.run(3, "Sunset Overdrive", "completed", "2021-08-02");
insertGame.run(4, "Boyfriend Dungeon", "nominated", null);
insertGame.run(5, "Twelve Minutes", "nominated", null);
insertGame.run(6, "Art of Rally", "completed", "2021-09-13");
insertGame.run(7, "Hades", "nominated", null);
insertGame.run(8, "Spiritfarer", "nominated", null);
insertGame.run(9, "Psychonauts 2", "completed", "2021-10-05");
insertGame.run(10, "Forza Horizon 5", "completed", "2021-11-09");
insertGame.run(11, "Deathloop", "nominated", null);
insertGame.run(12, "Metroid Dread", "nominated", null);
insertGame.run(13, "Riftbreaker", "nominated", null);
insertGame.run(14, "Mind Scanners", "nominated", null);
insertGame.run(15, "Whatever You Want (Open Forum)", "completed", "2021-12-04");
insertGame.run(16, "Flight Simulator", "nominated", null);
insertGame.run(17, "Outer Wilds: Echoes of the Eye (DLC)", "nominated", null);
insertGame.run(18, "Hitman 2 - Miami Level", "completed", "2022-02-08");
insertGame.run(19, "Death's Door", "completed", "2022-05-10");
insertGame.run(20, "Dreamscaper", "nominated", null);
insertGame.run(21, "Olija", "nominated", null);
insertGame.run(22, "Echo Generation", "nominated", null);
insertGame.run(23, "The Forgotten City", "completed", "2022-03-09");
insertGame.run(24, "Myst", "nominated", null);
insertGame.run(25, "Paradise Killer", "nominated", null);
insertGame.run(26, "Weird West", "completed", "2022-04-05");
insertGame.run(27, "Tunic", "completed", "2022-10-11");
insertGame.run(28, "Open Forum (Whatever You Want)", "nominated", null);
insertGame.run(29, "Axiom Verge", "nominated", null);
insertGame.run(30, "Sable", "completed", "2022-07-04");
insertGame.run(31, "F1 2021", "nominated", null);
insertGame.run(32, "Chorus", "nominated", null);
insertGame.run(33, "Flight Sim - F-18 Carrier Challenge", "completed", "2022-06-06");
insertGame.run(34, "Soundfall", "nominated", null);
insertGame.run(35, "Ghostwire: Tokyo", "nominated", null);
insertGame.run(36, "Road 96", "completed", "2022-09-05");
insertGame.run(37, "Shenzhen I/O", "nominated", null);
insertGame.run(38, "TMNT: Shredder's Revenge", "completed", "2022-08-09");
insertGame.run(39, "As Dusk Falls", "nominated", null);
insertGame.run(40, "Lost in Random", "nominated", null);
insertGame.run(41, "Enslaved: Odyssey to the West", "nominated", null);
insertGame.run(42, "Grounded", "nominated", null);
insertGame.run(43, "Beacon Pines", "nominated", null);
insertGame.run(44, "Vampire Survivors", "nominated", null);
insertGame.run(45, "The Wolf Among Us", "completed", "2022-11-08");
insertGame.run(46, "A Plague Tale: Requiem", "nominated", null);
insertGame.run(47, "Pentiment", "completed", "2022-12-06");
insertGame.run(48, "Norco", "completed", "2023-01-10");
insertGame.run(49, "Warhammer 40K: Darktide", "nominated", null);
insertGame.run(50, "Return to Monkey Island", "completed", "2023-04-11");
insertGame.run(51, "Hi-Fi Rush", "completed", "2023-02-07");
insertGame.run(52, "Wanted: Dead", "nominated", null);
insertGame.run(53, "Dead Space (2008 or 2023)", "completed", "2023-03-07");
insertGame.run(54, "Coffee Talk", "nominated", null);
insertGame.run(55, "Immortality", "nominated", null);
insertGame.run(56, "Unpacking", "nominated", null);
insertGame.run(57, "Inside", "completed", "2023-05-09");
insertGame.run(58, "Citizen Sleeper", "completed", "2023-06-06");
insertGame.run(59, "Prey (2017)", "nominated", null);
insertGame.run(60, "Dredge", "nominated", null);
insertGame.run(61, "NFS: Unbound", "completed", "2023-07-12");
insertGame.run(62, "Gerda: A Flame in Winter", "nominated", null);
insertGame.run(63, "Venba", "completed", "2023-09-05");
insertGame.run(64, "Baldur's Gate 3", "nominated", null);
insertGame.run(65, "Quake 2", "nominated", null);
insertGame.run(66, "The Expanse: A Telltale Series", "completed", "2023-11-07");
insertGame.run(67, "Scorn", "nominated", null);
insertGame.run(68, "A Short Hike", "completed", "2023-10-06");
insertGame.run(69, "Cocoon", "nominated", null);
insertGame.run(70, "En Garde!", "nominated", null);
insertGame.run(71, "Chants of Sennaar", "nominated", null);
insertGame.run(72, "Thirsty Suitors", "completed", "2023-12-05");
insertGame.run(73, "Jusant", "completed", "2024-01-09");
insertGame.run(74, "Sifu", "completed", "2024-02-06");
insertGame.run(75, "Against the Storm", "nominated", null);
insertGame.run(76, "Palworld", "nominated", null);
insertGame.run(77, "Lies of P", "nominated", null);
insertGame.run(78, "Bloodstained: Ritual of the Night", "completed", "2024-03-12");
insertGame.run(79, "Warhammer 40K: Boltgun", "nominated", null);
insertGame.run(80, "Rollerdrome", "nominated", null);
insertGame.run(81, "Dune: Spice Wars", "nominated", null);
insertGame.run(82, "Lil Gator Game", "nominated", null);
insertGame.run(83, "Open Roads", "completed", "2024-04-09");
insertGame.run(84, "Star Wars Jedi: Survivor", "nominated", null);
insertGame.run(85, "Ori and the Will of the Wisps", "nominated", null);
insertGame.run(86, "Firewatch", "nominated", null);
insertGame.run(87, "Fallout", "completed", "2024-05-07");
insertGame.run(88, "Lake", "nominated", null);
insertGame.run(89, "Another Crab's Treasure", "completed", "2024-06-11");
insertGame.run(90, "Little Kitty Big City", "completed", "2024-07-16");
insertGame.run(91, "Hellblade 2", "completed", "2024-12-10");
insertGame.run(92, "The Case of the Golden Idol", "nominated", null);
insertGame.run(93, "Beyond Good & Evil", "completed", "2024-08-06");
insertGame.run(94, "Coral Island", "completed", "2024-09-10");
insertGame.run(95, "Dungeons of Hinterberg", "completed", "2025-01-07");
insertGame.run(96, "Thank Goodness You're Here!", "nominated", null);
insertGame.run(97, "Night in the Woods", "completed", "2024-10-08");
insertGame.run(98, "Strange Horticulture", "nominated", null);
insertGame.run(99, "We Love Katamari", "nominated", null);
insertGame.run(100, "Tactical Breach Wizards", "completed", "2024-11-05");
insertGame.run(101, "Arco", "nominated", null);
insertGame.run(102, "Shadows of Doubt", "nominated", null);
insertGame.run(103, "Nine Sols", "nominated", null);
insertGame.run(104, "Broken Age", "nominated", null);
insertGame.run(105, "1000xRESIST", "completed", "2025-02-11");
insertGame.run(106, "Unavowed", "nominated", null);
insertGame.run(107, "Citizen Sleeper 2", "completed", "2025-04-08");
insertGame.run(108, "Indiana Jones and the Great Circle", "completed", "2025-03-11");
insertGame.run(109, "Balatro", "nominated", null);
insertGame.run(110, "Eternal Strands", "nominated", null);
insertGame.run(111, "Clem", "nominated", null);
insertGame.run(112, "Knights in Tight Spaces", "nominated", null);
insertGame.run(113, "What the Car?", "nominated", null);
insertGame.run(114, "Jotun", "nominated", null);
insertGame.run(115, "Blue Prince", "nominated", null);
insertGame.run(116, "South of Midnight", "completed", "2025-05-06");
insertGame.run(117, "Nova Drift", "nominated", null);
insertGame.run(118, "Skin Deep", "nominated", null);
insertGame.run(119, "Crypt Custodian", "nominated", null);
insertGame.run(120, "Old Skies", "completed", "2025-06-10");
insertGame.run(121, "The Stanley Parable (any edition)", "completed", "2025-07-06");
insertGame.run(122, "OneShot", "nominated", null);
insertGame.run(123, "To a T", "nominated", null);
insertGame.run(124, "Tales of Kenzera: ZAU", "nominated", null);
insertGame.run(125, "Wheel World", "nominated", null);
insertGame.run(126, "NetHack", "completed", "2025-08-12");
insertGame.run(127, "The Outer Worlds", "completed", "2025-09-08");
insertGame.run(128, "Indiana Jones: The Order of Giants", "nominated", null);
insertGame.run(129, "I Am Your Beast", "nominated", null);
insertGame.run(130, "Cyber Knights: Flashpoint", "nominated", null);
insertGame.run(131, "Consume Me", "nominated", null);
insertGame.run(132, "Peak", "completed", "2025-10-07");
insertGame.run(133, "Keeper", "completed", "2025-11-04");
insertGame.run(134, "Dispatch", "completed", "2025-12-09");
insertGame.run(135, "Pacific Drive", "nominated", null);
insertGame.run(136, "Tiny Book Shop", "nominated", null);
insertGame.run(137, "Wolfenstein: The New Order", "completed", "2026-01-06");
insertGame.run(138, "Between Horizons", "nominated", null);
insertGame.run(139, "The Seance of Blake Manor", "nominated", null);
insertGame.run(140, "Routine", "nominated", null);
insertGame.run(141, "Disco Samurai", "completed", "2026-02-10");
insertGame.run(142, "Indika", "completed", "2026-03-09");
insertGame.run(143, "Sword of the Sea", "nominated", null);
insertGame.run(144, "Bioshock", "nominated", null);
insertGame.run(145, "Is This Seat Taken?", "nominated", null);
insertGame.run(146, "Commandos: Origins", "nominated", null);
insertGame.run(147, "Into the Breach", "current", null);

// ----- Elections -----
const insertElection = db.prepare(
  "INSERT INTO elections (id, name, status, created_at, closed_at, winner_id) VALUES (?, ?, 'closed', ?, ?, ?)"
);
insertElection.run(1, "August 2021", "2021-07-31 00:01:17", "2021-08-02 16:52:28", 3);
insertElection.run(2, "September 2021", "2021-09-13 16:20:32", "2021-09-13 19:58:56", 6);
insertElection.run(3, "October 2021", "2021-10-01 23:51:17", "2021-10-05 01:43:39", 9);
insertElection.run(4, "November 2021", "2021-11-05 23:38:41", "2021-11-09 16:18:31", 10);
insertElection.run(5, "December 2021", "2021-12-04 00:53:05", "2021-12-04 00:55:51", 15);
insertElection.run(6, "January 2022", "2022-01-08 01:38:38", "2022-01-10 17:50:31", 15);
insertElection.run(7, "February 2022", "2022-02-05 01:03:13", "2022-02-08 01:22:58", 18);
insertElection.run(8, "March 2022", "2022-03-05 01:08:40", "2022-03-09 17:39:10", 23);
insertElection.run(9, "April 2022", "2022-04-02 01:03:13", "2022-04-05 01:09:26", 26);
insertElection.run(10, "May 2022", "2022-05-06 23:38:25", "2022-05-10 00:36:49", 19);
insertElection.run(11, "June 2022", "2022-06-03 23:53:31", "2022-06-06 23:54:25", 33);
insertElection.run(12, "July 2022", "2022-06-30 23:44:57", "2022-07-04 15:12:27", 30);
insertElection.run(13, "August 2022", "2022-08-05 23:57:34", "2022-08-09 02:22:33", 38);
insertElection.run(14, "September 2022", "2022-09-02 23:39:56", "2022-09-05 23:46:38", 36);
insertElection.run(15, "October 2022", "2022-10-07 23:54:58", "2022-10-11 04:28:09", 27);
insertElection.run(16, "November 2022", "2022-11-05 00:09:03", "2022-11-08 01:21:04", 45);
insertElection.run(17, "December 2022", "2022-12-03 01:03:35", "2022-12-06 01:04:22", 47);
insertElection.run(18, "January 2023", "2023-01-07 01:50:02", "2023-01-10 04:42:20", 48);
insertElection.run(19, "February 2023", "2023-02-04 00:56:17", "2023-02-07 02:23:23", 51);
insertElection.run(20, "March 2023", "2023-03-04 01:05:05", "2023-03-07 03:31:50", 53);
insertElection.run(21, "April 2023", "2023-04-07 23:52:00", "2023-04-11 00:11:16", 50);
insertElection.run(22, "May 2023", "2023-05-06 00:02:15", "2023-05-09 04:19:37", 57);
insertElection.run(23, "June 2023", "2023-06-03 00:00:05", "2023-06-06 03:48:03", 58);
insertElection.run(24, "July 2023", "2023-07-08 00:16:40", "2023-07-12 00:21:06", 61);
insertElection.run(25, "September 2023", "2023-09-01 23:50:51", "2023-09-05 13:13:26", 63);
insertElection.run(26, "October 2023", "2023-10-06 23:44:25", "2023-10-06 23:46:30", 68);
insertElection.run(27, "November 2023", "2023-11-03 23:57:19", "2023-11-07 01:09:30", 66);
insertElection.run(28, "December 2023", "2023-12-02 01:42:35", "2023-12-05 02:00:03", 72);
insertElection.run(29, "January 2024", "2024-01-06 01:51:56", "2024-01-09 03:56:06", 73);
insertElection.run(30, "February 2024", "2024-02-03 00:59:27", "2024-02-06 04:09:49", 74);
insertElection.run(31, "March 2024", "2024-03-09 01:08:44", "2024-03-12 01:19:26", 78);
insertElection.run(32, "April 2024", "2024-04-05 23:46:02", "2024-04-09 00:58:57", 83);
insertElection.run(33, "May 2024", "2024-05-03 23:54:22", "2024-05-07 01:38:52", 87);
insertElection.run(34, "June 2024", "2024-06-07 23:32:24", "2024-06-11 01:09:34", 89);
insertElection.run(35, "July 2024", "2024-07-12 23:34:32", "2024-07-16 01:43:49", 90);
insertElection.run(36, "August 2024", "2024-08-03 00:01:52", "2024-08-06 00:04:37", 93);
insertElection.run(37, "September 2024", "2024-09-07 00:12:40", "2024-09-10 01:23:20", 94);
insertElection.run(38, "October 2024", "2024-10-04 23:53:40", "2024-10-08 00:49:02", 97);
insertElection.run(39, "November 2024", "2024-11-02 00:03:02", "2024-11-05 01:21:46", 100);
insertElection.run(40, "December 2024", "2024-12-07 01:07:01", "2024-12-10 01:18:55", 91);
insertElection.run(41, "January 2025", "2025-01-04 01:11:08", "2025-01-07 01:22:50", 95);
insertElection.run(42, "February 2025", "2025-02-08 01:33:29", "2025-02-11 03:16:22", 105);
insertElection.run(43, "March 2025", "2025-03-08 01:23:28", "2025-03-11 01:39:01", 108);
insertElection.run(44, "April 2025", "2025-04-05 00:06:26", "2025-04-08 01:10:47", 107);
insertElection.run(45, "May 2025", "2025-05-02 23:47:46", "2025-05-06 00:31:43", 116);
insertElection.run(46, "June 2025", "2025-06-07 00:12:08", "2025-06-10 00:47:39", 120);
insertElection.run(47, "July 2025", "2025-07-06 21:10:41", "2025-07-06 21:40:56", 121);
insertElection.run(48, "August 2025", "2025-08-09 00:03:50", "2025-08-12 00:03:43", 126);
insertElection.run(49, "September 2025", "2025-09-05 23:51:08", "2025-09-08 23:51:53", 127);
insertElection.run(50, "October 2025", "2025-10-04 00:14:02", "2025-10-07 01:15:50", 132);
insertElection.run(51, "November 2025", "2025-11-01 00:00:00", "2025-11-04 00:00:00", 133);
insertElection.run(52, "December 2025", "2025-12-06 00:00:00", "2025-12-09 00:00:00", 134);
insertElection.run(53, "January 2026", "2026-01-03 00:00:00", "2026-01-06 00:00:00", 137);
insertElection.run(54, "February 2026", "2026-02-07 00:00:00", "2026-02-10 00:00:00", 141);
insertElection.run(55, "March 2026", "2026-03-06 00:00:00", "2026-03-09 00:00:00", 142);
insertElection.run(56, "April 2026", "2026-04-10 00:00:00", "2026-04-13 00:00:00", 147);

// ----- Election Games -----
const insertEG = db.prepare(
  "INSERT INTO election_games (election_id, game_id) VALUES (?, ?)"
);
insertEG.run(1, 1);
insertEG.run(1, 2);
insertEG.run(1, 3);
insertEG.run(2, 4);
insertEG.run(2, 5);
insertEG.run(2, 6);
insertEG.run(2, 7);
insertEG.run(2, 8);
insertEG.run(3, 9);
insertEG.run(3, 4);
insertEG.run(3, 7);
insertEG.run(4, 10);
insertEG.run(4, 11);
insertEG.run(4, 12);
insertEG.run(4, 13);
insertEG.run(5, 11);
insertEG.run(5, 12);
insertEG.run(5, 7);
insertEG.run(5, 14);
insertEG.run(5, 15);
insertEG.run(6, 16);
insertEG.run(6, 11);
insertEG.run(6, 17);
insertEG.run(6, 12);
insertEG.run(6, 15);
insertEG.run(7, 18);
insertEG.run(7, 19);
insertEG.run(7, 20);
insertEG.run(7, 15);
insertEG.run(8, 21);
insertEG.run(8, 22);
insertEG.run(8, 15);
insertEG.run(8, 23);
insertEG.run(8, 24);
insertEG.run(9, 25);
insertEG.run(9, 26);
insertEG.run(9, 27);
insertEG.run(9, 28);
insertEG.run(10, 29);
insertEG.run(10, 30);
insertEG.run(10, 28);
insertEG.run(10, 31);
insertEG.run(10, 19);
insertEG.run(10, 27);
insertEG.run(11, 32);
insertEG.run(11, 30);
insertEG.run(11, 33);
insertEG.run(11, 4);
insertEG.run(12, 30);
insertEG.run(12, 34);
insertEG.run(12, 32);
insertEG.run(12, 35);
insertEG.run(13, 36);
insertEG.run(13, 37);
insertEG.run(13, 38);
insertEG.run(14, 32);
insertEG.run(14, 39);
insertEG.run(14, 36);
insertEG.run(14, 40);
insertEG.run(14, 41);
insertEG.run(15, 27);
insertEG.run(15, 39);
insertEG.run(15, 42);
insertEG.run(16, 43);
insertEG.run(16, 44);
insertEG.run(16, 45);
insertEG.run(16, 28);
insertEG.run(17, 46);
insertEG.run(17, 47);
insertEG.run(17, 28);
insertEG.run(17, 11);
insertEG.run(18, 28);
insertEG.run(18, 48);
insertEG.run(18, 49);
insertEG.run(18, 50);
insertEG.run(19, 51);
insertEG.run(19, 28);
insertEG.run(19, 44);
insertEG.run(19, 50);
insertEG.run(20, 52);
insertEG.run(20, 46);
insertEG.run(20, 44);
insertEG.run(20, 53);
insertEG.run(21, 50);
insertEG.run(21, 54);
insertEG.run(21, 55);
insertEG.run(21, 28);
insertEG.run(22, 56);
insertEG.run(22, 54);
insertEG.run(22, 57);
insertEG.run(23, 58);
insertEG.run(23, 59);
insertEG.run(23, 44);
insertEG.run(23, 28);
insertEG.run(24, 60);
insertEG.run(24, 61);
insertEG.run(24, 62);
insertEG.run(24, 28);
insertEG.run(25, 63);
insertEG.run(25, 64);
insertEG.run(25, 65);
insertEG.run(26, 66);
insertEG.run(26, 44);
insertEG.run(26, 67);
insertEG.run(26, 68);
insertEG.run(27, 69);
insertEG.run(27, 70);
insertEG.run(27, 71);
insertEG.run(27, 66);
insertEG.run(28, 71);
insertEG.run(28, 72);
insertEG.run(28, 73);
insertEG.run(29, 74);
insertEG.run(29, 75);
insertEG.run(29, 73);
insertEG.run(30, 76);
insertEG.run(30, 77);
insertEG.run(30, 69);
insertEG.run(30, 74);
insertEG.run(31, 78);
insertEG.run(31, 79);
insertEG.run(31, 76);
insertEG.run(31, 80);
insertEG.run(32, 81);
insertEG.run(32, 82);
insertEG.run(32, 83);
insertEG.run(33, 84);
insertEG.run(33, 85);
insertEG.run(33, 86);
insertEG.run(33, 87);
insertEG.run(34, 88);
insertEG.run(34, 89);
insertEG.run(34, 90);
insertEG.run(35, 91);
insertEG.run(35, 90);
insertEG.run(35, 92);
insertEG.run(36, 93);
insertEG.run(36, 91);
insertEG.run(36, 46);
insertEG.run(36, 43);
insertEG.run(36, 69);
insertEG.run(37, 94);
insertEG.run(37, 95);
insertEG.run(37, 96);
insertEG.run(38, 75);
insertEG.run(38, 95);
insertEG.run(38, 91);
insertEG.run(38, 97);
insertEG.run(39, 98);
insertEG.run(39, 99);
insertEG.run(39, 100);
insertEG.run(40, 101);
insertEG.run(40, 102);
insertEG.run(40, 91);
insertEG.run(41, 95);
insertEG.run(41, 103);
insertEG.run(41, 104);
insertEG.run(42, 105);
insertEG.run(42, 106);
insertEG.run(42, 92);
insertEG.run(43, 107);
insertEG.run(43, 108);
insertEG.run(43, 109);
insertEG.run(43, 110);
insertEG.run(44, 107);
insertEG.run(44, 111);
insertEG.run(44, 112);
insertEG.run(44, 113);
insertEG.run(45, 114);
insertEG.run(45, 115);
insertEG.run(45, 116);
insertEG.run(45, 117);
insertEG.run(46, 118);
insertEG.run(46, 60);
insertEG.run(46, 119);
insertEG.run(46, 120);
insertEG.run(47, 121);
insertEG.run(47, 122);
insertEG.run(47, 123);
insertEG.run(47, 88);
insertEG.run(48, 124);
insertEG.run(48, 125);
insertEG.run(48, 126);
insertEG.run(48, 127);
insertEG.run(49, 128);
insertEG.run(49, 127);
insertEG.run(49, 129);
insertEG.run(50, 130);
insertEG.run(50, 131);
insertEG.run(50, 132);
insertEG.run(51, 133);
insertEG.run(52, 134);
insertEG.run(52, 135);
insertEG.run(52, 136);
insertEG.run(53, 137);
insertEG.run(53, 138);
insertEG.run(53, 139);
insertEG.run(53, 140);
insertEG.run(54, 141);
insertEG.run(54, 142);
insertEG.run(54, 143);
insertEG.run(54, 144);
insertEG.run(54, 145);
insertEG.run(55, 142);
insertEG.run(56, 106); insertEG.run(56, 146); insertEG.run(56, 147);

// ----- Ballots (fabricated to produce correct winners) -----
const insertBallot = db.prepare(
  "INSERT INTO ballots (election_id, member_id, game_id, rank) VALUES (?, ?, ?, ?)"
);

// Election 1: August 2021 - Winner: Sunset Overdrive
insertBallot.run(1, 1, 3, 1);
insertBallot.run(1, 1, 1, 2);
insertBallot.run(1, 1, 2, 3);
insertBallot.run(1, 2, 3, 1);
insertBallot.run(1, 2, 1, 2);
insertBallot.run(1, 2, 2, 3);
insertBallot.run(1, 3, 3, 1);
insertBallot.run(1, 3, 1, 2);
insertBallot.run(1, 3, 2, 3);
insertBallot.run(1, 4, 3, 1);
insertBallot.run(1, 4, 1, 2);
insertBallot.run(1, 4, 2, 3);
insertBallot.run(1, 5, 2, 1);
insertBallot.run(1, 5, 3, 2);
insertBallot.run(1, 5, 1, 3);
insertBallot.run(1, 6, 1, 1);
insertBallot.run(1, 6, 3, 2);
insertBallot.run(1, 6, 2, 3);
insertBallot.run(1, 7, 2, 1);
insertBallot.run(1, 7, 3, 2);
insertBallot.run(1, 7, 1, 3);

// Election 2: September 2021 - Winner: Art of Rally
insertBallot.run(2, 1, 6, 1);
insertBallot.run(2, 1, 4, 2);
insertBallot.run(2, 1, 7, 3);
insertBallot.run(2, 1, 5, 4);
insertBallot.run(2, 1, 8, 5);
insertBallot.run(2, 2, 6, 1);
insertBallot.run(2, 2, 4, 2);
insertBallot.run(2, 2, 7, 3);
insertBallot.run(2, 2, 5, 4);
insertBallot.run(2, 2, 8, 5);
insertBallot.run(2, 3, 6, 1);
insertBallot.run(2, 3, 4, 2);
insertBallot.run(2, 3, 7, 3);
insertBallot.run(2, 3, 5, 4);
insertBallot.run(2, 3, 8, 5);
insertBallot.run(2, 4, 6, 1);
insertBallot.run(2, 4, 4, 2);
insertBallot.run(2, 4, 7, 3);
insertBallot.run(2, 4, 5, 4);
insertBallot.run(2, 4, 8, 5);
insertBallot.run(2, 5, 7, 1);
insertBallot.run(2, 5, 6, 2);
insertBallot.run(2, 5, 4, 3);
insertBallot.run(2, 5, 5, 4);
insertBallot.run(2, 5, 8, 5);
insertBallot.run(2, 6, 5, 1);
insertBallot.run(2, 6, 6, 2);
insertBallot.run(2, 6, 4, 3);
insertBallot.run(2, 6, 7, 4);
insertBallot.run(2, 6, 8, 5);
insertBallot.run(2, 7, 8, 1);
insertBallot.run(2, 7, 6, 2);
insertBallot.run(2, 7, 4, 3);
insertBallot.run(2, 7, 7, 4);
insertBallot.run(2, 7, 5, 5);

// Election 3: October 2021 - Winner: Psychonauts 2
insertBallot.run(3, 1, 9, 1);
insertBallot.run(3, 1, 4, 2);
insertBallot.run(3, 1, 7, 3);
insertBallot.run(3, 2, 9, 1);
insertBallot.run(3, 2, 4, 2);
insertBallot.run(3, 2, 7, 3);
insertBallot.run(3, 3, 9, 1);
insertBallot.run(3, 3, 4, 2);
insertBallot.run(3, 3, 7, 3);
insertBallot.run(3, 4, 9, 1);
insertBallot.run(3, 4, 4, 2);
insertBallot.run(3, 4, 7, 3);
insertBallot.run(3, 5, 7, 1);
insertBallot.run(3, 5, 9, 2);
insertBallot.run(3, 5, 4, 3);
insertBallot.run(3, 6, 4, 1);
insertBallot.run(3, 6, 9, 2);
insertBallot.run(3, 6, 7, 3);

// Election 4: November 2021 - Winner: Horizon 5
insertBallot.run(4, 1, 10, 1);
insertBallot.run(4, 1, 11, 2);
insertBallot.run(4, 1, 13, 3);
insertBallot.run(4, 1, 12, 4);
insertBallot.run(4, 2, 10, 1);
insertBallot.run(4, 2, 11, 2);
insertBallot.run(4, 2, 13, 3);
insertBallot.run(4, 2, 12, 4);
insertBallot.run(4, 3, 10, 1);
insertBallot.run(4, 3, 11, 2);
insertBallot.run(4, 3, 13, 3);
insertBallot.run(4, 3, 12, 4);
insertBallot.run(4, 4, 13, 1);
insertBallot.run(4, 4, 10, 2);
insertBallot.run(4, 4, 11, 3);
insertBallot.run(4, 4, 12, 4);

// Election 5: December 2021 - Winner: Whatever You Want (Open Forum)
insertBallot.run(5, 1, 15, 1);
insertBallot.run(5, 1, 11, 2);
insertBallot.run(5, 1, 7, 3);
insertBallot.run(5, 1, 14, 4);
insertBallot.run(5, 1, 12, 5);
insertBallot.run(5, 2, 15, 1);
insertBallot.run(5, 2, 11, 2);
insertBallot.run(5, 2, 7, 3);
insertBallot.run(5, 2, 14, 4);
insertBallot.run(5, 2, 12, 5);
insertBallot.run(5, 3, 15, 1);
insertBallot.run(5, 3, 11, 2);
insertBallot.run(5, 3, 7, 3);
insertBallot.run(5, 3, 14, 4);
insertBallot.run(5, 3, 12, 5);
insertBallot.run(5, 4, 15, 1);
insertBallot.run(5, 4, 11, 2);
insertBallot.run(5, 4, 7, 3);
insertBallot.run(5, 4, 14, 4);
insertBallot.run(5, 4, 12, 5);
insertBallot.run(5, 5, 7, 1);
insertBallot.run(5, 5, 15, 2);
insertBallot.run(5, 5, 11, 3);
insertBallot.run(5, 5, 14, 4);
insertBallot.run(5, 5, 12, 5);
insertBallot.run(5, 6, 14, 1);
insertBallot.run(5, 6, 15, 2);
insertBallot.run(5, 6, 11, 3);
insertBallot.run(5, 6, 7, 4);
insertBallot.run(5, 6, 12, 5);

// Election 6: January 2022 - Winner: Whatever You Want (Open Forum)
insertBallot.run(6, 1, 15, 1);
insertBallot.run(6, 1, 12, 2);
insertBallot.run(6, 1, 11, 3);
insertBallot.run(6, 1, 17, 4);
insertBallot.run(6, 1, 16, 5);
insertBallot.run(6, 2, 15, 1);
insertBallot.run(6, 2, 12, 2);
insertBallot.run(6, 2, 11, 3);
insertBallot.run(6, 2, 17, 4);
insertBallot.run(6, 2, 16, 5);
insertBallot.run(6, 3, 15, 1);
insertBallot.run(6, 3, 12, 2);
insertBallot.run(6, 3, 11, 3);
insertBallot.run(6, 3, 17, 4);
insertBallot.run(6, 3, 16, 5);
insertBallot.run(6, 4, 15, 1);
insertBallot.run(6, 4, 12, 2);
insertBallot.run(6, 4, 11, 3);
insertBallot.run(6, 4, 17, 4);
insertBallot.run(6, 4, 16, 5);
insertBallot.run(6, 5, 11, 1);
insertBallot.run(6, 5, 15, 2);
insertBallot.run(6, 5, 12, 3);
insertBallot.run(6, 5, 17, 4);
insertBallot.run(6, 5, 16, 5);
insertBallot.run(6, 6, 17, 1);
insertBallot.run(6, 6, 15, 2);
insertBallot.run(6, 6, 12, 3);
insertBallot.run(6, 6, 11, 4);
insertBallot.run(6, 6, 16, 5);
insertBallot.run(6, 7, 16, 1);
insertBallot.run(6, 7, 15, 2);
insertBallot.run(6, 7, 12, 3);
insertBallot.run(6, 7, 11, 4);
insertBallot.run(6, 7, 17, 5);

// Election 7: February 2022 - Winner: Hitman 2 - Miami Level
insertBallot.run(7, 1, 18, 1);
insertBallot.run(7, 1, 19, 2);
insertBallot.run(7, 1, 15, 3);
insertBallot.run(7, 1, 20, 4);
insertBallot.run(7, 2, 18, 1);
insertBallot.run(7, 2, 19, 2);
insertBallot.run(7, 2, 15, 3);
insertBallot.run(7, 2, 20, 4);
insertBallot.run(7, 3, 18, 1);
insertBallot.run(7, 3, 19, 2);
insertBallot.run(7, 3, 15, 3);
insertBallot.run(7, 3, 20, 4);
insertBallot.run(7, 4, 15, 1);
insertBallot.run(7, 4, 18, 2);
insertBallot.run(7, 4, 19, 3);
insertBallot.run(7, 4, 20, 4);
insertBallot.run(7, 5, 20, 1);
insertBallot.run(7, 5, 18, 2);
insertBallot.run(7, 5, 19, 3);
insertBallot.run(7, 5, 15, 4);

// Election 8: March 2022 - Winner: The Forgotten City
insertBallot.run(8, 1, 23, 1);
insertBallot.run(8, 1, 15, 2);
insertBallot.run(8, 1, 24, 3);
insertBallot.run(8, 1, 21, 4);
insertBallot.run(8, 1, 22, 5);
insertBallot.run(8, 2, 23, 1);
insertBallot.run(8, 2, 15, 2);
insertBallot.run(8, 2, 24, 3);
insertBallot.run(8, 2, 21, 4);
insertBallot.run(8, 2, 22, 5);
insertBallot.run(8, 3, 23, 1);
insertBallot.run(8, 3, 15, 2);
insertBallot.run(8, 3, 24, 3);
insertBallot.run(8, 3, 21, 4);
insertBallot.run(8, 3, 22, 5);
insertBallot.run(8, 4, 23, 1);
insertBallot.run(8, 4, 15, 2);
insertBallot.run(8, 4, 24, 3);
insertBallot.run(8, 4, 21, 4);
insertBallot.run(8, 4, 22, 5);
insertBallot.run(8, 5, 24, 1);
insertBallot.run(8, 5, 23, 2);
insertBallot.run(8, 5, 15, 3);
insertBallot.run(8, 5, 21, 4);
insertBallot.run(8, 5, 22, 5);
insertBallot.run(8, 6, 21, 1);
insertBallot.run(8, 6, 23, 2);
insertBallot.run(8, 6, 15, 3);
insertBallot.run(8, 6, 24, 4);
insertBallot.run(8, 6, 22, 5);

// Election 9: April 2022 - Winner: Weird West
insertBallot.run(9, 1, 26, 1);
insertBallot.run(9, 1, 27, 2);
insertBallot.run(9, 1, 25, 3);
insertBallot.run(9, 1, 28, 4);
insertBallot.run(9, 2, 26, 1);
insertBallot.run(9, 2, 27, 2);
insertBallot.run(9, 2, 25, 3);
insertBallot.run(9, 2, 28, 4);
insertBallot.run(9, 3, 26, 1);
insertBallot.run(9, 3, 27, 2);
insertBallot.run(9, 3, 25, 3);
insertBallot.run(9, 3, 28, 4);
insertBallot.run(9, 4, 25, 1);
insertBallot.run(9, 4, 26, 2);
insertBallot.run(9, 4, 27, 3);
insertBallot.run(9, 4, 28, 4);
insertBallot.run(9, 5, 28, 1);
insertBallot.run(9, 5, 26, 2);
insertBallot.run(9, 5, 27, 3);
insertBallot.run(9, 5, 25, 4);

// Election 10: May 2022 - Winner: Death's Door
insertBallot.run(10, 1, 19, 1);
insertBallot.run(10, 1, 27, 2);
insertBallot.run(10, 1, 30, 3);
insertBallot.run(10, 1, 28, 4);
insertBallot.run(10, 1, 31, 5);
insertBallot.run(10, 1, 29, 6);
insertBallot.run(10, 2, 19, 1);
insertBallot.run(10, 2, 27, 2);
insertBallot.run(10, 2, 30, 3);
insertBallot.run(10, 2, 28, 4);
insertBallot.run(10, 2, 31, 5);
insertBallot.run(10, 2, 29, 6);
insertBallot.run(10, 3, 19, 1);
insertBallot.run(10, 3, 27, 2);
insertBallot.run(10, 3, 30, 3);
insertBallot.run(10, 3, 28, 4);
insertBallot.run(10, 3, 31, 5);
insertBallot.run(10, 3, 29, 6);
insertBallot.run(10, 4, 19, 1);
insertBallot.run(10, 4, 27, 2);
insertBallot.run(10, 4, 30, 3);
insertBallot.run(10, 4, 28, 4);
insertBallot.run(10, 4, 31, 5);
insertBallot.run(10, 4, 29, 6);
insertBallot.run(10, 5, 30, 1);
insertBallot.run(10, 5, 19, 2);
insertBallot.run(10, 5, 27, 3);
insertBallot.run(10, 5, 28, 4);
insertBallot.run(10, 5, 31, 5);
insertBallot.run(10, 5, 29, 6);
insertBallot.run(10, 6, 28, 1);
insertBallot.run(10, 6, 19, 2);
insertBallot.run(10, 6, 27, 3);
insertBallot.run(10, 6, 30, 4);
insertBallot.run(10, 6, 31, 5);
insertBallot.run(10, 6, 29, 6);

// Election 11: June 2022 - Winner: Flight Sim - F-18 Carrier Challenge
insertBallot.run(11, 1, 33, 1);
insertBallot.run(11, 1, 30, 2);
insertBallot.run(11, 1, 32, 3);
insertBallot.run(11, 1, 4, 4);
insertBallot.run(11, 2, 33, 1);
insertBallot.run(11, 2, 30, 2);
insertBallot.run(11, 2, 32, 3);
insertBallot.run(11, 2, 4, 4);
insertBallot.run(11, 3, 33, 1);
insertBallot.run(11, 3, 30, 2);
insertBallot.run(11, 3, 32, 3);
insertBallot.run(11, 3, 4, 4);
insertBallot.run(11, 4, 32, 1);
insertBallot.run(11, 4, 33, 2);
insertBallot.run(11, 4, 30, 3);
insertBallot.run(11, 4, 4, 4);
insertBallot.run(11, 5, 4, 1);
insertBallot.run(11, 5, 33, 2);
insertBallot.run(11, 5, 30, 3);
insertBallot.run(11, 5, 32, 4);

// Election 12: July 2022 - Winner: Sable
insertBallot.run(12, 1, 30, 1);
insertBallot.run(12, 1, 32, 2);
insertBallot.run(12, 1, 34, 3);
insertBallot.run(12, 1, 35, 4);
insertBallot.run(12, 2, 30, 1);
insertBallot.run(12, 2, 32, 2);
insertBallot.run(12, 2, 34, 3);
insertBallot.run(12, 2, 35, 4);
insertBallot.run(12, 3, 30, 1);
insertBallot.run(12, 3, 32, 2);
insertBallot.run(12, 3, 34, 3);
insertBallot.run(12, 3, 35, 4);
insertBallot.run(12, 4, 34, 1);
insertBallot.run(12, 4, 30, 2);
insertBallot.run(12, 4, 32, 3);
insertBallot.run(12, 4, 35, 4);
insertBallot.run(12, 5, 35, 1);
insertBallot.run(12, 5, 30, 2);
insertBallot.run(12, 5, 32, 3);
insertBallot.run(12, 5, 34, 4);

// Election 13: August 2022 - Winner: TMNT: Shredder's Revenge
insertBallot.run(13, 1, 38, 1);
insertBallot.run(13, 1, 36, 2);
insertBallot.run(13, 1, 37, 3);
insertBallot.run(13, 2, 38, 1);
insertBallot.run(13, 2, 36, 2);
insertBallot.run(13, 2, 37, 3);
insertBallot.run(13, 3, 38, 1);
insertBallot.run(13, 3, 36, 2);
insertBallot.run(13, 3, 37, 3);
insertBallot.run(13, 4, 38, 1);
insertBallot.run(13, 4, 36, 2);
insertBallot.run(13, 4, 37, 3);
insertBallot.run(13, 5, 37, 1);
insertBallot.run(13, 5, 38, 2);
insertBallot.run(13, 5, 36, 3);
insertBallot.run(13, 6, 36, 1);
insertBallot.run(13, 6, 38, 2);
insertBallot.run(13, 6, 37, 3);

// Election 14: September 2022 - Winner: Road 96
insertBallot.run(14, 1, 36, 1);
insertBallot.run(14, 1, 39, 2);
insertBallot.run(14, 1, 32, 3);
insertBallot.run(14, 1, 41, 4);
insertBallot.run(14, 1, 40, 5);
insertBallot.run(14, 2, 36, 1);
insertBallot.run(14, 2, 39, 2);
insertBallot.run(14, 2, 32, 3);
insertBallot.run(14, 2, 41, 4);
insertBallot.run(14, 2, 40, 5);
insertBallot.run(14, 3, 36, 1);
insertBallot.run(14, 3, 39, 2);
insertBallot.run(14, 3, 32, 3);
insertBallot.run(14, 3, 41, 4);
insertBallot.run(14, 3, 40, 5);
insertBallot.run(14, 4, 32, 1);
insertBallot.run(14, 4, 36, 2);
insertBallot.run(14, 4, 39, 3);
insertBallot.run(14, 4, 41, 4);
insertBallot.run(14, 4, 40, 5);
insertBallot.run(14, 5, 41, 1);
insertBallot.run(14, 5, 36, 2);
insertBallot.run(14, 5, 39, 3);
insertBallot.run(14, 5, 32, 4);
insertBallot.run(14, 5, 40, 5);

// Election 15: October 2022 - Winner: Tunic
insertBallot.run(15, 1, 27, 1);
insertBallot.run(15, 1, 39, 2);
insertBallot.run(15, 1, 42, 3);
insertBallot.run(15, 2, 27, 1);
insertBallot.run(15, 2, 39, 2);
insertBallot.run(15, 2, 42, 3);
insertBallot.run(15, 3, 27, 1);
insertBallot.run(15, 3, 39, 2);
insertBallot.run(15, 3, 42, 3);
insertBallot.run(15, 4, 42, 1);
insertBallot.run(15, 4, 27, 2);
insertBallot.run(15, 4, 39, 3);

// Election 16: November 2022 - Winner: The Wolf Among Us
insertBallot.run(16, 1, 45, 1);
insertBallot.run(16, 1, 43, 2);
insertBallot.run(16, 1, 44, 3);
insertBallot.run(16, 1, 28, 4);
insertBallot.run(16, 2, 45, 1);
insertBallot.run(16, 2, 43, 2);
insertBallot.run(16, 2, 44, 3);
insertBallot.run(16, 2, 28, 4);
insertBallot.run(16, 3, 45, 1);
insertBallot.run(16, 3, 43, 2);
insertBallot.run(16, 3, 44, 3);
insertBallot.run(16, 3, 28, 4);
insertBallot.run(16, 4, 44, 1);
insertBallot.run(16, 4, 45, 2);
insertBallot.run(16, 4, 43, 3);
insertBallot.run(16, 4, 28, 4);

// Election 17: December 2022 - Winner: Pentiment
insertBallot.run(17, 1, 47, 1);
insertBallot.run(17, 1, 46, 2);
insertBallot.run(17, 1, 11, 3);
insertBallot.run(17, 1, 28, 4);
insertBallot.run(17, 2, 47, 1);
insertBallot.run(17, 2, 46, 2);
insertBallot.run(17, 2, 11, 3);
insertBallot.run(17, 2, 28, 4);
insertBallot.run(17, 3, 47, 1);
insertBallot.run(17, 3, 46, 2);
insertBallot.run(17, 3, 11, 3);
insertBallot.run(17, 3, 28, 4);
insertBallot.run(17, 4, 11, 1);
insertBallot.run(17, 4, 47, 2);
insertBallot.run(17, 4, 46, 3);
insertBallot.run(17, 4, 28, 4);

// Election 18: January 2023 - Winner: Norco
insertBallot.run(18, 1, 48, 1);
insertBallot.run(18, 1, 50, 2);
insertBallot.run(18, 1, 49, 3);
insertBallot.run(18, 1, 28, 4);
insertBallot.run(18, 2, 48, 1);
insertBallot.run(18, 2, 50, 2);
insertBallot.run(18, 2, 49, 3);
insertBallot.run(18, 2, 28, 4);
insertBallot.run(18, 3, 48, 1);
insertBallot.run(18, 3, 50, 2);
insertBallot.run(18, 3, 49, 3);
insertBallot.run(18, 3, 28, 4);
insertBallot.run(18, 4, 49, 1);
insertBallot.run(18, 4, 48, 2);
insertBallot.run(18, 4, 50, 3);
insertBallot.run(18, 4, 28, 4);
insertBallot.run(18, 5, 28, 1);
insertBallot.run(18, 5, 48, 2);
insertBallot.run(18, 5, 50, 3);
insertBallot.run(18, 5, 49, 4);

// Election 19: February 2023 - Winner: Hi-Fi Rush
insertBallot.run(19, 1, 51, 1);
insertBallot.run(19, 1, 44, 2);
insertBallot.run(19, 1, 50, 3);
insertBallot.run(19, 1, 28, 4);
insertBallot.run(19, 2, 51, 1);
insertBallot.run(19, 2, 44, 2);
insertBallot.run(19, 2, 50, 3);
insertBallot.run(19, 2, 28, 4);
insertBallot.run(19, 3, 51, 1);
insertBallot.run(19, 3, 44, 2);
insertBallot.run(19, 3, 50, 3);
insertBallot.run(19, 3, 28, 4);
insertBallot.run(19, 4, 50, 1);
insertBallot.run(19, 4, 51, 2);
insertBallot.run(19, 4, 44, 3);
insertBallot.run(19, 4, 28, 4);
insertBallot.run(19, 5, 28, 1);
insertBallot.run(19, 5, 51, 2);
insertBallot.run(19, 5, 44, 3);
insertBallot.run(19, 5, 50, 4);

// Election 20: March 2023 - Winner: Dead Space (2008 or 2023)
insertBallot.run(20, 1, 53, 1);
insertBallot.run(20, 1, 44, 2);
insertBallot.run(20, 1, 52, 3);
insertBallot.run(20, 1, 46, 4);
insertBallot.run(20, 2, 53, 1);
insertBallot.run(20, 2, 44, 2);
insertBallot.run(20, 2, 52, 3);
insertBallot.run(20, 2, 46, 4);
insertBallot.run(20, 3, 53, 1);
insertBallot.run(20, 3, 44, 2);
insertBallot.run(20, 3, 52, 3);
insertBallot.run(20, 3, 46, 4);
insertBallot.run(20, 4, 52, 1);
insertBallot.run(20, 4, 53, 2);
insertBallot.run(20, 4, 44, 3);
insertBallot.run(20, 4, 46, 4);

// Election 21: April 2023 - Winner: Return to Monkey Island
insertBallot.run(21, 1, 50, 1);
insertBallot.run(21, 1, 55, 2);
insertBallot.run(21, 1, 54, 3);
insertBallot.run(21, 1, 28, 4);
insertBallot.run(21, 2, 50, 1);
insertBallot.run(21, 2, 55, 2);
insertBallot.run(21, 2, 54, 3);
insertBallot.run(21, 2, 28, 4);
insertBallot.run(21, 3, 50, 1);
insertBallot.run(21, 3, 55, 2);
insertBallot.run(21, 3, 54, 3);
insertBallot.run(21, 3, 28, 4);
insertBallot.run(21, 4, 54, 1);
insertBallot.run(21, 4, 50, 2);
insertBallot.run(21, 4, 55, 3);
insertBallot.run(21, 4, 28, 4);

// Election 22: May 2023 - Winner: Inside
insertBallot.run(22, 1, 57, 1);
insertBallot.run(22, 1, 54, 2);
insertBallot.run(22, 1, 56, 3);
insertBallot.run(22, 2, 57, 1);
insertBallot.run(22, 2, 54, 2);
insertBallot.run(22, 2, 56, 3);
insertBallot.run(22, 3, 57, 1);
insertBallot.run(22, 3, 54, 2);
insertBallot.run(22, 3, 56, 3);
insertBallot.run(22, 4, 57, 1);
insertBallot.run(22, 4, 54, 2);
insertBallot.run(22, 4, 56, 3);
insertBallot.run(22, 5, 56, 1);
insertBallot.run(22, 5, 57, 2);
insertBallot.run(22, 5, 54, 3);
insertBallot.run(22, 6, 54, 1);
insertBallot.run(22, 6, 57, 2);
insertBallot.run(22, 6, 56, 3);
insertBallot.run(22, 7, 56, 1);
insertBallot.run(22, 7, 57, 2);
insertBallot.run(22, 7, 54, 3);

// Election 23: June 2023 - Winner: Citizen Sleeper
insertBallot.run(23, 1, 58, 1);
insertBallot.run(23, 1, 59, 2);
insertBallot.run(23, 1, 44, 3);
insertBallot.run(23, 1, 28, 4);
insertBallot.run(23, 2, 58, 1);
insertBallot.run(23, 2, 59, 2);
insertBallot.run(23, 2, 44, 3);
insertBallot.run(23, 2, 28, 4);
insertBallot.run(23, 3, 58, 1);
insertBallot.run(23, 3, 59, 2);
insertBallot.run(23, 3, 44, 3);
insertBallot.run(23, 3, 28, 4);
insertBallot.run(23, 4, 44, 1);
insertBallot.run(23, 4, 58, 2);
insertBallot.run(23, 4, 59, 3);
insertBallot.run(23, 4, 28, 4);

// Election 24: July 2023 - Winner: NFS: Unbound
insertBallot.run(24, 1, 61, 1);
insertBallot.run(24, 1, 62, 2);
insertBallot.run(24, 1, 28, 3);
insertBallot.run(24, 1, 60, 4);
insertBallot.run(24, 2, 61, 1);
insertBallot.run(24, 2, 62, 2);
insertBallot.run(24, 2, 28, 3);
insertBallot.run(24, 2, 60, 4);
insertBallot.run(24, 3, 61, 1);
insertBallot.run(24, 3, 62, 2);
insertBallot.run(24, 3, 28, 3);
insertBallot.run(24, 3, 60, 4);
insertBallot.run(24, 4, 28, 1);
insertBallot.run(24, 4, 61, 2);
insertBallot.run(24, 4, 62, 3);
insertBallot.run(24, 4, 60, 4);

// Election 25: September 2023 - Winner: Venba
insertBallot.run(25, 1, 63, 1);
insertBallot.run(25, 1, 64, 2);
insertBallot.run(25, 1, 65, 3);
insertBallot.run(25, 2, 63, 1);
insertBallot.run(25, 2, 64, 2);
insertBallot.run(25, 2, 65, 3);
insertBallot.run(25, 3, 63, 1);
insertBallot.run(25, 3, 64, 2);
insertBallot.run(25, 3, 65, 3);
insertBallot.run(25, 4, 65, 1);
insertBallot.run(25, 4, 63, 2);
insertBallot.run(25, 4, 64, 3);

// Election 26: October 2023 - Winner: A Short Hike
insertBallot.run(26, 1, 68, 1);
insertBallot.run(26, 1, 44, 2);
insertBallot.run(26, 1, 66, 3);
insertBallot.run(26, 1, 67, 4);
insertBallot.run(26, 2, 68, 1);
insertBallot.run(26, 2, 44, 2);
insertBallot.run(26, 2, 66, 3);
insertBallot.run(26, 2, 67, 4);
insertBallot.run(26, 3, 68, 1);
insertBallot.run(26, 3, 44, 2);
insertBallot.run(26, 3, 66, 3);
insertBallot.run(26, 3, 67, 4);
insertBallot.run(26, 4, 66, 1);
insertBallot.run(26, 4, 68, 2);
insertBallot.run(26, 4, 44, 3);
insertBallot.run(26, 4, 67, 4);
insertBallot.run(26, 5, 67, 1);
insertBallot.run(26, 5, 68, 2);
insertBallot.run(26, 5, 44, 3);
insertBallot.run(26, 5, 66, 4);

// Election 27: November 2023 - Winner: The Expanse: A Telltale Series
insertBallot.run(27, 1, 66, 1);
insertBallot.run(27, 1, 69, 2);
insertBallot.run(27, 1, 71, 3);
insertBallot.run(27, 1, 70, 4);
insertBallot.run(27, 2, 66, 1);
insertBallot.run(27, 2, 69, 2);
insertBallot.run(27, 2, 71, 3);
insertBallot.run(27, 2, 70, 4);
insertBallot.run(27, 3, 71, 1);
insertBallot.run(27, 3, 66, 2);
insertBallot.run(27, 3, 69, 3);
insertBallot.run(27, 3, 70, 4);

// Election 28: December 2023 - Winner: Thirsty Suitors
insertBallot.run(28, 1, 72, 1);
insertBallot.run(28, 1, 73, 2);
insertBallot.run(28, 1, 71, 3);
insertBallot.run(28, 2, 72, 1);
insertBallot.run(28, 2, 73, 2);
insertBallot.run(28, 2, 71, 3);
insertBallot.run(28, 3, 71, 1);
insertBallot.run(28, 3, 72, 2);
insertBallot.run(28, 3, 73, 3);

// Election 29: January 2024 - Winner: Jusant
insertBallot.run(29, 1, 73, 1);
insertBallot.run(29, 1, 74, 2);
insertBallot.run(29, 1, 75, 3);
insertBallot.run(29, 2, 73, 1);
insertBallot.run(29, 2, 74, 2);
insertBallot.run(29, 2, 75, 3);
insertBallot.run(29, 3, 73, 1);
insertBallot.run(29, 3, 74, 2);
insertBallot.run(29, 3, 75, 3);
insertBallot.run(29, 4, 75, 1);
insertBallot.run(29, 4, 73, 2);
insertBallot.run(29, 4, 74, 3);

// Election 30: February 2024 - Winner: Sifu
insertBallot.run(30, 1, 74, 1);
insertBallot.run(30, 1, 77, 2);
insertBallot.run(30, 1, 76, 3);
insertBallot.run(30, 1, 69, 4);
insertBallot.run(30, 2, 74, 1);
insertBallot.run(30, 2, 77, 2);
insertBallot.run(30, 2, 76, 3);
insertBallot.run(30, 2, 69, 4);
insertBallot.run(30, 3, 74, 1);
insertBallot.run(30, 3, 77, 2);
insertBallot.run(30, 3, 76, 3);
insertBallot.run(30, 3, 69, 4);
insertBallot.run(30, 4, 76, 1);
insertBallot.run(30, 4, 74, 2);
insertBallot.run(30, 4, 77, 3);
insertBallot.run(30, 4, 69, 4);

// Election 31: March 2024 - Winner: Bloodstained: Ritual of the Night
insertBallot.run(31, 1, 78, 1);
insertBallot.run(31, 1, 80, 2);
insertBallot.run(31, 1, 79, 3);
insertBallot.run(31, 1, 76, 4);
insertBallot.run(31, 2, 78, 1);
insertBallot.run(31, 2, 80, 2);
insertBallot.run(31, 2, 79, 3);
insertBallot.run(31, 2, 76, 4);
insertBallot.run(31, 3, 78, 1);
insertBallot.run(31, 3, 80, 2);
insertBallot.run(31, 3, 79, 3);
insertBallot.run(31, 3, 76, 4);
insertBallot.run(31, 4, 79, 1);
insertBallot.run(31, 4, 78, 2);
insertBallot.run(31, 4, 80, 3);
insertBallot.run(31, 4, 76, 4);

// Election 32: April 2024 - Winner: Open Roads
insertBallot.run(32, 1, 83, 1);
insertBallot.run(32, 1, 82, 2);
insertBallot.run(32, 1, 81, 3);
insertBallot.run(32, 2, 83, 1);
insertBallot.run(32, 2, 82, 2);
insertBallot.run(32, 2, 81, 3);
insertBallot.run(32, 3, 83, 1);
insertBallot.run(32, 3, 82, 2);
insertBallot.run(32, 3, 81, 3);
insertBallot.run(32, 4, 83, 1);
insertBallot.run(32, 4, 82, 2);
insertBallot.run(32, 4, 81, 3);
insertBallot.run(32, 5, 81, 1);
insertBallot.run(32, 5, 83, 2);
insertBallot.run(32, 5, 82, 3);
insertBallot.run(32, 6, 82, 1);
insertBallot.run(32, 6, 83, 2);
insertBallot.run(32, 6, 81, 3);

// Election 33: May 2024 - Winner: Fallout
insertBallot.run(33, 1, 87, 1);
insertBallot.run(33, 1, 86, 2);
insertBallot.run(33, 1, 84, 3);
insertBallot.run(33, 1, 85, 4);
insertBallot.run(33, 2, 87, 1);
insertBallot.run(33, 2, 86, 2);
insertBallot.run(33, 2, 84, 3);
insertBallot.run(33, 2, 85, 4);
insertBallot.run(33, 3, 87, 1);
insertBallot.run(33, 3, 86, 2);
insertBallot.run(33, 3, 84, 3);
insertBallot.run(33, 3, 85, 4);
insertBallot.run(33, 4, 84, 1);
insertBallot.run(33, 4, 87, 2);
insertBallot.run(33, 4, 86, 3);
insertBallot.run(33, 4, 85, 4);
insertBallot.run(33, 5, 85, 1);
insertBallot.run(33, 5, 87, 2);
insertBallot.run(33, 5, 86, 3);
insertBallot.run(33, 5, 84, 4);

// Election 34: June 2024 - Winner: Another Crab's Treasure
insertBallot.run(34, 1, 89, 1);
insertBallot.run(34, 1, 90, 2);
insertBallot.run(34, 1, 88, 3);
insertBallot.run(34, 2, 89, 1);
insertBallot.run(34, 2, 90, 2);
insertBallot.run(34, 2, 88, 3);
insertBallot.run(34, 3, 89, 1);
insertBallot.run(34, 3, 90, 2);
insertBallot.run(34, 3, 88, 3);
insertBallot.run(34, 4, 88, 1);
insertBallot.run(34, 4, 89, 2);
insertBallot.run(34, 4, 90, 3);

// Election 35: July 2024 - Winner: Little Kitty Big City
insertBallot.run(35, 1, 90, 1);
insertBallot.run(35, 1, 92, 2);
insertBallot.run(35, 1, 91, 3);
insertBallot.run(35, 2, 90, 1);
insertBallot.run(35, 2, 92, 2);
insertBallot.run(35, 2, 91, 3);
insertBallot.run(35, 3, 90, 1);
insertBallot.run(35, 3, 92, 2);
insertBallot.run(35, 3, 91, 3);
insertBallot.run(35, 4, 91, 1);
insertBallot.run(35, 4, 90, 2);
insertBallot.run(35, 4, 92, 3);
insertBallot.run(35, 5, 92, 1);
insertBallot.run(35, 5, 90, 2);
insertBallot.run(35, 5, 91, 3);

// Election 36: August 2024 - Winner: Beyond Good & Evil
insertBallot.run(36, 1, 93, 1);
insertBallot.run(36, 1, 91, 2);
insertBallot.run(36, 1, 69, 3);
insertBallot.run(36, 1, 46, 4);
insertBallot.run(36, 1, 43, 5);
insertBallot.run(36, 2, 93, 1);
insertBallot.run(36, 2, 91, 2);
insertBallot.run(36, 2, 69, 3);
insertBallot.run(36, 2, 46, 4);
insertBallot.run(36, 2, 43, 5);
insertBallot.run(36, 3, 93, 1);
insertBallot.run(36, 3, 91, 2);
insertBallot.run(36, 3, 69, 3);
insertBallot.run(36, 3, 46, 4);
insertBallot.run(36, 3, 43, 5);
insertBallot.run(36, 4, 93, 1);
insertBallot.run(36, 4, 91, 2);
insertBallot.run(36, 4, 69, 3);
insertBallot.run(36, 4, 46, 4);
insertBallot.run(36, 4, 43, 5);
insertBallot.run(36, 5, 69, 1);
insertBallot.run(36, 5, 93, 2);
insertBallot.run(36, 5, 91, 3);
insertBallot.run(36, 5, 46, 4);
insertBallot.run(36, 5, 43, 5);
insertBallot.run(36, 6, 46, 1);
insertBallot.run(36, 6, 93, 2);
insertBallot.run(36, 6, 91, 3);
insertBallot.run(36, 6, 69, 4);
insertBallot.run(36, 6, 43, 5);

// Election 37: September 2024 - Winner: Coral Island
insertBallot.run(37, 1, 94, 1);
insertBallot.run(37, 1, 95, 2);
insertBallot.run(37, 1, 96, 3);
insertBallot.run(37, 2, 94, 1);
insertBallot.run(37, 2, 95, 2);
insertBallot.run(37, 2, 96, 3);
insertBallot.run(37, 3, 94, 1);
insertBallot.run(37, 3, 95, 2);
insertBallot.run(37, 3, 96, 3);
insertBallot.run(37, 4, 96, 1);
insertBallot.run(37, 4, 94, 2);
insertBallot.run(37, 4, 95, 3);
insertBallot.run(37, 5, 95, 1);
insertBallot.run(37, 5, 94, 2);
insertBallot.run(37, 5, 96, 3);

// Election 38: October 2024 - Winner: Night in the Woods
insertBallot.run(38, 1, 97, 1);
insertBallot.run(38, 1, 95, 2);
insertBallot.run(38, 1, 91, 3);
insertBallot.run(38, 1, 75, 4);
insertBallot.run(38, 2, 97, 1);
insertBallot.run(38, 2, 95, 2);
insertBallot.run(38, 2, 91, 3);
insertBallot.run(38, 2, 75, 4);
insertBallot.run(38, 3, 97, 1);
insertBallot.run(38, 3, 95, 2);
insertBallot.run(38, 3, 91, 3);
insertBallot.run(38, 3, 75, 4);
insertBallot.run(38, 4, 91, 1);
insertBallot.run(38, 4, 97, 2);
insertBallot.run(38, 4, 95, 3);
insertBallot.run(38, 4, 75, 4);
insertBallot.run(38, 5, 75, 1);
insertBallot.run(38, 5, 97, 2);
insertBallot.run(38, 5, 95, 3);
insertBallot.run(38, 5, 91, 4);

// Election 39: November 2024 - Winner: Tactical Breach Wizards
insertBallot.run(39, 1, 100, 1);
insertBallot.run(39, 1, 98, 2);
insertBallot.run(39, 1, 99, 3);
insertBallot.run(39, 2, 100, 1);
insertBallot.run(39, 2, 98, 2);
insertBallot.run(39, 2, 99, 3);
insertBallot.run(39, 3, 100, 1);
insertBallot.run(39, 3, 98, 2);
insertBallot.run(39, 3, 99, 3);
insertBallot.run(39, 4, 99, 1);
insertBallot.run(39, 4, 100, 2);
insertBallot.run(39, 4, 98, 3);
insertBallot.run(39, 5, 98, 1);
insertBallot.run(39, 5, 100, 2);
insertBallot.run(39, 5, 99, 3);

// Election 40: December 2024 - Winner: Hellblade 2
insertBallot.run(40, 1, 91, 1);
insertBallot.run(40, 1, 101, 2);
insertBallot.run(40, 1, 102, 3);
insertBallot.run(40, 2, 91, 1);
insertBallot.run(40, 2, 101, 2);
insertBallot.run(40, 2, 102, 3);
insertBallot.run(40, 3, 91, 1);
insertBallot.run(40, 3, 101, 2);
insertBallot.run(40, 3, 102, 3);
insertBallot.run(40, 4, 102, 1);
insertBallot.run(40, 4, 91, 2);
insertBallot.run(40, 4, 101, 3);
insertBallot.run(40, 5, 101, 1);
insertBallot.run(40, 5, 91, 2);
insertBallot.run(40, 5, 102, 3);

// Election 41: January 2025 - Winner: Dungeons of Hinterberg
insertBallot.run(41, 1, 95, 1);
insertBallot.run(41, 1, 103, 2);
insertBallot.run(41, 1, 104, 3);
insertBallot.run(41, 2, 95, 1);
insertBallot.run(41, 2, 103, 2);
insertBallot.run(41, 2, 104, 3);
insertBallot.run(41, 3, 95, 1);
insertBallot.run(41, 3, 103, 2);
insertBallot.run(41, 3, 104, 3);
insertBallot.run(41, 4, 104, 1);
insertBallot.run(41, 4, 95, 2);
insertBallot.run(41, 4, 103, 3);
insertBallot.run(41, 5, 103, 1);
insertBallot.run(41, 5, 95, 2);
insertBallot.run(41, 5, 104, 3);

// Election 42: February 2025 - Winner: 1000xRESIST
insertBallot.run(42, 1, 105, 1);
insertBallot.run(42, 1, 92, 2);
insertBallot.run(42, 1, 106, 3);
insertBallot.run(42, 2, 105, 1);
insertBallot.run(42, 2, 92, 2);
insertBallot.run(42, 2, 106, 3);
insertBallot.run(42, 3, 105, 1);
insertBallot.run(42, 3, 92, 2);
insertBallot.run(42, 3, 106, 3);
insertBallot.run(42, 4, 106, 1);
insertBallot.run(42, 4, 105, 2);
insertBallot.run(42, 4, 92, 3);
insertBallot.run(42, 5, 92, 1);
insertBallot.run(42, 5, 105, 2);
insertBallot.run(42, 5, 106, 3);

// Election 43: March 2025 - Winner: Indiana Jones and the Great Circle
insertBallot.run(43, 1, 108, 1);
insertBallot.run(43, 1, 107, 2);
insertBallot.run(43, 1, 110, 3);
insertBallot.run(43, 1, 109, 4);
insertBallot.run(43, 2, 108, 1);
insertBallot.run(43, 2, 107, 2);
insertBallot.run(43, 2, 110, 3);
insertBallot.run(43, 2, 109, 4);
insertBallot.run(43, 3, 108, 1);
insertBallot.run(43, 3, 107, 2);
insertBallot.run(43, 3, 110, 3);
insertBallot.run(43, 3, 109, 4);
insertBallot.run(43, 4, 110, 1);
insertBallot.run(43, 4, 108, 2);
insertBallot.run(43, 4, 107, 3);
insertBallot.run(43, 4, 109, 4);
insertBallot.run(43, 5, 109, 1);
insertBallot.run(43, 5, 108, 2);
insertBallot.run(43, 5, 107, 3);
insertBallot.run(43, 5, 110, 4);

// Election 44: April 2025 - Winner: Citizen Sleeper 2
insertBallot.run(44, 1, 107, 1);
insertBallot.run(44, 1, 112, 2);
insertBallot.run(44, 1, 111, 3);
insertBallot.run(44, 1, 113, 4);
insertBallot.run(44, 2, 107, 1);
insertBallot.run(44, 2, 112, 2);
insertBallot.run(44, 2, 111, 3);
insertBallot.run(44, 2, 113, 4);
insertBallot.run(44, 3, 107, 1);
insertBallot.run(44, 3, 112, 2);
insertBallot.run(44, 3, 111, 3);
insertBallot.run(44, 3, 113, 4);
insertBallot.run(44, 4, 111, 1);
insertBallot.run(44, 4, 107, 2);
insertBallot.run(44, 4, 112, 3);
insertBallot.run(44, 4, 113, 4);
insertBallot.run(44, 5, 113, 1);
insertBallot.run(44, 5, 107, 2);
insertBallot.run(44, 5, 112, 3);
insertBallot.run(44, 5, 111, 4);

// Election 45: May 2025 - Winner: South of Midnight
insertBallot.run(45, 1, 116, 1);
insertBallot.run(45, 1, 114, 2);
insertBallot.run(45, 1, 117, 3);
insertBallot.run(45, 1, 115, 4);
insertBallot.run(45, 2, 116, 1);
insertBallot.run(45, 2, 114, 2);
insertBallot.run(45, 2, 117, 3);
insertBallot.run(45, 2, 115, 4);
insertBallot.run(45, 3, 116, 1);
insertBallot.run(45, 3, 114, 2);
insertBallot.run(45, 3, 117, 3);
insertBallot.run(45, 3, 115, 4);
insertBallot.run(45, 4, 117, 1);
insertBallot.run(45, 4, 116, 2);
insertBallot.run(45, 4, 114, 3);
insertBallot.run(45, 4, 115, 4);
insertBallot.run(45, 5, 115, 1);
insertBallot.run(45, 5, 116, 2);
insertBallot.run(45, 5, 114, 3);
insertBallot.run(45, 5, 117, 4);

// Election 46: June 2025 - Winner: Old Skies
insertBallot.run(46, 1, 120, 1);
insertBallot.run(46, 1, 118, 2);
insertBallot.run(46, 1, 60, 3);
insertBallot.run(46, 1, 119, 4);
insertBallot.run(46, 2, 120, 1);
insertBallot.run(46, 2, 118, 2);
insertBallot.run(46, 2, 60, 3);
insertBallot.run(46, 2, 119, 4);
insertBallot.run(46, 3, 120, 1);
insertBallot.run(46, 3, 118, 2);
insertBallot.run(46, 3, 60, 3);
insertBallot.run(46, 3, 119, 4);
insertBallot.run(46, 4, 60, 1);
insertBallot.run(46, 4, 120, 2);
insertBallot.run(46, 4, 118, 3);
insertBallot.run(46, 4, 119, 4);

// Election 47: July 2025 - Winner: The Stanley Parable (any edition)
insertBallot.run(47, 1, 121, 1);
insertBallot.run(47, 1, 123, 2);
insertBallot.run(47, 1, 88, 3);
insertBallot.run(47, 1, 122, 4);
insertBallot.run(47, 2, 121, 1);
insertBallot.run(47, 2, 123, 2);
insertBallot.run(47, 2, 88, 3);
insertBallot.run(47, 2, 122, 4);
insertBallot.run(47, 3, 121, 1);
insertBallot.run(47, 3, 123, 2);
insertBallot.run(47, 3, 88, 3);
insertBallot.run(47, 3, 122, 4);
insertBallot.run(47, 4, 121, 1);
insertBallot.run(47, 4, 123, 2);
insertBallot.run(47, 4, 88, 3);
insertBallot.run(47, 4, 122, 4);
insertBallot.run(47, 5, 88, 1);
insertBallot.run(47, 5, 121, 2);
insertBallot.run(47, 5, 123, 3);
insertBallot.run(47, 5, 122, 4);
insertBallot.run(47, 6, 122, 1);
insertBallot.run(47, 6, 121, 2);
insertBallot.run(47, 6, 123, 3);
insertBallot.run(47, 6, 88, 4);

// Election 48: August 2025 - Winner: NetHack
insertBallot.run(48, 1, 126, 1);
insertBallot.run(48, 1, 124, 2);
insertBallot.run(48, 1, 125, 3);
insertBallot.run(48, 1, 127, 4);
insertBallot.run(48, 2, 126, 1);
insertBallot.run(48, 2, 124, 2);
insertBallot.run(48, 2, 125, 3);
insertBallot.run(48, 2, 127, 4);
insertBallot.run(48, 3, 126, 1);
insertBallot.run(48, 3, 124, 2);
insertBallot.run(48, 3, 125, 3);
insertBallot.run(48, 3, 127, 4);
insertBallot.run(48, 4, 126, 1);
insertBallot.run(48, 4, 124, 2);
insertBallot.run(48, 4, 125, 3);
insertBallot.run(48, 4, 127, 4);
insertBallot.run(48, 5, 125, 1);
insertBallot.run(48, 5, 126, 2);
insertBallot.run(48, 5, 124, 3);
insertBallot.run(48, 5, 127, 4);
insertBallot.run(48, 6, 127, 1);
insertBallot.run(48, 6, 126, 2);
insertBallot.run(48, 6, 124, 3);
insertBallot.run(48, 6, 125, 4);

// Election 49: September 2025 - Winner: The Outer Worlds
insertBallot.run(49, 1, 127, 1);
insertBallot.run(49, 1, 128, 2);
insertBallot.run(49, 1, 129, 3);
insertBallot.run(49, 2, 127, 1);
insertBallot.run(49, 2, 128, 2);
insertBallot.run(49, 2, 129, 3);
insertBallot.run(49, 3, 127, 1);
insertBallot.run(49, 3, 128, 2);
insertBallot.run(49, 3, 129, 3);
insertBallot.run(49, 4, 129, 1);
insertBallot.run(49, 4, 127, 2);
insertBallot.run(49, 4, 128, 3);
insertBallot.run(49, 5, 128, 1);
insertBallot.run(49, 5, 127, 2);
insertBallot.run(49, 5, 129, 3);

// Election 50: October 2025 - Winner: Peak
insertBallot.run(50, 1, 132, 1);
insertBallot.run(50, 1, 131, 2);
insertBallot.run(50, 1, 130, 3);
insertBallot.run(50, 2, 132, 1);
insertBallot.run(50, 2, 131, 2);
insertBallot.run(50, 2, 130, 3);

// Election 51: November 2025 - Winner: Keeper (sole nominee)
insertBallot.run(51, 1, 133, 1);

// Election 52: December 2025 - Winner: Dispatch
insertBallot.run(52, 1, 134, 1); insertBallot.run(52, 1, 135, 2); insertBallot.run(52, 1, 136, 3);
insertBallot.run(52, 2, 134, 1); insertBallot.run(52, 2, 135, 2); insertBallot.run(52, 2, 136, 3);
insertBallot.run(52, 3, 134, 1); insertBallot.run(52, 3, 135, 2); insertBallot.run(52, 3, 136, 3);
insertBallot.run(52, 4, 134, 1); insertBallot.run(52, 4, 136, 2);
insertBallot.run(52, 5, 136, 1); insertBallot.run(52, 5, 134, 2);

// Election 53: January 2026 - Winner: Wolfenstein: The New Order
insertBallot.run(53, 1, 137, 1); insertBallot.run(53, 1, 138, 2); insertBallot.run(53, 1, 139, 3); insertBallot.run(53, 1, 140, 4);
insertBallot.run(53, 2, 137, 1); insertBallot.run(53, 2, 139, 2); insertBallot.run(53, 2, 138, 3);
insertBallot.run(53, 3, 138, 1); insertBallot.run(53, 3, 137, 2); insertBallot.run(53, 3, 139, 3); insertBallot.run(53, 3, 140, 4);
insertBallot.run(53, 4, 139, 1); insertBallot.run(53, 4, 140, 2); insertBallot.run(53, 4, 138, 3); insertBallot.run(53, 4, 137, 4);
insertBallot.run(53, 5, 139, 1); insertBallot.run(53, 5, 138, 2); insertBallot.run(53, 5, 140, 3); insertBallot.run(53, 5, 137, 4);

// Election 54: February 2026 - Winner: Disco Samurai
insertBallot.run(54, 1, 141, 1); insertBallot.run(54, 1, 142, 2); insertBallot.run(54, 1, 143, 3); insertBallot.run(54, 1, 144, 4);
insertBallot.run(54, 2, 142, 1); insertBallot.run(54, 2, 143, 2); insertBallot.run(54, 2, 141, 3); insertBallot.run(54, 2, 144, 4); insertBallot.run(54, 2, 145, 5);
insertBallot.run(54, 3, 142, 1); insertBallot.run(54, 3, 143, 2); insertBallot.run(54, 3, 145, 3); insertBallot.run(54, 3, 141, 4); insertBallot.run(54, 3, 144, 5);
insertBallot.run(54, 4, 142, 1); insertBallot.run(54, 4, 145, 2); insertBallot.run(54, 4, 141, 3); insertBallot.run(54, 4, 144, 4); insertBallot.run(54, 4, 143, 5);
insertBallot.run(54, 5, 143, 1); insertBallot.run(54, 5, 145, 2); insertBallot.run(54, 5, 144, 3); insertBallot.run(54, 5, 141, 4); insertBallot.run(54, 5, 142, 5);
insertBallot.run(54, 6, 145, 1); insertBallot.run(54, 6, 141, 2); insertBallot.run(54, 6, 143, 3); insertBallot.run(54, 6, 142, 4);

// Election 55: March 2026 - Winner: Indika (sole nominee, unanimous)
insertBallot.run(55, 1, 142, 1);
insertBallot.run(55, 2, 142, 1);
insertBallot.run(55, 3, 142, 1);
insertBallot.run(55, 4, 142, 1);
insertBallot.run(55, 5, 142, 1);
insertBallot.run(55, 6, 142, 1);

// Election 56: April 2026 - Winner: Into the Breach (147)
// Candidates: Unavowed (106), Commandos: Origins (146), Into the Breach (147)
insertBallot.run(56, 1, 106, 1); insertBallot.run(56, 1, 147, 2); insertBallot.run(56, 1, 146, 3);
insertBallot.run(56, 2, 146, 1); insertBallot.run(56, 2, 106, 2); insertBallot.run(56, 2, 147, 3);
insertBallot.run(56, 3, 146, 1); insertBallot.run(56, 3, 147, 2); insertBallot.run(56, 3, 106, 3);
insertBallot.run(56, 4, 147, 1); insertBallot.run(56, 4, 106, 2); insertBallot.run(56, 4, 146, 3);
insertBallot.run(56, 5, 147, 1); insertBallot.run(56, 5, 106, 2); insertBallot.run(56, 5, 146, 3);
insertBallot.run(56, 6, 147, 1); insertBallot.run(56, 6, 146, 2); insertBallot.run(56, 6, 106, 3);

// ----- Election Rounds -----
const insertRound = db.prepare(
  "INSERT INTO election_rounds (election_id, round_number, eliminated_game_id, summary) VALUES (?, ?, ?, ?)"
);

insertRound.run(1, 1, null, "Sunset Overdrive wins with 4/7 first-place votes.");
insertRound.run(2, 1, null, "Art of Rally wins with 4/7 first-place votes.");
insertRound.run(3, 1, null, "Psychonauts 2 wins with 4/6 first-place votes.");
insertRound.run(4, 1, null, "Horizon 5 wins with 3/4 first-place votes.");
insertRound.run(5, 1, null, "Whatever You Want (Open Forum) wins with 4/6 first-place votes.");
insertRound.run(6, 1, null, "Whatever You Want (Open Forum) wins with 4/7 first-place votes.");
insertRound.run(7, 1, null, "Hitman 2 - Miami Level wins with 3/5 first-place votes.");
insertRound.run(8, 1, null, "The Forgotten City wins with 4/6 first-place votes.");
insertRound.run(9, 1, null, "Weird West wins with 3/5 first-place votes.");
insertRound.run(10, 1, null, "Death's Door wins with 4/6 first-place votes.");
insertRound.run(11, 1, null, "Flight Sim - F-18 Carrier Challenge wins with 3/5 first-place votes.");
insertRound.run(12, 1, null, "Sable wins with 3/5 first-place votes.");
insertRound.run(13, 1, null, "TMNT: Shredder's Revenge wins with 4/6 first-place votes.");
insertRound.run(14, 1, null, "Road 96 wins with 3/5 first-place votes.");
insertRound.run(15, 1, null, "Tunic wins with 3/4 first-place votes.");
insertRound.run(16, 1, null, "The Wolf Among Us wins with 3/4 first-place votes.");
insertRound.run(17, 1, null, "Pentiment wins with 3/4 first-place votes.");
insertRound.run(18, 1, null, "Norco wins with 3/5 first-place votes.");
insertRound.run(19, 1, null, "Hi-Fi Rush wins with 3/5 first-place votes.");
insertRound.run(20, 1, null, "Dead Space (2008 or 2023) wins with 3/4 first-place votes.");
insertRound.run(21, 1, null, "Return to Monkey Island wins with 3/4 first-place votes.");
insertRound.run(22, 1, null, "Inside wins with 4/7 first-place votes.");
insertRound.run(23, 1, null, "Citizen Sleeper wins with 3/4 first-place votes.");
insertRound.run(24, 1, null, "NFS: Unbound wins with 3/4 first-place votes.");
insertRound.run(25, 1, null, "Venba wins with 3/4 first-place votes.");
insertRound.run(26, 1, null, "A Short Hike wins with 3/5 first-place votes.");
insertRound.run(27, 1, null, "The Expanse: A Telltale Series wins with 2/3 first-place votes.");
insertRound.run(28, 1, null, "Thirsty Suitors wins with 2/3 first-place votes.");
insertRound.run(29, 1, null, "Jusant wins with 3/4 first-place votes.");
insertRound.run(30, 1, null, "Sifu wins with 3/4 first-place votes.");
insertRound.run(31, 1, null, "Bloodstained: Ritual of the Night wins with 3/4 first-place votes.");
insertRound.run(32, 1, null, "Open Roads wins with 4/6 first-place votes.");
insertRound.run(33, 1, null, "Fallout wins with 3/5 first-place votes.");
insertRound.run(34, 1, null, "Another Crab's Treasure wins with 3/4 first-place votes.");
insertRound.run(35, 1, null, "Little Kitty Big City wins with 3/5 first-place votes.");
insertRound.run(36, 1, null, "Beyond Good & Evil wins with 4/6 first-place votes.");
insertRound.run(37, 1, null, "Coral Island wins with 3/5 first-place votes.");
insertRound.run(38, 1, null, "Night in the Woods wins with 3/5 first-place votes.");
insertRound.run(39, 1, null, "Tactical Breach Wizards wins with 3/5 first-place votes.");
insertRound.run(40, 1, null, "Hellblade 2 wins with 3/5 first-place votes.");
insertRound.run(41, 1, null, "Dungeons of Hinterberg wins with 3/5 first-place votes.");
insertRound.run(42, 1, null, "1000xRESIST wins with 3/5 first-place votes.");
insertRound.run(43, 1, null, "Indiana Jones and the Great Circle wins with 3/5 first-place votes.");
insertRound.run(44, 1, null, "Citizen Sleeper 2 wins with 3/5 first-place votes.");
insertRound.run(45, 1, null, "South of Midnight wins with 3/5 first-place votes.");
insertRound.run(46, 1, null, "Old Skies wins with 3/4 first-place votes.");
insertRound.run(47, 1, null, "The Stanley Parable (any edition) wins with 4/6 first-place votes.");
insertRound.run(48, 1, null, "NetHack wins with 4/6 first-place votes.");
insertRound.run(49, 1, null, "The Outer Worlds wins with 3/5 first-place votes.");
insertRound.run(50, 1, null, "Peak wins with 2/2 first-place votes.");
insertRound.run(51, 1, null, "Keeper wins as sole nominee.");
insertRound.run(52, 1, null, "Dispatch wins with 4/5 first-place votes.");
insertRound.run(53, 1, 140, "Routine eliminated with 0 first-place votes.");
insertRound.run(53, 2, 138, "Between Horizons eliminated with 1 first-place vote.");
insertRound.run(53, 3, null, "Wolfenstein: The New Order wins with 3/5 first-place votes.");
insertRound.run(54, 1, 144, "Bioshock eliminated with 0 first-place votes.");
insertRound.run(54, 2, 145, "Is This Seat Taken? eliminated by tiebreaker with 1 first-place vote.");
insertRound.run(54, 3, 143, "Sword of the Sea eliminated with 1 first-place vote.");
insertRound.run(54, 4, 142, "Indika eliminated by tiebreaker with 3 first-place votes.");
insertRound.run(54, 5, null, "Disco Samurai wins with 6/6 first-place votes.");
insertRound.run(55, 1, null, "Indika wins as sole nominee with 6/6 first-place votes.");
insertRound.run(56, 1, 106, "Unavowed eliminated with 1 first-place vote.");
insertRound.run(56, 2, null, "Into the Breach wins with 4/6 first-place votes.");

console.log("✅ Database seeded successfully!");
console.log("   - 7 members (password: gameclub)");
console.log("   - 147 games (55 completed, 92 nominated)");
console.log("   - 56 closed elections with ranked choice ballots");

db.close();

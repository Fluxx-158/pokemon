# Pokemon Champions

Web app for managing Pokemon Champions teams (Doubles and Singles). Pokedex, type chart, damage calc, lead helper, team builder, matchup notes, and live competitive usage data (moves/items/spreads/teammates per Pokemon, Reg M-B).

> **Already running an older version? See [Upgrading an existing install](#upgrading-an-existing-install) before you do anything else**, recent changes add two database columns, so pulling without migrating will break the app.

## Stack

NestJS + Fastify + Drizzle + MySQL on the backend. React 19 with Vite, TanStack Router, TanStack Query, shadcn/ui and Tailwind on the frontend.

## Prerequisites

Node.js 20+ and MySQL 8.0+.

## Installing MySQL

Skip this if you already have MySQL running locally.

### Windows

Grab the MySQL Installer from https://dev.mysql.com/downloads/installer/. Pick the "Server only" setup, accept the defaults (Standalone Server, port 3306), and set a root password you can remember. You'll need it again later for `backend/.env`. Leave "Configure as a Windows Service" checked so MySQL starts with your machine.

### macOS

```bash
brew install mysql
brew services start mysql
mysql_secure_installation
```

`mysql_secure_installation` prompts for a root password and asks about removing anonymous users and disabling remote root. Say yes to everything.

### Linux (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo mysql_secure_installation
```

### Check it works

```bash
mysql -u root -p
```

Type the root password. You should land at the `mysql>` prompt. `exit` to leave.

### Safety bits

A default install binds to localhost only. Don't change `bind-address` unless you have a reason to. Don't reuse the root password anywhere else.

## Database GUI

Optional, but makes life easier, especially the seed import in step 4.

[DBeaver Community Edition](https://dbeaver.io/download/) works on Windows, macOS, and Linux. On macOS you can grab it via Homebrew:

```bash
brew install --cask dbeaver-community
```

Create a new MySQL connection (Database → New Database Connection → MySQL):

- Host: `localhost`
- Port: `3306`
- User: `root`
- Password: whatever you set during MySQL install
- Database: leave blank for now

Hit Test Connection. If DBeaver offers to download a driver, say yes. Save.

## Setup

### 1. Install deps

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Env files

```bash
cp backend/.env.sample backend/.env
cp frontend/.env.example frontend/.env
```

Open `backend/.env` and fill in your MySQL credentials.

### 3. Create the database

From `backend/`:

```bash
npm run db:setup         # creates the pokemon_champions database
npm run db:push          # applies the Drizzle schema
npm run db:apply-views   # adds the SQL views
```

### 4. Load the seed data

There's a SQL dump at `backend/db/seed-data.sql` with types, abilities, moves, items, Pokemon, mega evolutions, and the type chart. Data only. The schema came from step 3.

In DBeaver: expand your MySQL connection, click on `pokemon_champions`, right-click → Tools → Execute SQL Script. Pick the seed file, run it.

CLI version from the repo root:

```bash
mysql -u root -p pokemon_champions < backend/db/seed-data.sql
```

The bundled `seed-data.sql` predates the Pokedex evolution-stage filter, so every Pokemon's `stage` starts at the `basic` default. Populate real stages (Baby/Basic/Stage 1/Stage 2/Mega) once after importing:

```bash
cd backend
npm run sync:evolution-stages   # hits PokeAPI to fill pokemon.stage
```

This is optional, the rest of the app works without it; only the Pokedex stage filter is inaccurate until you run it.

**Competitive usage data** (move/item/ability/spread/teammate usage per Pokemon, Reg M-B Doubles + Singles) comes from [championsbattledata.com](https://championsbattledata.com) and lives in its own `pokemon_usage` table, it isn't in the SQL dump. You don't have to do anything: the backend pulls it automatically on first startup (and re-checks daily). To populate it up front instead, run:

```bash
cd backend
npm run sync:usage      # ~235 Pokemon × 2 formats; takes a minute
npm run verify:usage    # optional sanity check (also runs automatically after sync:usage)
```

**Running fully offline?** Set `USAGE_SYNC_ENABLED=false` in `backend/.env` (see `.env.sample`). The app then makes **no network calls at all**, no startup or daily usage sync. Everything except the meta/usage features works with no internet: Pokédex, type chart + coverage, damage calc, team builder, teams, matchups, lead helper, and the EV optimizer (which falls back to neutral spread assumptions). The meta-dependent surfaces (the "vs Meta" coverage matrix, Suggested partners, meta rows in Speed tiers, and the Competitive-usage panel) show a small "unavailable" note instead of empty tables. If you *have* synced at least once, those features keep working offline from the DB, the internet is only ever needed to *refresh* the data.

If you'd rather rebuild the data from upstream sources (slower, hits PokeAPI), the seed scripts still work:

```bash
cd backend
npm run seed:types
npm run seed:abilities
npm run seed:moves
npm run seed:items
npm run seed:pokemon
npm run sync:evolution-stages
npm run seed:mega-evolutions
npm run seed:metadata
npm run sync:usage
```

### 5. Sprites

Sprites aren't checked in. Regenerate them from the data:

```bash
cd backend
npm run mirror:sprites
```

## Upgrading an existing install

If you set the app up from an earlier version, pull the latest code, **reinstall deps** (`cd backend && npm install`, a new dependency, `@nestjs/schedule`, was added), then bring your existing database up to date from `backend/`:

```bash
npm run db:push                 # adds pokemon.stage, teams.format, and the pokemon_usage table
npm run sync:evolution-stages   # fills pokemon.stage from PokeAPI (Pokedex stage filter)
npm run sync:usage              # optional, usage data; the backend also self-populates on startup
```

What changed and why these steps are safe:

- **`pokemon.stage`** (evolution stage), **`teams.format`** (doubles/singles/both), and the new **`pokemon_usage`** table (+ two `metadata` freshness columns) are all additive, so `db:push` is non-destructive, existing rows keep working. Stick with `db:push` (not `db:migrate`) if you originally set the schema up with `db:push`; mixing the two re-runs every migration from scratch and will error on tables that already exist.
- **Existing teams** automatically read as `format = doubles`; nothing to do unless you want to tag a team `singles` or `both` (set `- Format:` in its `team.md` Notes, then re-save/re-seed).
- **`sync:evolution-stages`** only fills the `stage` column; **`sync:usage`** only fills `pokemon_usage`. Both are safe to skip, the app runs without them (the stage filter is inaccurate, and usage panels are empty, until populated). Usage also refreshes itself: the backend syncs on startup if the data is missing/>24h old, then daily.

## Running it

Two terminals:

```bash
cd backend && npm run start:dev   # API on :3000
cd frontend && npm run dev        # UI on :5173
```

## Tests

Unit tests (Vitest) cover the pure logic, stat/damage/speed formulas, the type-coverage + meta-matrix engine, the spread optimizer, the Showdown parser, team-markdown parsing, and the usage-sync format/season resolution (the bit that guards against upstream API shape changes).

```bash
cd backend  && npm test     # or npm run test:watch
cd frontend && npm test
```

## Routes

- `/` - home
- `/pokemon` : Pokedex
- `/pokemon/:id` : Pokemon detail
- `/types` : dual type chart
- `/teams` : saved teams
- `/teams/new` : team builder
- `/teams/:id` : team detail (strategy, coverage, speed tiers, calc)
- `/calc` : damage calculator
- `/lead-helper` : lead pair planner
- `/matchups` : matchup notes

## Layout

```
backend/    NestJS API, Drizzle schema, seed scripts
frontend/   Vite + React app
```

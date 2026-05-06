# Pokemon Champions

Web app for managing Pokemon Champions doubles teams. Pokedex, type chart, damage calc, lead helper, team builder, matchup notes.

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

If you'd rather rebuild the data from upstream sources (slower, hits PokeAPI), the seed scripts still work:

```bash
cd backend
npm run seed:types
npm run seed:abilities
npm run seed:moves
npm run seed:items
npm run seed:pokemon
npm run seed:mega-evolutions
npm run seed:metadata
```

### 5. Sprites

Sprites aren't checked in. Regenerate them from the data:

```bash
cd backend
npm run mirror:sprites
```

## Running it

Two terminals:

```bash
cd backend && npm run start:dev   # API on :3000
cd frontend && npm run dev        # UI on :5173
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

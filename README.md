# FORGE

FORGE is a dark, mobile-first training log built for one person: **Henry**.
There is no login screen, email, password, account picker, or onboarding flow.
Open the app on any device and the same Firestore log is there.

## What it does

- Today's scheduled workout, weekly split, and rest days
- Template-driven strength sessions with independent weight and rep entry
- Skipped and incomplete sets, draft recovery, and duplicate-workout prevention
- Rest timer with sound and vibration preferences
- Completed-session snapshots and real workout history
- Streaks that skip rest days, calculated in `Asia/Bangkok`
- Personal records, progression suggestions, volume charts, and a training calendar
- Body measurements, weight trends, and profile synchronization
- JSON archive and CSV exports
- Settings for profile, units, defaults, timezone, install state, and split reset
- Firebase Hosting deployment on the free Spark plan

No analytics, ads, or third-party tracking are included.

## The split

| Day | Workout | Exercises |
| --- | --- | ---: |
| Monday | Push | 8 |
| Tuesday | Pull | 7 |
| Wednesday | Legs | 5 |
| Thursday | Cardio | — |
| Friday | Upper | 12 |
| Saturday | Legs | 5 |
| Sunday | Rest | — |

Seed details that are intentionally preserved:

- V-Bar Press uses 1 working set on Push.
- Leg Press starts with no prescribed load.
- Close Grip Sitting Row starts as **Full stack + 15 kg**.
- Good Girl Abductor Machine starts as **Full stack + 20 kg**.
- Dumbbell Chest Supported Row uses **35 kg per dumbbell**.
- Back Extensions starts with **20 kg in plates**.
- Friday Upper excludes JM Press, Close Grip Sitting Row, and Back Extensions.
  It has exactly 12 exercises.

## How sync works

FORGE has no login UI and no Firebase Authentication requirement. Every device
reads and writes one Firestore namespace: `users/shared`. The first device seeds
Henry at 70 kg, 172 cm, `Asia/Bangkok`; every other device sees the same data.

That choice has one important trade-off:

- Laptop and phone stay in sync automatically. There is no pairing code,
  browser session, or account to recover.
- **Anyone who has the app link can read or change the log.** The Firestore
  path is intentionally public. Keep the link to yourself.
- Clearing browser storage does **not** lose the log because there is no
  browser-specific identity.
- Use **Settings → Data export** for an offline backup, but exports are optional.

The previous build created a different hidden anonymous Firebase account in
each browser. On first launch, FORGE copies any documents left by that old
session into the shared log so existing workouts are not stranded. The old
private paths remain available only to their original signed-in owner for that
one-time migration.

## Stack

- Next.js 16 App Router with static export
- React 19 + TypeScript
- Tailwind CSS 4
- Firebase Firestore and Firebase Hosting (no auth provider)
- One-time legacy migration from the previous anonymous build
- Recharts, Radix UI, Lucide, Sonner, Zod
- Vitest for domain tests, Firebase Rules Unit Testing for security tests
- Playwright for the no-login browser smoke flow

## Local setup

### 1. Requirements

- Node.js 20+
- npm
- Java 21 for the Firebase Emulator Suite (not needed for a hosted build)
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project on the Spark plan with Firestore

On this Mac, put the Homebrew JDK on the path before starting emulators or
running rules tests:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH="$JAVA_HOME/bin:$PATH"
```

### 2. Firebase project

FORGE ships with the public web identifiers for its Firebase project in
`src/lib/firebase/public-config.ts`. A clean checkout therefore builds without
an `.env.local` file. These values are identifiers, not secrets.

Before the first hosted launch, the Firebase project itself must have:

1. A Firestore database.
2. The repository's rules and indexes deployed.

Install dependencies and deploy the backend configuration:

```bash
npm install
firebase login
firebase use trackerwork-d3271
firebase deploy --only firestore:rules,firestore:indexes
```

No Authentication provider or sign-in method is required. The shared
`users/shared` path is public by design so every device works immediately.

To point a fork at a different Firebase project, copy `.env.example` to
`.env.local` and fill in the overrides. The committed values remain the
fallback for any value left blank.

### 3. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app opens directly on
Today; there is no `/auth` or `/welcome` route.

### Optional App Check

Leave `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` blank to skip App Check. If you
configure App Check with reCAPTCHA v3, add the site key and register localhost
and the production hosting domain as allowed domains.

## Local Firebase Emulator Suite

Use the emulators for development and tests, never for live data.

```bash
# Terminal 1: Firestore emulator and Emulator UI
npm run emulators

# Terminal 2: Next.js connected to the emulators
npm run dev:emulator -- -p 3001
```

The emulator UI is at [http://localhost:4000](http://localhost:4000).
`dev:emulator` only flips `NEXT_PUBLIC_USE_FIREBASE_EMULATORS`; it still uses
the committed public Firebase config for app initialization. The emulator
suite uses the `demo-forge` project from `.firebaserc` and `firebase.json`.

## Verification

```bash
npm run typecheck
npm run lint
npm test                 # domain tests
npm run test:rules       # Firestore rules tests, starts Firestore emulator
npm run build            # static export to out/
```

### Browser smoke test

The Playwright flow verifies the real no-login path:

1. App opens directly as Henry.
2. A template starts without any authentication UI.
3. One set is logged with an independent weight and rep count.
4. The workout is finished and saved.
5. A second browser context opens the same session from shared Firestore.
6. A full reload and the history/PR/settings views still work.

It uses throwaway emulators and never touches live data.

```bash
# One-time browser install
npx playwright install chromium

# Firestore emulator must be running
lsof -ti tcp:8080 >/dev/null && echo ready

# Stop any dev server already running in this project first; only one Next dev
# server can own a project directory at a time.
npm run test:e2e
```

Playwright starts its own dev server on port `3100` with `demo-forge` emulator
environment variables. It does not use `.env.local` project data.

## Build and deploy

The app is a static export, so Hosting works on the free Spark plan.

```bash
npm run build
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

Before deploying:

- Log in with the Google account that owns the `trackerwork-d3271` project.
  `firebase projects:list` must show it.
- Confirm Firestore rules and indexes are deployed.
- The hosted app must be served over HTTPS for the PWA/service worker to work.
  Firebase Hosting supplies HTTPS automatically.

`firebase.json` sets long-lived cache headers for `_next/static/**`, no-cache
headers for `sw.js`, and the correct manifest MIME type.

If `firebase login` points at the wrong Google account, stop and switch
accounts. Deploying from a different account will not update the intended
project.

## Data and security

Every document lives below `users/shared`. `firestore.rules` makes that
namespace publicly readable and writable so every device can use it without an
account. **This is not private.** Anyone with the app link can view, change, or
delete the log.

Legacy documents from the previous anonymous build stay below each browser's
old `users/{uid}` path. Those paths are still available only to their original
signed-in owner, and the app uses that access once to copy missing documents
into `users/shared`.

## Project layout

```text
src/app/(app)/          Home, workouts, progress, body, settings
src/app/(focus)/        Active workout mode
src/components/         App shell and UI primitives
src/domain/             Split seed, workout math, dates, streaks, PRs, units
src/hooks/              Shared-log session, user data, sessions, drafts, timers
src/lib/firebase/       Firestore client, shared paths, seed, export, migration
tests/domain/           Pure domain tests
tests/rules/            Shared-log and legacy-access tests
tests/e2e/              Playwright no-login cross-device smoke flow
firestore.rules         Public shared path plus legacy owner paths
firebase.json           Hosting, emulator, and cache configuration
```

## Notes

- The live log is stored in Firestore and follows the app link, not a browser
  session. Clearing site data or switching devices does not lose it.
- Anyone with the link can read or change the data. Keep the link private.
- The one-time migration copies missing documents from the old per-browser
  anonymous account. It never deletes the old data.
- History snapshots are immutable: editing templates or restoring the starting
  split never rewrites completed sessions.
- Timestamps and streak calculations use the profile timezone, defaulting to
  `Asia/Bangkok`.

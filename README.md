# FORGE

FORGE is a dark, mobile-first training log built for one person: **Henry**.
There is no login screen, email, password, account picker, or onboarding flow.
Open the app and your log is there.

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

## How identity works

FORGE has no login UI. On first launch it silently creates a real Firebase
**anonymous** identity for that browser. The profile is seeded once as Henry,
70 kg, 172 cm, `Asia/Bangkok`. Firestore Security Rules scope every document to
that anonymous UID.

That choice has one important trade-off:

- The log follows **this browser's anonymous session**. Reloads, restarts, and
  the installed PWA keep the same log.
- Opening FORGE in another browser or after clearing site data creates a new
  empty anonymous session. The old Firestore data is not reachable from the new
  session.
- Use **Settings → Data export** to keep a JSON archive outside Firebase. This
  build does not provide a cross-device login or an in-app archive importer.

The app does not use email/password, Google, or a shared public data path. A
visitor to the hosted URL gets their own empty anonymous namespace; Firestore
rules prevent one UID from reading or writing another UID's data.

## Stack

- Next.js 16 App Router with static export
- React 19 + TypeScript
- Tailwind CSS 4
- Firebase Auth (anonymous only), Firestore, Firebase Hosting
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

### 2. Configure Firebase

1. Create a Firebase project and a Web App in the Firebase Console.
2. Open **Authentication → Sign-in method** and enable **Anonymous**.
3. Create a Firestore database.
4. Copy the environment template:

```bash
cp .env.example .env.local
```

5. Fill `.env.local` with the Web App's public configuration. These values are
   identifiers, not secrets; access is controlled by Firestore Rules.
6. Install dependencies:

```bash
npm install
```

7. Deploy the rules and indexes to the project:

```bash
firebase login
firebase use trackerwork-d3271
firebase deploy --only firestore:rules,firestore:indexes
```

The Anonymous provider must be enabled **before** the first hosted launch.
Without it, the app shows a setup error instead of inventing a local identity.

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
# Terminal 1: Auth, Firestore, Hosting emulator, and Emulator UI
npm run emulators

# Terminal 2: Next.js connected to the emulators
npm run dev:emulator -- -p 3001
```

The emulator UI is at [http://localhost:4000](http://localhost:4000).
`dev:emulator` only flips `NEXT_PUBLIC_USE_FIREBASE_EMULATORS`; it still uses
the public Firebase config from `.env.local` for app initialization. The
emulator suite uses the `demo-forge` project from `.firebaserc` and
`firebase.json`.

The anonymous provider is available automatically in the Auth emulator.

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
5. The anonymous session survives a full reload.
6. History/PR statistics and settings render.

It uses throwaway emulators and never touches live data.

```bash
# One-time browser install
npx playwright install chromium

# Emulators must be running
lsof -ti tcp:9099 >/dev/null && lsof -ti tcp:8080 >/dev/null && echo ready

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
- Enable **Anonymous** under Firebase Authentication.
- Confirm Firestore rules and indexes are deployed.
- The hosted app must be served over HTTPS for the PWA/service worker to work.
  Firebase Hosting supplies HTTPS automatically.

`firebase.json` sets long-lived cache headers for `_next/static/**`, no-cache
headers for `sw.js`, and the correct manifest MIME type.

If `firebase login` points at the wrong Google account, stop and switch
accounts. Deploying from a different account will not update the intended
project.

## Data and security

Every document lives below `users/{uid}`. `firestore.rules` allows only:

- an authenticated Firebase user
- whose auth UID matches `{uid}`
- for the known collections

Unknown collections are denied. Email/password and Google auth are not used by
the app, and there is no account deletion or sign-out UI, because either action
would break the single anonymous session.

## Project layout

```text
src/app/(app)/          Home, workouts, progress, body, settings
src/app/(focus)/        Active workout mode
src/components/         App shell and UI primitives
src/domain/             Split seed, workout math, dates, streaks, PRs, units
src/hooks/              Auth, user data, sessions, drafts, rest timer, measurements
src/lib/firebase/       Firebase client, auth, Firestore repositories, seed, export
tests/domain/           Pure domain tests
tests/rules/            Firestore tenant-isolation tests
tests/e2e/              Playwright no-login smoke flow
firestore.rules         Per-UID access policy
firebase.json           Hosting, emulator, and cache configuration
```

## Notes

- The live log is only as durable as the browser session and Firebase project.
  Keep the JSON archive current.
- Clearing browser storage, using private browsing, or uninstalling the PWA can
  remove the only local link to the anonymous account.
- History snapshots are immutable: editing templates or restoring the starting
  split never rewrites completed sessions.
- Timestamps and streak calculations use the profile timezone, defaulting to
  `Asia/Bangkok`.

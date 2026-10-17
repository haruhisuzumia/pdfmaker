# PDF Maker

A free, private document scanner and PDF toolkit for Android. No ads, no watermark, no account required.
Documents are saved to the phone's `Documents/PDF Maker` folder, and optionally to the user's own Google Drive.

See [docs/PLAN.md](docs/PLAN.md) for the screens, tech stack and milestones.

## Stack

Expo (SDK 58) · React Native · TypeScript · Expo Router · React Native Paper · expo-sqlite + Drizzle ORM · Zustand · pdf-lib ·
ML Kit document scanner · react-native-pdf-thumbnail · expo-image-manipulator ·
a local Kotlin Expo module ([modules/media-store](modules/media-store)) for saving to shared storage through MediaStore.

## Requirements

- Node 22+, JDK 21, Android SDK (API 36)
- An Android phone with USB debugging, or an emulator with a **Google Play** system image (the ML Kit scanner needs Play services)
- Android 10 (API 29) or newer

## Run

```bash
npm install
npm run android   # builds the development app and installs it on the connected device/emulator
```

The app uses native modules, so it does not run in Expo Go. Scanning uses Google's ML Kit document scanner, which needs Google Play services on the phone.

## Scripts

| Command | What it does |
|---|---|
| `npm run android` | Build and run the dev app on Android |
| `npm start` | Start the Metro dev server for an installed dev build |
| `npm test` | Unit tests (Jest) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a Drizzle migration after editing `src/db/schema.ts` |

## Project layout

```
src/app/         screens (Expo Router)
src/components/  UI pieces (document row, badges, sheets)
src/db/          SQLite schema, client and queries
src/lib/         pure helpers (filtering, sorting, formatting), unit tested
src/storage/     saving scans, import, share, rename, delete, page images; Google Drive sync later
src/scan/        ML Kit scanner wrapper and draft files
src/pdf/         page layout and PDF building (unit tested)
src/store/       persisted settings
modules/media-store/  Kotlin module: save/delete files in Documents/PDF Maker
drizzle/         generated SQL migrations
```

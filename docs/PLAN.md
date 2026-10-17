# PDF Maker: Android app plan (screens and tech stack)

## Context
`/Users/vm/Desktop/workspace/pdfmaker` is empty. The goal is a **free, trustworthy CamScanner alternative for Android**, aimed first at Indian users (CamScanner is still banned in India as of Oct 2026). It should help people and also strengthen the user's résumé.

Decisions already made with the user:
- **No ads, no watermark, always fully free** (no billing, no Pro tier)
- **Storage:** phone storage (the default, no sign-in) **or** Google Drive (optional Google sign-in), with **one document list** covering both
- **Stack:** React Native with **Expo** (the user's other projects are JavaScript/TypeScript)
- **Scanner:** Google ML Kit's ready-made scanner screen first; our own camera screen in a later version
- Android only for now

Environment: Android SDK (platforms 33/35/36.1, build-tools up to 37), JDK 21 and adb are installed. No Node project yet.

---

## Tech stack

| Area | Choice | Why |
|---|---|---|
| Framework | **Expo SDK 58** + TypeScript, **development builds** (not Expo Go) | Native modules are needed; EAS builds and Play submission |
| Navigation | **Expo Router** (file-based) | Standard in modern Expo |
| UI | **React Native Paper** (Material 3) | Looks native on Android, has dark mode, quick to build with |
| Scanner | **`@infinitered/react-native-mlkit-document-scanner`** (wraps Google's ML Kit scanner screen) | Free and on-device: edge detection, flattening, filters, cleanup, multi-page. Returns page JPEGs and a PDF. Fallback: `react-native-document-scanner-plugin` |
| Text recognition (OCR) | ML Kit text recognition v2 through a React Native wrapper (`@react-native-ml-kit/text-recognition`; check Expo 58 support at setup) | On-device; Latin and **Devanagari** (Hindi, Marathi) scripts |
| PDF editing | **`pdf-lib`** (pure JavaScript) | Merge, split, extract pages, place a signature, build the ID-card page, rebuild compressed PDFs |
| PDF viewing | Page images + a pinch-zoom view (gesture-handler + reanimated) | Every document keeps its page images (scans directly, imported PDFs rendered once), so no PDF view library is needed |
| PDF → images | **`react-native-pdf-thumbnail`** | Thumbnails, rendering imported PDFs' pages for the viewer, and later for compression |
| Page reordering | **`react-native-reorderable-list`** | Drag to reorder pages on the Review screen |
| Image processing | **`expo-image-manipulator`** | Resize, crop, rotate and JPEG quality, for compress-to-size and passport photos |
| Files | **`expo-file-system`** (new `File`/`Directory` API) + **a small local Expo module in Kotlin, `modules/media-store`** | Saves PDFs into the shared **`Documents/PDF Maker`** folder through Android's MediaStore, with no storage permission, and files survive uninstall. The Kotlin module is also a good résumé item |
| Database | **`expo-sqlite` + Drizzle ORM** (live queries) | The local index behind the unified document list |
| App state | **Zustand** | Small and simple |
| Google sign-in | **`@react-native-google-signin/google-signin`**, scope **`drive.file`** only | The app sees only files it created, which avoids Google's restricted-scope security review |
| Drive API | Drive REST v3 through `fetch` (resumable upload, list, delete) | No heavy SDK |
| Connectivity | `@react-native-community/netinfo` | Upload queue, "only on Wi-Fi" setting |
| Signature drawing | **`@shopify/react-native-skia`** | Smooth drawing, exports PNG |
| Pickers and sharing | `expo-document-picker` (also opens Google Drive's file picker), `expo-image-picker`, `expo-sharing` | Import and share |
| Fingerprint app lock | `expo-local-authentication` | Optional setting |
| Crash monitoring | **Play Console Android vitals only**, no analytics SDK | Keeps the "no tracking" promise; the Data safety form can say "no data collected" |
| Testing | Jest + React Native Testing Library (logic and UI), **Maestro** (end-to-end flows) | |
| Build and CI | **EAS Build / EAS Submit**, GitHub Actions (lint, typecheck, tests) | Target API 36 (Play requirement) |

---

## Screens

**Navigation:** a bottom tab bar with **Documents · Tools · Settings**, plus stack screens on top. A floating **Scan** button sits on the Documents tab.

### 1. Onboarding (first launch only)
- Three slides: *Private, it never leaves your phone* · *Works offline* · *Free, no watermark, no ads*
- **Where to save?** → 📱 Phone (default) / ☁️ Phone + Google Drive (Google sign-in) / skip
- No account is required to start.

### 2. Documents (home tab)
- Filter chips: **All · 📱 Phone · ☁️ Drive**; search; sort (date, name, size); list or grid view
- Each row shows: thumbnail, title, pages · size · date, and a location badge 📱 / ☁️ / 📱☁️ / ⏳ uploading / ⚠️ failed (tap to retry)
- Pull to refresh checks Drive for changes
- Long-press to multi-select → **Merge · Share · Delete**
- Empty state: "Scan your first document" button
- **Scan button → "New" bottom sheet:** Scan document · Scan ID card · Import photos · Import PDF (phone or Drive)

### 3. Scanner (Google's ML Kit screen)
- Edge detection, auto-capture, flattening, filters, cleanup and multi-page come built in.
- In ID card mode it's limited to 2 pages (front and back).

### 4. Review and save
- Name field (pre-filled as `Scan 17 Oct 2026 10-32`)
- Page strip: reorder (drag), rotate, delete, **+ add pages**
- Save as **PDF / JPG**; save to **Phone / Drive / Both** (defaults come from Settings)
- **Save** → back to Documents with the new item at the top
- ID card mode: front and back are placed on one A4 page automatically

### 5. Document viewer
- Swipe pages and pinch to zoom
- Action bar: **Share · Compress · Sign · Extract text · Edit pages**
- ⋮ menu: Rename · Save copy as JPG · Save to Drive / Save to phone · Delete (asks "phone, Drive or both?")

### 6. Edit pages
- Grid of pages: reorder, rotate, delete, add, **extract the selected pages into a new PDF** (split)

### 7. Compress to size
- Presets: **50 KB · 100 KB · 200 KB · 500 KB · 1 MB** + custom
- Shows the current size, then the result size with a quality preview before saving
- Option: save as a new copy or replace the original

### 8. Sign
- Saved signatures list, plus "Draw new" (Skia canvas, 3 pen colors)
- Drag and resize the signature on a page → Apply (saves a new version)

### 9. Extract text (OCR)
- Recognized text per page (Latin and Hindi scripts) → **Copy · Share as .txt**

### 10. Tools (tab)
Merge PDFs · Split PDF · Compress PDF/image · Images → PDF · PDF → Images · Scan ID card · **Passport / exam photo**

### 11. Merge
- Pick documents, drag to order → name → Merge

### 12. Passport / exam photo
- Pick or take a photo → choose a preset (passport 35×45 mm, Indian visa 51×51 mm, exam portal 3.5×4.5 cm, signature strip) → crop → **target size in KB** → save JPG

### 13. Settings
- Default save location: Phone / Drive / Both
- Google Drive: Connect · *connected as name@gmail.com* · Disconnect
- Upload only on Wi-Fi
- Default page size: A4 / Letter / Fit to image
- Theme: System / Light / Dark
- App lock with fingerprint
- Phone folder: *Documents/PDF Maker* · **Re-link folder** (after reinstalling)
- About · Privacy policy · Open-source licenses

---

## Data and storage design

**Folders**
- `Documents/PDF Maker/*.pdf|jpg` is the user-visible copy, written through the Kotlin `media-store` module.
- App-private `pages/<docId>/NNN.jpg` keeps the original page images (fast re-editing and compression without re-rendering), and `thumbs/<docId>.jpg` holds thumbnails.

**SQLite (Drizzle) tables**
- `documents`: id, title, kind (`pdf`|`jpg`), pageCount, sizeBytes, createdAt, updatedAt, localUri?, driveFileId?, syncState (`local_only` | `pending_upload` | `uploading` | `synced` | `drive_only` | `error`), thumbPath
- `signatures`: id, path, createdAt
- `settings`: key/value pairs

**Google Drive sync**
1. Sign in with the `drive.file` scope. Create or find the **`PDF Maker`** folder and store its ID.
2. **Upload queue:** documents marked `pending_upload` upload one at a time (resumable). The queue runs on app start and whenever the network comes back, and respects "Wi-Fi only".
3. **Reconcile** (pull to refresh, or app returns to the foreground): list the files in that Drive folder.
   - A file not yet in the database is added as `drive_only`.
   - A file in the database but missing from Drive loses its Drive badge.
4. Opening a `drive_only` document downloads it to the cache.
5. Disconnecting Drive removes Drive-only documents from the list; phone copies stay.

**One-time Google Cloud setup:** a project, the OAuth consent screen, an Android OAuth client (package name + SHA-1 from both EAS and Play App Signing), and a Web client ID for the sign-in library.

---

## Project structure (planned)
```
pdfmaker/
  app/                    # Expo Router screens
    (tabs)/index.tsx      # Documents
    (tabs)/tools.tsx
    (tabs)/settings.tsx
    onboarding.tsx
    scan/review.tsx
    doc/[id]/index.tsx    # viewer
    doc/[id]/edit.tsx
    doc/[id]/compress.tsx
    doc/[id]/sign.tsx
    doc/[id]/text.tsx
    tools/merge.tsx
    tools/photo.tsx
  src/
    db/ (schema.ts, client.ts, queries.ts)
    storage/ (localStore.ts, driveClient.ts, syncEngine.ts, uploadQueue.ts)
    pdf/ (build.ts, merge.ts, split.ts, sign.ts, compress.ts, idCard.ts)
    scan/ (scanner.ts, ocr.ts)
    components/ (DocRow, LocationBadge, PageStrip, SizePresetPicker, ...)
    store/ (settings.ts, selection.ts)
  modules/media-store/    # local Expo module (Kotlin): save, delete, query in Documents/PDF Maker
  e2e/                    # Maestro flows
  app.config.ts, eas.json, drizzle.config.ts
```

---

## Milestones (about 6 weeks solo)

| Week | Deliverable |
|---|---|
| 1 | Expo project, dev build on a device, Paper theme, tabs, onboarding, SQLite + Drizzle, `media-store` Kotlin module, Documents list from the database |
| 2 | ML Kit scanner → Review and save → viewer → share, rename, delete, thumbnails |
| 3 | Edit pages, merge, split, Images→PDF, import photos and PDFs |
| 4 | Compress to size, ID card mode, passport/exam photo, OCR |
| 5 | Signatures; Google sign-in, Drive upload queue, reconcile, delete from both, settings |
| 6 | Polish, empty and error states, dark mode, tests, privacy policy, store listing, **Play closed test (12 testers × 14 days is required for new personal developer accounts)** |

**Later versions:** our own camera screen (special modes, book mode), searchable PDFs, password-protected PDFs (needs a native PDF library), folders and tags, more OCR scripts, iOS.

**Known risk:** `pdf-lib` runs in JavaScript memory, so a very large PDF (more than about 50 pages, or over 30 MB) may be slow. If that happens, move heavy work into the Kotlin module (Android's `PdfRenderer` + `PdfDocument`).

---

## Verification
- **Device:** a physical Android phone or an emulator **with a Google Play image** (ML Kit's scanner needs Play services). Run with `npx expo run:android` or an EAS development build.
- **Unit tests (Jest):**
  - The compress-to-size search always produces output at or under the target (e.g. ≤100 KB) for sample images and PDFs
  - The reconcile logic produces the right `syncState` for each case: local-only, Drive-only, both, deleted remotely
  - Merge and split page counts
- **End-to-end tests (Maestro):**
  - Onboarding → scan (gallery import on the emulator) → save → appears with 📱
  - Compress to 100 KB → the file size checks out
  - Merge 2 documents → page count correct
  - Delete → removed from the list and the folder
- **Manual Drive check** with a test Google account:
  - Connect → upload shows ⏳ then ☁️ → the file appears in the Drive app under `PDF Maker`
  - Delete a file in the Drive app → refresh → the badge updates
  - Reinstall the app → reconnect → the list rebuilds
- **Before launch:** works in airplane mode (everything except Drive), no network calls when Drive isn't connected (check with Android Studio's network inspector), and the Data safety form says "no data collected"

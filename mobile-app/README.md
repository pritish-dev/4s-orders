# 4S Orders — Android app (APK)

A native Android wrapper around the 4S Interiors Orders app, built with
[Capacitor](https://capacitorjs.com/). It installs as a real app (`.apk`) and
shared to phones, and **loads its screens from a live web copy so updates reach
every installed app without reinstalling**.

## Over-the-air updates (no reinstalling)

The app is configured (`capacitor.config.json` → `server.url`) to load the
mobile web copy hosted on GitHub Pages:

```
https://pritish-dev.github.io/4s-orders/mobile-app/www/
```

Because this folder is part of the repo, **every merge to `master` redeploys it**
via GitHub Pages, and every installed app picks up the new version the next time
it's opened. You do **not** rebuild or reshare the APK for screen/logic changes.

Rebuild the APK only for **native** changes — app icon, splash, Capacitor
plugins/version, or the `server.url` itself.

- The bundled `www/` copy still ships inside the APK as an offline fallback.
- This mobile copy is separate from the production website (`/index.html` at the
  repo root), so the app can evolve its own look without affecting the web app.

## This is isolated from production

Nothing here touches your live app:

- The web frontend (`/index.html`, `/sw.js`, `/manifest.json`, …) at the repo
  root and its GitHub Pages deployment are **untouched**. This folder has its
  own copy under `mobile-app/www/`.
- The Apps Script backend is **untouched**. The app is just another client of
  the same `…/exec` URL, so it reads/writes the same data. (Point it at a test
  backend instead if you prefer.)

## iPhone / iPad (iOS)

Android and iOS are different platforms — the `.apk` does not run on iOS, and
Apple does not allow installing app files directly (no sideloading). A native
iOS app can only be distributed through the **App Store or TestFlight**, which
needs a paid **Apple Developer account ($99/year)** and a Mac-signed build.

Because the app now loads from a live URL, iPhone/iPad users get the same app —
same screens, same auto-updates, backend pre-filled — with **no App Store and no
cost**, via Safari's *Add to Home Screen*:

1. Open **https://pritish-dev.github.io/4s-orders/mobile-app/www/** in **Safari**
   (must be Safari, not Chrome).
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. A **4S Orders** icon appears on the home screen and opens full-screen like a
   native app. It updates automatically whenever the hosted copy changes.

For iOS the shareable thing is the **link** (not a file). A native App Store /
TestFlight build can be added later if desired — see "Native iOS build" below.

### Native iOS build (optional, needs Apple Developer account)

The Capacitor project can also target iOS (`npx cap add ios`) and be built on a
macOS runner, but it can only be installed on devices once you enrol in the
Apple Developer Program and provide signing credentials (certificate +
provisioning profile). Ask and this can be scaffolded with a macOS CI workflow.

## Pre-filled backend URL

So nobody has to paste the `/exec` URL after installing, it is baked into the
hosted copy: the `BAKED_API_URL` constant near the top of `www/index.html`
seeds it on first launch. New users land straight on the login screen.

- The value lives in this (public) hosted copy — acceptable because the same URL
  already ships inside every distributed APK, and the backend is anonymous-access.
- Users can still change it under **Settings**; their override is respected.
- To change the backend URL later: update `BAKED_API_URL` **and** bump `PIN` in
  `www/index.html`, then merge — the new URL is pushed to all installs.
- The GitHub Actions build also still honours an `API_URL` secret for the APK's
  bundled offline-fallback copy, if set.

## How you get the APK

This repo's GitHub Actions workflow **`Build Android APK`** builds it on
GitHub's runners (they have the Android SDK; the build environment used to
create this project does not):

1. Go to the repo's **Actions** tab → **Build Android APK**.
2. It runs automatically whenever files under `mobile-app/**` change. To build
   on demand, click **Run workflow**.
3. Open the finished run → **Artifacts** → download **`4S-Orders-apk`**
   (contains `4S-Orders.apk`).
4. To get a **stable install link** instead, click **Run workflow**, set
   *"Publish a GitHub Release"* to **true**. The APK is attached to a GitHub
   Release you can open directly on a phone.

### Installing on a phone

Download `4S-Orders.apk`, tap it, and allow **"install from unknown sources"**
when Android prompts (needed for any app not from the Play Store). This debug
build is signed with the standard Android debug key — fine for sharing within
your team by link/WhatsApp/Drive.

## What's inside

| Path | What it is |
|------|-----------|
| `www/` | Copy of the web app. `vendor/` holds React, Babel, jsPDF and QRCode bundled locally, so the app boots fast and works offline (no CDN needed). |
| `capacitor.config.json` | App id (`com.foursinteriors.orders`), name, splash + status-bar theming. |
| `android/` | The generated native Android Studio project (Gradle). |
| `assets/` | Source icon/splash images used to generate the Android icon set. |

### Differences from the web copy (in `www/index.html`)

- CDN `<script>` tags → local `vendor/…` files (bundled in the APK).
- The PWA service worker is **not** registered (the native shell already serves
  assets offline; the web SW's cache paths target GitHub Pages, not the app).

## Updating the app's screens later

When the production `index.html` changes and you want the APK to match, re-copy
it and re-point the vendored script tags:

```bash
cp ../index.html www/index.html
# then re-apply the two edits above: swap the 5 CDN <script> src=… to vendor/…,
# and neutralise the service-worker registration block.
```

Then push — the workflow rebuilds the APK.

## Building locally (optional)

Requires Node 20+, JDK 21, and the Android SDK (`ANDROID_HOME` set).

```bash
npm ci
npx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Open in Android Studio for an emulator/device run: `npx cap open android`.

## Play Store / signed release (future)

The Actions build is a **debug** APK (sideload-friendly). For a Play Store
upload you'd build `assembleRelease`/`bundleRelease`, sign it with your own
keystore (kept as GitHub Secrets, never committed), and bump `versionCode` in
`android/app/build.gradle`. Ask and this can be added to the workflow.

# 4S Orders — Android app (APK)

A native Android wrapper around the 4S Interiors Orders app, built with
[Capacitor](https://capacitorjs.com/). It packages a **copy** of the web
frontend inside an Android WebView shell so it can be installed as a real app
(`.apk`) and shared to phones.

## This is isolated from production

Nothing here touches your live app:

- The web frontend (`/index.html`, `/sw.js`, `/manifest.json`, …) at the repo
  root and its GitHub Pages deployment are **untouched**. This folder has its
  own copy under `mobile-app/www/`.
- The Apps Script backend is **untouched**. The app is just another client: on
  first launch you paste the same `…/exec` URL into **Settings**, exactly like
  the web app, and it reads/writes the same data. (Point it at a test backend
  instead if you prefer.)

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

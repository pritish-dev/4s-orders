# Auto-deploying the Apps Script backend

The `Deploy Apps Script backend` GitHub Action (`.github/workflows/deploy-appsscript.yml`)
pushes `Code.gs` to the Google Apps Script project and re-deploys the **existing**
web app on every merge to `master` that touches the backend. Because it updates
the existing deployment, the `/exec` URL the app calls **stays the same** — no
need to re-paste the URL into the app's Settings.

This is a **one-time setup**. After it's done, merging to `master` deploys the
backend automatically.

---

## What you need

The workflow authenticates as *you* using [`clasp`](https://github.com/google/clasp)
(Google's Apps Script CLI). You provide three repository secrets.

### 1. Enable the Apps Script API

Visit <https://script.google.com/home/usersettings> and turn **Google Apps Script API** ON.
(One-time, per Google account. Without this, `clasp push` fails.)

### 2. Install clasp locally and log in

On your own machine (needs Node.js):

```bash
npm install -g @google/clasp@2.4.2
clasp login
```

`clasp login` opens a browser, you approve, and it writes credentials to
`~/.clasprc.json`. **The entire contents of that file** becomes the
`CLASPRC_JSON` secret below.

```bash
cat ~/.clasprc.json      # copy the whole JSON blob
```

> Treat this like a password — it can edit your Apps Script projects.

### 3. Find the script ID and the deployment ID

From the Apps Script editor for this project:

- **Script ID:** Project Settings (gear icon) → "IDs" → **Script ID**.
- **Deployment ID:** Deploy → **Manage deployments** → click your live web app →
  copy the **Deployment ID** (a long `AKfy…` string). This is the *deployment*
  ID, **not** the `/exec` URL.

### 4. (Recommended) Commit your real `appsscript.json`

The `appsscript.json` in this repo is a **best-guess placeholder**
(timezone Asia/Kolkata, web app "Execute as me / Anyone anonymous"). If your
project's real manifest differs, the deploy will change those settings.

To use your actual manifest instead, run this once locally in a scratch folder
and copy the pulled `appsscript.json` over the one in this repo:

```bash
mkdir /tmp/4s-appsscript && cd /tmp/4s-appsscript
echo '{ "scriptId": "YOUR_SCRIPT_ID", "rootDir": "." }' > .clasp.json
clasp pull           # downloads the live Code.gs + appsscript.json
```

Then commit that `appsscript.json`. (You can ignore the pulled `Code.gs`.)

---

## Add the secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name                 | Value                                              |
| --------------------------- | -------------------------------------------------- |
| `CLASPRC_JSON`              | Full contents of `~/.clasprc.json`                 |
| `APPS_SCRIPT_ID`            | The Script ID                                      |
| `APPS_SCRIPT_DEPLOYMENT_ID` | The web app's Deployment ID (`AKfy…`)              |

---

## Run it

- **Automatic:** merge any change to `Code.gs` on `master`.
- **Manual:** Actions tab → *Deploy Apps Script backend* → **Run workflow**.

The job does `clasp push --force` (updates the editor code) then
`clasp deploy --deploymentId … ` (publishes a new version of the existing web
app). When it goes green, the live backend is updated.

---

## Frontend note

This workflow only handles the **backend** (`Code.gs`). The **frontend**
(`index.html`, `sw.js`, …) is served by GitHub Pages and already updates on
merge; the in-app version gate + service-worker cache bump force clients to
reload the new build the next time they open the app.

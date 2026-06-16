# 🏸 ShuttleScore — Live Badminton Tracker

Real-time badminton score tracker hosted on GitHub Pages, synced via Firebase.

---

## 🚀 Deploy in 5 steps

### Step 1 — Install Node.js (if you don't have it)
Download from https://nodejs.org and install. Then open a terminal and verify:
```
node -v
```

### Step 2 — Create a GitHub repo
1. Go to https://github.com/new
2. Name it `shuttlescore`
3. Keep it Public
4. Click **Create repository**

### Step 3 — Edit package.json
Open `package.json` and replace `YOUR_GITHUB_USERNAME` with your actual GitHub username:
```json
"homepage": "https://YOUR_GITHUB_USERNAME.github.io/shuttlescore",
```

### Step 4 — Install and deploy
Run these commands in the `shuttlescore` folder:

```bash
npm install
npm run deploy
```

This builds the app and pushes it to GitHub Pages automatically.
First deploy takes ~2 minutes.

### Step 5 — Enable GitHub Pages
1. Go to your repo on GitHub → **Settings** → **Pages**
2. Under "Branch" select `gh-pages` → Save
3. Your app is live at: `https://YOUR_GITHUB_USERNAME.github.io/shuttlescore`

---

## 🔐 Referee vs Spectator

- **Spectators** (your 10 friends): just open the URL — they see live scores, no login needed
- **Referee** (you): tap "Ref login" in the top right and enter the code

**Default referee code: `smash`**

To change it, open `src/App.js` and find line:
```js
const REFEREE_CODE = "smash";
```
Change `"smash"` to whatever you want, then redeploy with `npm run deploy`.

---

## 🔥 Firebase security (optional but recommended)

Right now your Firestore is in "test mode" (open to all).
To lock it down so only your app can write, go to:

Firebase Console → Firestore → Rules → paste this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /shuttlescore/{doc} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

This keeps it simple for now — anyone can read (spectators) and write (referee).
Good enough for private use among friends.

---

## 📲 Add to phone home screen (feels like an app!)

**iPhone:** Open in Safari → Share → "Add to Home Screen"
**Android:** Open in Chrome → Menu → "Add to Home Screen"

---

## 🔄 Update the app

Make changes to `src/App.js`, then run:
```bash
npm run deploy
```
Done. Updates go live in ~1 minute.

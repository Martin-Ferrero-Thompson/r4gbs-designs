# Migration Plan: Consolidate riding4gbs.com Infrastructure

**Goal**: One consistent name (`riding4gbs-website`) across GitHub, Vercel, and local development, with `riding4gbs.com` pointing to the new Astro site.

**Current state**:

| Layer | Old site | New site |
|---|---|---|
| GitHub repo | `riding4gbs-website` | `r4gbs-designs` |
| Vercel project | `riding4gbs-website` | `r4gbs-designs` |
| Local folder | *(unknown/archived)* | `~/Projects/riding4gbs-opus` |
| Domain | `riding4gbs.com` → old Vercel project | *(not assigned)* |
| DNS (GoDaddy) | Points to Vercel infrastructure | *(no change needed)* |

**Target state**:

| Layer | Value |
|---|---|
| GitHub repo | `riding4gbs-website` |
| Vercel project | `riding4gbs-website` |
| Local folder | `~/Projects/riding4gbs-website` |
| Domain | `riding4gbs.com` → new Vercel project |
| Old repo | `riding4gbs-v1` (archived) |

---

## Pre-flight checks

- [ ] Confirm the new site (`r4gbs-designs` on Vercel) builds and deploys correctly on its `.vercel.app` URL
- [ ] Confirm you have no uncommitted/unpushed work in `~/Projects/riding4gbs-opus`
- [ ] Note down any environment variables set on the **old** `riding4gbs-website` Vercel project (Settings → Environment Variables) — you may need to replicate them
- [ ] Note down any redirects or custom config on the old Vercel project

---

## Step-by-step

### Phase 1: Rename the old GitHub repo (free up the name)

- [ ] **Step 1** — Go to GitHub → `Martin-Ferrero-Thompson/riding4gbs-website` → Settings → General
- [ ] **Step 2** — Under "Repository name", change it to `riding4gbs-v1`
- [ ] **Step 3** — Click "Rename" — GitHub will set up an automatic redirect from the old URL

### Phase 2: Archive the old GitHub repo

- [ ] **Step 4** — Still in `riding4gbs-v1` → Settings → scroll to "Danger Zone"
- [ ] **Step 5** — Click "Archive this repository" — this makes it read-only and clearly marks it as retired

### Phase 3: Rename the new GitHub repo

- [ ] **Step 6** — Go to GitHub → `Martin-Ferrero-Thompson/r4gbs-designs` → Settings → General
- [ ] **Step 7** — Under "Repository name", change it to `riding4gbs-website`
- [ ] **Step 8** — Click "Rename"

### Phase 4: Update your local git remote

- [ ] **Step 9** — Open a terminal in your project folder and run:
  ```bash
  cd ~/Projects/riding4gbs-opus
  git remote set-url origin https://github.com/Martin-Ferrero-Thompson/riding4gbs-website.git
  ```
- [ ] **Step 10** — Verify with:
  ```bash
  git remote -v
  ```
  Should show `riding4gbs-website.git` for both fetch and push.

### Phase 5: Rename your local folder

- [ ] **Step 11** — Close VS Code (or any editors with the folder open)
- [ ] **Step 12** — Rename the folder:
  ```bash
  mv ~/Projects/riding4gbs-opus ~/Projects/riding4gbs-website
  ```
- [ ] **Step 13** — Reopen VS Code from the new location:
  ```bash
  code ~/Projects/riding4gbs-website
  ```

### Phase 6: Rename the Vercel project

- [ ] **Step 14** — Go to Vercel Dashboard → `r4gbs-designs` project → Settings → General
- [ ] **Step 15** — Change the "Project Name" to `riding4gbs-website`
- [ ] **Step 16** — Verify the GitHub repo connection still works: Settings → Git — it should show the renamed `riding4gbs-website` repo. If it lost the connection, reconnect it to `Martin-Ferrero-Thompson/riding4gbs-website`
- [ ] **Step 17** — Trigger a test deployment (push a small commit or use "Redeploy" in Vercel) and confirm the site works on the new `.vercel.app` URL

### Phase 7: Move the domain (brief downtime — do steps 18-19 back-to-back)

- [ ] **Step 18** — Go to Vercel Dashboard → **old** project (`riding4gbs-website` — which is now named something different on Vercel, or may still have the domain). Navigate to Settings → Domains → **Remove** `riding4gbs.com` (and `www.riding4gbs.com` if present)
- [ ] **Step 19** — **Immediately** go to Vercel Dashboard → **new** `riding4gbs-website` project → Settings → Domains → **Add** `riding4gbs.com`
  - Also add `www.riding4gbs.com` and set it to redirect to the apex domain (or vice versa)
  - Vercel should auto-verify since GoDaddy DNS already points to Vercel
- [ ] **Step 20** — Wait for SSL certificate to provision (usually under 1 minute)
- [ ] **Step 21** — Test `https://riding4gbs.com` loads the new site

### Phase 8: Clean up the old Vercel project

- [ ] **Step 22** — Go to Vercel Dashboard → find the old project (it should now have no domain)
- [ ] **Step 23** — Settings → General → scroll down → "Delete Project"

### Phase 9: Verify everything

- [ ] **Step 24** — `https://riding4gbs.com` loads the new Astro site ✓
- [ ] **Step 25** — `https://www.riding4gbs.com` redirects to (or loads) the site ✓
- [ ] **Step 26** — Vercel Dashboard shows one project: `riding4gbs-website` ✓
- [ ] **Step 27** — GitHub shows `riding4gbs-website` (active) and `riding4gbs-v1` (archived) ✓
- [ ] **Step 28** — Local folder is `~/Projects/riding4gbs-website` with correct git remote ✓
- [ ] **Step 29** — `git push` from local goes to the correct repo ✓

---

## GoDaddy DNS — no changes needed

Your GoDaddy DNS records (likely an A record → `76.76.21.21` or CNAME → `cname.vercel-dns.com`) point to Vercel's infrastructure. Vercel routes traffic to the correct project based on domain assignment, not DNS. Since you're staying on Vercel, **do not touch GoDaddy**.

## Rollback plan

If something goes wrong:
1. Remove the domain from the new Vercel project
2. Add it back to the old Vercel project (un-delete or redeploy if needed)
3. The old GitHub repo is archived but not deleted — you can unarchive it

---

*Created: 2026-03-26*
*Delete this file after migration is complete.*

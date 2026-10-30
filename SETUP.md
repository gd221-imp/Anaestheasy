# Setup checklist (for David)

Do these once, in order.

## Before inviting anyone

- [ ] **Buy GitHub Pro.** Profile picture → Settings → Billing and plans → Upgrade.
- [ ] **Protect `main`.** Repository → Settings → Branches → Add branch protection rule. Branch name `main`, then tick:
  - Require a pull request before merging → Require approvals: 1 → Require review from Code Owners
  - Require status checks to pass before merging → choose **check**
  - Do not allow bypassing the above settings (optional; leave unticked if you want to merge your own changes without a second reviewer)
- [ ] **Turn on the preview website.** Settings → Pages → Source: **GitHub Actions**. The next merge publishes it; the address appears on that page.
- [ ] **Stop editing the live app directly.** From now on, changes go through this repository (or ask Claude to make them here as a pull request), so nothing is overwritten.

## Inviting the team

- [ ] Collect each owner's GitHub username.
- [ ] Settings → Collaborators → Add people → each owner (they accept by email).
- [ ] Ask Claude to fill the owners into `.github/CODEOWNERS`, so each pull request goes to the right person as well as you.
- [ ] Send them the team brief and point them to CONTRIBUTING.md.

## Each release

- [ ] Ask Claude to build `main` and publish it to the live app.

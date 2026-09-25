# GitHub Actions CI/CD Setup Guide

This guide explains how to set up GitHub Actions for on-demand report generation.

## ✅ What's Been Completed

### Code Changes
1. **src/main.js** - Added CLI argument parser and CI/interactive mode detection
2. **src/releaseNotesGenerator.js** - Updated to accept options object for CI mode
3. **.github/workflows/metrics-report.yml** - New GitHub Actions workflow
4. **package.json** - Added convenient npm scripts

### Key Features
- ✅ **CI-friendly CLI** - Accepts `--type`, `--start`, `--end`, `--output`, `--board`, `--title`
- ✅ **Interactive mode preserved** - Run `node src/main.js` with no args for old behavior
- ✅ **Manual trigger only** - Workflow uses `workflow_dispatch` (no automatic runs)
- ✅ **Input validation** - Ensures date-range reports have start/end dates
- ✅ **Artifact upload** - Reports stored in GitHub with 90-day retention
- ✅ **Auto-commit** - Reports committed back to repo (optional, can be disabled)

---

## 📋 GitHub Secrets Required

Create these secrets in your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value | Where to Get |
|-------------|-------|-------------|
| `TRELLO_KEY` | Your Trello API Key | https://trello.com/app-key |
| `TRELLO_TOKEN` | Your Trello Token | https://trello.com/app-key (click "Token") |

**Steps:**
1. Go to https://trello.com/app-key
2. Copy your **API Key**
3. Click **"Token"** and copy the token
4. In GitHub repo: Settings → Secrets and variables → Actions
5. Create `TRELLO_KEY` with your API key
6. Create `TRELLO_TOKEN` with your token

---

## 🚀 Local Testing (Before Pushing)

Test the non-interactive CLI mode locally:

### Test Date-Range Report
```bash
# Requires both start and end dates
node src/main.js --type date-range --start 2024-01-01 --end 2024-12-31 --output reports/

# Or using npm script
npm run report:date-range -- --start 2024-01-01 --end 2024-12-31
```

### Test Release Report
```bash
node src/main.js --type release-ready --output reports/
# Or:
npm run report:release
```

### Test Pending Release
```bash
node src/main.js --type pending-release --output reports/
# Or:
npm run report:pending
```

### Test Bugs Report
```bash
node src/main.js --type bugs-by-product --output reports/
# Or:
npm run report:bugs
```

### Test DX Bugs Only
```bash
node src/main.js --type bugs-dx-only --output reports/
# Or:
npm run report:dx-bugs
```

### Test Version Report
```bash
node src/main.js --type release-version --output reports/
# Or:
npm run report:version
```

### Test Version Breakdown
```bash
node src/main.js --type release-version-breakdown --output reports/
# Or:
npm run report:version-breakdown
```

### Interactive Mode (Still Works)
```bash
# Old behavior: no arguments = interactive prompts
node src/main.js
# Or:
npm run report
```

---

## 🤖 Using GitHub Actions (For Team)

### How to Run a Report

1. **Go to your repository** on GitHub
2. **Click "Actions"** tab
3. **Select "Generate Metrics Report"** workflow (left sidebar)
4. **Click "Run workflow"** button (blue)
5. **Select options:**
   - **report_type** (required) - Choose from dropdown
   - **start_date** (optional, YYYY-MM-DD) - Only for date-range reports
   - **end_date** (optional, YYYY-MM-DD) - Only for date-range reports
   - **board_name** (optional) - Leave blank for default
   - **report_title** (optional) - Leave blank for "Annual Report"
6. **Click "Run workflow"** button (green)
7. **Wait for completion** (~1-2 minutes)

### After Report Generates

#### Option A: Download from Artifacts
1. Workflow run completes (green checkmark)
2. Click the workflow run name
3. Scroll to "Artifacts" section
4. Download `metrics-report-<run-number>.zip`
5. Extract and open the HTML file in your browser

#### Option B: View Committed Report
1. Report is auto-committed to `reports/` folder
2. Go to **Code** tab
3. Navigate to `reports/` folder
4. Find the HTML file with today's date
5. Download or view it

---

## 📊 Example Usage Scenarios

### Scenario 1: Monthly Report (All Done Items)
```
Run workflow with:
- report_type: date-range
- start_date: 2024-12-01
- end_date: 2024-12-31
- Leave other fields blank
```

### Scenario 2: Release-Ready Items
```
Run workflow with:
- report_type: release-ready
- Leave all date fields blank
- Leave board_name and report_title blank
```

### Scenario 3: Custom Title for Presentation
```
Run workflow with:
- report_type: pending-release
- report_title: Q4 2024 Release Pipeline
- Leave date fields blank
```

---

## ⚠️ Important Notes

### Date-Range Reports Require Dates
If you select `date-range`, you **must** provide both `start_date` and `end_date`, or the workflow will fail with a clear error message.

### Reports Are Committed
By default, generated reports are automatically committed to the `reports/` folder in your repo. This means:
- They'll be in your git history
- They'll be visible in the repo on GitHub
- If you want to disable this, remove the "Commit report to repository" step from the workflow

### Output Folder
All reports are saved to `reports/` (not `output/report/`) when run via GitHub Actions.

### Report Artifacts Retention
Reports stored as artifacts are kept for 90 days, then automatically deleted.

---

## 🔧 Customizing the Workflow

### Disable Auto-Commit
Edit `.github/workflows/metrics-report.yml` and remove or comment out the "Commit report to repository" step.

### Change Output Folder
Edit the workflow file, find the "Generate metrics report" step, and change `--output "reports/"` to your preferred path.

### Add More Report Types
Edit the workflow file, find the `options:` section under `report_type:`, and add new options like:
```yaml
  - release-version
  - release-version-breakdown
```

---

## 📞 Troubleshooting

### "Error: Missing Trello API credentials"
- Check that `TRELLO_KEY` and `TRELLO_TOKEN` are set in GitHub Secrets
- Verify they're correct at https://trello.com/app-key

### "date-range reports require both start_date and end_date"
- If using `date-range`, fill in both `start_date` and `end_date` fields

### Workflow fails with API error
- Check Trello credentials are valid
- Verify board name is spelled correctly (default: "Hunter Luxor Migration")
- Check that Trello API is accessible

### No reports generated
- Check the workflow run logs for errors
- Verify date range has tickets in Trello
- Confirm Trello board exists and is accessible

---

## 📝 Summary of Available Commands

```bash
# Interactive mode (prompts for everything)
node src/main.js

# CI mode: Date range (requires dates)
node src/main.js --type date-range --start 2024-01-01 --end 2024-12-31 --output reports/

# CI mode: Release ready
node src/main.js --type release-ready --output reports/

# CI mode: Pending release
node src/main.js --type pending-release --output reports/

# CI mode: Bugs by product
node src/main.js --type bugs-by-product --output reports/

# CI mode: DX bugs only
node src/main.js --type bugs-dx-only --output reports/

# CI mode: Release version
node src/main.js --type release-version --output reports/

# CI mode: Version breakdown
node src/main.js --type release-version-breakdown --output reports/

# Using npm scripts
npm run report                        # Interactive
npm run report:date-range             # Date range
npm run report:release                # Release ready
npm run report:pending                # Pending release
npm run report:bugs                   # Bugs by product
npm run report:dx-bugs                # DX bugs only
npm run report:version                # Release version
npm run report:version-breakdown      # Version breakdown
```

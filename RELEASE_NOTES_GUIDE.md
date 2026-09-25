# Release Notes Generator Guide

**Generate professional release notes from your Trello Done column**

---

## Overview

Automatically generate beautiful Release Notes reports by reading completed tasks from your Trello board's "Done" column within a specified date range.

**Features:**
- 📋 Professional HTML report (matches your mockup)
- 🎨 Color-coded sections (Bug Fixes, Features, Improvements, etc.)
- 📊 Automatic categorization by labels
- 📅 Date range filtering
- ✨ Beautiful, shareable output
- 📱 Responsive design

---

## Quick Start

### Command
```bash
node src/main.js --release-notes
```

### Steps
1. Select your Trello board
2. Enter a custom report title
3. Select the report type you want:
   - **Date Range Report**: All tickets from Done column within a date range
   - **Release Report**: Tickets ready for release (with "Release Soon" tag in Ready to Release)
   - **Pending to Release Report**: Tickets pending release (without "Release Soon" tag in Ready to Release)
4. If using Date Range Report: Enter start and end dates (YYYY-MM-DD)
5. Get beautiful report HTML

---

## Example Output

The generated report includes:

**Header Section**
```
LUXOR APP
Release Notes
September 9, 2026 | 20 Updates
```

**Categorized Sections**
- 🔴 Bug Fixes (10)
- 🟢 New Features (10)
- 🟡 Improvements (5)
- 🟠 Currently In Testing (2)
- ⚪ Other (?)

**Items Listed**
```
✓ Bug Fixes (10)
  • Creating a second event instead of returning to the event list
  • Editing an event results in a new event being created
  • Application crashes when adding a third event
  ... and more
```

**Summary**
```
Release Summary
✓ 10 critical bug fixes
✓ 8 new features
✓ 2 items in testing
✓ 20 total updates
```

---

## How It Works

### Step 1: Select Board
```
Select a board:
  1. Luxor App
  2. Dashboard Project
  3. Mobile Features
```

### Step 2: Enter Report Title
```
Report title: Q3 Release Notes
```

### Step 3: Choose Report Type
```
Select report type:
  1. Date Range Report (Done column)
  2. Release Report (Ready to Release with Release Soon tag)
  3. Pending to Release Report (Ready to Release without Release Soon tag)
```

### Step 4: Date Range (if Date Range Report selected)
```
Start date (YYYY-MM-DD): 2026-08-01
End date (YYYY-MM-DD): 2026-08-31
```

### Step 5: Auto-Categorization
The system reads Trello labels and groups cards:
- **Bug Fixes**: Labels containing "bug" or "fix" (includes PRD- and numbered tickets like "89-" or "234 -")
- **New Features**: Labels containing "feature" or "new"
- **Improvements**: Labels containing "improve" or "enhancement"
- **Currently In Testing**: Labels containing "testing" or "test"
- **Other**: Cards without matching labels

### Step 6: Generate Report
```
output/report/report_q3_release_notes_Luxor_App_2026-09-16.html
```

---

## Report Types

### 📅 Date Range Report
**Source**: Done column  
**Use Case**: Track completed work within a specific time period  
**Perfect For**: Monthly summaries, sprint reviews, quarterly reports

```
What You'll See:
- All tickets completed and moved to Done column
- Filtered by your selected date range
- Categorized by type (Bug Fixes, Features, Improvements, etc.)
- Completion dates for each ticket
```

### 🚀 Release Report
**Source**: Ready to Release column with "Release Soon" tag  
**Use Case**: Tickets approved and ready to go to production  
**Perfect For**: Release planning, staging verification, go/no-go decisions

```
What You'll See:
- Only tickets marked with "Release Soon" tag
- Shows exactly what's ready for production
- Organized by category
- Helps teams coordinate release timing
```

### ⏳ Pending to Release Report
**Source**: Ready to Release column WITHOUT "Release Soon" tag  
**Use Case**: Identify blockers and work in progress before release  
**Perfect For**: Identifying dependencies, finding blocked tickets, prioritization

```
What You'll See:
- Tickets in Ready to Release but not yet approved
- Shows work that needs attention before release
- Helps identify blockers and dependencies
- Prioritize what needs to be cleared before release
```

### 🐛 Bugs Fixing Report
**Source**: Ready to Release column (bugs only)  
**Use Case**: Track bug fixes organized by product line  
**Perfect For**: Product-specific release notes, bug fix tracking by team

```
What You'll See:
- Only bug tickets from Ready to Release column
- Separated by product:
  • Luxor FX - Bugs with "PRD-[number] FX" prefix (with or without space before /)
  • Luxor DX - Bugs with "PRD-[number] DX" prefix (with or without space before /)
  • Other Bugs - Numbered bugs (e.g., 89-, 234-)
- Dates when bugs were moved to Ready to Release
- Perfect for product-specific release communication

Examples (all variations supported):
  • PRD-157 FX/[Both][High] Login Issue
  • PRD-158 FX /[Both][Medium] Settings Issue
  • PRD-147 DX/[Both][High] Zone List Not Displaying
  • PRD-147 DX / All Lights Button and turn on Scenes not sync
```

### 🔴 Luxor DX Bugs Report
**Source**: Ready to Release + Test in Progress + Ready to test columns (DX bugs only)  
**Use Case**: Focused report on all Luxor DX product bugs across all testing columns  
**Perfect For**: DX team communication, comprehensive DX bug tracking across full pipeline

```
What You'll See:
- Only bugs with "PRD-[number] DX" prefix
- Bugs from three columns:
  • Ready to Release (all bugs, clean list without pending tags)
  • Test in Progress (marked with blue badge)
  • Ready to test (marked with orange badge)
- Simple, clean total count
- Complete list of all DX bugs in development pipeline
- Dates when each bug was moved to its respective column
- Streamlined for product-specific releases

Badge System:
  - 🔵 "test in progress" (blue) = Bugs in Test in Progress column
  - 🟠 "ready to test" (orange) = Bugs in Ready to test column
  - No badge = Ready to Release bugs (all without status tags)

Example bugs included (all variations):
  • PRD-157 DX/[Both][High] Zone List Not Displaying (Ready to Release - no badge)
  • 🔵 test in progress PRD-147 DX / All Lights Button and turn on Scenes (Test in Progress)
  • 🟠 ready to test PRD-159 DX /[Android][Medium] Dashboard not loading (Ready to test)
```

## Date Range Guide

### Defaults (for Date Range Report)
- **Start**: 30 days ago
- **End**: Today

### Custom Examples
```
Sprint Release:
  Start: 2026-09-01
  End: 2026-09-15

Monthly Report:
  Start: 2026-08-01
  End: 2026-08-31

Weekly Update:
  Start: 2026-09-01
  End: 2026-09-07
```

---

## Customization

### Card Categorization

Cards are categorized by **Trello labels**:

**In Trello, add labels:**
- "Bug" or "Fix" → Bug Fixes section
- "Feature" or "New" → New Features section
- "Improve" or "Enhancement" → Improvements section
- "Testing" or "Test" → Currently In Testing section
- No label → Other section

### Report Styling

The HTML includes:
- Professional blue gradient header
- Color-coded sections (red, green, orange, yellow)
- Responsive mobile design
- Print-friendly layout
- Clean, modern typography

---

## Output Files

### Location
```
output/report/report_[CUSTOM_TITLE]_[BOARD_NAME]_[DATE].html
```

### Examples
```
output/report/report_monthly_release_notes_Luxor_App_2026-09-09.html
output/report/report_pending_release_Mobile_Features_2026-09-09.html
output/report/report_sprint_summary_Dashboard_2026-09-09.html
```

### File Naming
- `[CUSTOM_TITLE]` - Your custom report title (lowercase, spaces to underscores)
- `[BOARD_NAME]` - Trello board name (underscores instead of spaces)
- `[DATE]` - Generation date (YYYY-MM-DD)

### What's Included
✅ Custom report title in header  
✅ Board name  
✅ Trello card titles and descriptions  
✅ Card count per category  
✅ Date range or report type info  
✅ Summary statistics  
✅ Professional formatting  
✅ Responsive design for printing/PDF export  

---

## Use Cases

### 1. Monthly Release (Date Range Report)
```bash
node src/main.js --release-notes

Board: Your App
Title: August 2026 Release Notes
Report Type: Date Range Report
Start: 2026-08-01
End: 2026-08-31

→ Share monthly_release_notes_*.html with stakeholders
```

### 2. Sprint Summary (Date Range Report)
```bash
node src/main.js --release-notes

Board: Sprint Board
Title: Sprint 12 Summary
Report Type: Date Range Report
Start: 2026-09-01
End: 2026-09-15

→ Use in sprint review meeting
```

### 3. Release Planning (Release Report)
```bash
node src/main.js --release-notes

Board: Your App
Title: September Release - Ready for Production
Report Type: Release Report

→ Verify all tickets marked "Release Soon" are ready
```

### 4. Identify Blockers (Pending to Release Report)
```bash
node src/main.js --release-notes

Board: Your App
Title: Pending Release - Action Items
Report Type: Pending to Release Report

→ Find and address blockers before release
```

### 5. Bug Fix Report by Product (Bugs Fixing Report)
```bash
node src/main.js --release-notes

Board: Your App
Title: Bug Fixes - September Release
Report Type: Bugs Fixing Report

→ See bugs organized by product (FX, DX)
→ Perfect for product-specific communications
```

### 6. Weekly Update (Date Range Report)
```bash
node src/main.js --release-notes

Board: Your Project
Title: Weekly Update - Sept 9-15
Report Type: Date Range Report
Start: [Week start]
End: [Week end]

→ Send to team weekly
```

---

## Sharing the Report

### View Online
1. Open the HTML file in browser
2. Share the file directly
3. Print to PDF for sharing

### PDF Export (Print-Friendly)
```
In Browser:
  1. Open HTML report
  2. Press Ctrl+P (or Cmd+P on Mac)
  3. In Print Settings:
     - Disable "Headers and footers" checkbox
     - Set Margins to "Minimal"
  4. Click "Save as PDF"
  5. Share PDF file
```

**To Remove Headers/Footers:**
- **Chrome/Edge:** Uncheck "Headers and footers" in More settings
- **Firefox:** Uncheck "Print backgrounds" and "Print headers and footers"
- **Safari:** Uncheck "Print backgrounds"

### Email
```
1. Generate report
2. Open HTML in browser
3. Print to PDF (disable headers/footers)
4. Email PDF to stakeholders
```

---

## Troubleshooting

### Q: No "Done" column found
**A:** Make sure your Trello board has a list named "Done" (case-insensitive)

### Q: No cards found in date range
**A:** Check that cards were actually moved to Done in that date range

### Q: Release Report shows no cards
**A:** Verify tickets in "Ready to Release" column have the "Release Soon" tag

### Q: Pending to Release Report shows no cards
**A:** Verify tickets in "Ready to Release" column exist WITHOUT the "Release Soon" tag

### Q: Cards not categorized correctly
**A:** Verify cards have proper labels in Trello:
- "bug" or "fix" → Bug Fixes
- "feature" or "new" → New Features
- "improve" or "enhancement" → Improvements
- "testing" or "test" → Currently In Testing
- No label → Other

### Q: Empty sections showing
**A:** Only sections with cards are displayed; empty sections are hidden

### Q: Report title not appearing correctly
**A:** The title is displayed in the HTML header and can contain spaces and special characters

---

## Format Reference

### Card Titles
- Displayed as-is from Trello
- Supports special characters
- HTML-escaped for safety

### Date Format
- Input: YYYY-MM-DD
- Output: Month DD, YYYY (e.g., September 9, 2026)

### Card Count
- Shows count next to each section
- Total at top of report
- All card counts included in summary

---

## Advanced Features

### Multiple Boards
Generate reports for different boards:
```bash
# Run multiple times
node src/main.js --release-notes  # Board 1
node src/main.js --release-notes  # Board 2
node src/main.js --release-notes  # Board 3
```

### Archive Reports
```
output/
  ├── release_notes_App_2026-08-15.html
  ├── release_notes_App_2026-08-31.html
  └── release_notes_App_2026-09-09.html
```

### Version Control
```bash
# Commit reports to version control
git add output/release_notes_*.html
git commit -m "Release notes for Sept 2026"
```

---

## Command Reference

### Interactive Mode (Recommended)
```bash
# Interactive: Select board, title, report type, and dates
node src/main.js --release-notes
```

**Steps:**
1. Select a board
2. Enter custom report title
3. Choose report type (Date Range, Release, or Pending to Release)
4. Enter dates (if using Date Range Report)
5. Report generated!

### Quick Date Range Mode
```bash
# Generate Date Range Report with specific dates
node src/main.js --release-notes 2026-08-01 2026-08-31
```

**Prompts:**
- Board selection
- Report title (default: "Annual Report")
- Dates are provided via command line

### From Main Menu
```bash
node src/main.js
# Then choose: Release Notes option
```

### Show Help
```bash
node src/main.js --help
```

---

## Output Example

**File**: `output/release_notes_Luxor_App_2026-09-09.html`

```
LUXOR APP
Release Notes
September 9, 2026 | 20 Updates

┌─────────────────────┬────────────────────┐
│ 🔴 Bug Fixes (10)   │ 🟢 New Features(10)│
├─────────────────────┼────────────────────┤
│ • PRD-159: Creating │ • Themes / Remove  │
│   a second event    │   Deleted Groups   │
│ • PRD-150: Editing  │ • Ixzdc - Remove   │
│   creates new event │   ColorWheel       │
│ ... 8 more          │ ... 8 more         │
└─────────────────────┴────────────────────┘

Release Summary
✓ 10 critical bug fixes addressing stability
✓ 8 new features included in this release
✓ 2 additional features in testing
✓ 20 total updates in this release
```

---

## Summary

Use Report Generator to:
1. ✅ Choose from 3 powerful report types
2. ✅ Customize report title
3. ✅ Automatically pull from Trello (Done or Ready to Release columns)
4. ✅ Filter by date range (Date Range Report) or by Release Soon tag (Release/Pending Reports)
5. ✅ Categorize by labels (Bug Fixes, Features, Improvements, etc.)
6. ✅ Generate professional HTML report
7. ✅ Share with stakeholders and export to PDF

**Three Report Types:**
- 📅 **Date Range Report** - Track completed work within a time period
- 🚀 **Release Report** - Items ready for production
- ⏳ **Pending to Release** - Items needing attention before release

**Command:**
```bash
node src/main.js --release-notes
```

**Done!** 🎉

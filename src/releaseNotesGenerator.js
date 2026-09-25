import chalk from "chalk";
import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import dotenv from "dotenv";
import axios from "axios";
import { generateProfessionalReport } from "./professionalReportGenerator.js";

dotenv.config();

const TRELLO_API_KEY = process.env.TRELLO_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

/**
 * Fetch all boards
 */
async function getTrelloBoards() {
  try {
    if (!TRELLO_API_KEY || !TRELLO_TOKEN) {
      throw new Error("Missing Trello API credentials. Please check your .env file.");
    }

    const response = await axios.get(
      `https://api.trello.com/1/members/me/boards?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
    );

    // Handle both direct array and wrapped response
    let boards = response.data;

    // Check if we got HTML instead of JSON (auth error)
    if (typeof boards === 'string' && boards.includes('<!doctype')) {
      throw new Error("Authentication failed. Please verify your TRELLO_API_KEY and TRELLO_TOKEN in .env are valid.");
    }

    if (boards && boards.result && Array.isArray(boards.result)) {
      boards = boards.result;
    }

    if (!Array.isArray(boards)) {
      throw new Error("Boards response is not an array");
    }

    return boards;
  } catch (error) {
    throw new Error(`Error fetching boards: ${error.message}`);
  }
}

/**
 * Fetch all lists (columns) for a board
 */
async function getBoardLists(boardId) {
  try {
    const response = await axios.get(
      `https://api.trello.com/1/boards/${boardId}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
    );

    let lists = response.data;

    if (!Array.isArray(lists)) {
      console.error(chalk.gray(`Debug - Response type: ${typeof lists}`));
      if (typeof lists === 'object') {
        console.error(chalk.gray(`Debug - Response keys: ${Object.keys(lists)}`));
      }
      throw new Error("Lists response is not an array");
    }

    return lists;
  } catch (error) {
    console.error(chalk.red(`❌ Error fetching lists: ${error.message}`));
    throw error;
  }
}

/**
 * Fetch cards from a list
 */
async function getListCards(listId) {
  try {
    const response = await axios.get(
      `https://api.trello.com/1/lists/${listId}/cards?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&fields=id,name,desc,labels,dateLastActivity,idLabels,created&labelFields=all`
    );

    let cards = response.data;

    if (!Array.isArray(cards)) {
      throw new Error("Cards response is not an array");
    }

    return cards;
  } catch (error) {
    console.error(chalk.red(`❌ Error fetching cards: ${error.message}`));
    throw error;
  }
}

/**
 * Get the date when card was moved to a specific column
 */
async function getCardMovedToColumnDate(cardId, columnName) {
  try {
    const response = await axios.get(
      `https://api.trello.com/1/cards/${cardId}/actions?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&filter=updateCard&limit=100`
    );

    let actions = response.data;
    if (!Array.isArray(actions)) {
      return null;
    }

    // Find the action where card was moved to the specified column
    for (const action of actions) {
      if (action.type === "updateCard" && action.data.listAfter) {
        const listName = action.data.listAfter.name || "";
        if (listName.toLowerCase().includes(columnName.toLowerCase())) {
          return new Date(action.date);
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get the date when card was moved to Done column
 */
async function getCardMovedToDoneDate(cardId) {
  return getCardMovedToColumnDate(cardId, "done");
}

/**
 * Get the date when card was moved to Ready to Release column
 */
async function getCardMovedToReadyToReleaseDate(cardId) {
  return getCardMovedToColumnDate(cardId, "ready to release");
}

/**
 * Fetch card actions (comments/activity)
 */
async function getCardActions(cardId) {
  try {
    const response = await axios.get(
      `https://api.trello.com/1/cards/${cardId}/actions?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&limit=1`
    );

    let actions = response.data;
    if (!Array.isArray(actions)) {
      return [];
    }

    return actions;
  } catch (error) {
    return [];
  }
}

/**
 * Filter cards by date range (checks date moved to Done column)
 */
async function filterCardsByDateRange(cards, startDate, endDate) {
  const filtered = [];

  for (const card of cards) {
    try {
      // Get the date when card was moved to Done
      const movedToDoneDate = await getCardMovedToDoneDate(card.id);

      if (movedToDoneDate) {
        if (movedToDoneDate >= startDate && movedToDoneDate <= endDate) {
          card.movedToDoneDate = movedToDoneDate;
          filtered.push(card);
        }
      } else {
        // If can't find move date, fall back to dateLastActivity
        const cardDate = new Date(card.dateLastActivity);
        if (cardDate >= startDate && cardDate <= endDate) {
          card.movedToDoneDate = cardDate;
          filtered.push(card);
        }
      }
    } catch (error) {
      // If error fetching actions, fall back to dateLastActivity
      const cardDate = new Date(card.dateLastActivity);
      if (cardDate >= startDate && cardDate <= endDate) {
        card.movedToDoneDate = cardDate;
        filtered.push(card);
      }
    }
  }

  return filtered;
}

/**
 * Check if card is a bug ticket (PRD-, number-, or "number -")
 */
function isBugTicket(cardName) {
  return cardName.match(/^(PRD-|\d+\s*-)/i);
}

/**
 * Group cards by labels
 */
function groupCardsByLabels(cards, separatePRD = false) {
  const groups = {
    "Bug Fixes": [],
    "New Features": [],
    "Improvements": [],
    "Currently In Testing": [],
    "Other": []
  };

  // Add PRD section if requested (for Ready to Release)
  if (separatePRD) {
    groups["PRD - Priority Bugs"] = [];
  }

  cards.forEach(card => {
    let categorized = false;

    // Separate PRD/numbered bug tickets if requested
    if (separatePRD && card.name.match(/^PRD-/i)) {
      groups["PRD - Priority Bugs"].push(card);
      categorized = true;
    } else if (isBugTicket(card.name)) {
      // Classify as bug if title matches bug pattern
      groups["Bug Fixes"].push(card);
      categorized = true;
    } else if (card.name.match(/\b(Add|Implement)\b/i)) {
      // Classify as feature if title contains "Add" or "Implement"
      groups["New Features"].push(card);
      categorized = true;
    } else if (card.labels && card.labels.length > 0) {
      const labelNames = card.labels.map(l => l.name.toLowerCase());

      // Check if it's a bug (has bug label)
      if (labelNames.some(l => l.includes("bug") || l.includes("fix"))) {
        groups["Bug Fixes"].push(card);
        categorized = true;
      } else if (labelNames.some(l => l.includes("feature") || l.includes("new"))) {
        groups["New Features"].push(card);
        categorized = true;
      } else if (labelNames.some(l => l.includes("improve") || l.includes("enhancement"))) {
        groups["Improvements"].push(card);
        categorized = true;
      } else if (labelNames.some(l => l.includes("testing") || l.includes("test"))) {
        groups["Currently In Testing"].push(card);
        categorized = true;
      }
    }

    if (!categorized) {
      groups["Other"].push(card);
    }
  });

  return groups;
}

/**
 * Group bugs by product (FX, DX, Other)
 */
function groupBugsByProduct(bugCards) {
  return {
    "Luxor FX": bugCards.filter(card => card.name.match(/^PRD-\d+\s+FX\s*\//i)),
    "Luxor DX": bugCards.filter(card => card.name.match(/^PRD-\d+\s+DX\s*\//i)),
    "Other Bugs": bugCards.filter(card => !card.name.match(/^PRD-\d+\s+(FX|DX)\s*\//i))
  };
}

/**
 * Group DX bugs only (simple grouping)
 */
function groupDXBugsOnly(bugCards) {
  return {
    "Luxor DX Bugs": bugCards
  };
}

/**
 * Generate Professional HTML Report
 */
function generateReleaseNotesHTML(groupedDoneCards, groupedReadyCards, boardName, startDateStr, endDateStr) {
  const doneTotal = Object.values(groupedDoneCards).flat().length;
  const readyTotal = Object.values(groupedReadyCards).flat().length;
  const totalCards = doneTotal + readyTotal;

  // Calculate category counts
  const doneBugFixes = groupedDoneCards["Bug Fixes"]?.length || 0;
  const doneFeatures = groupedDoneCards["New Features"]?.length || 0;
  const doneImprovements = groupedDoneCards["Improvements"]?.length || 0;
  const doneOther = groupedDoneCards["Other"]?.length || 0;
  const donePRD = groupedDoneCards["PRD - Priority Bugs"]?.length || 0;

  const readyBugFixes = groupedReadyCards["Bug Fixes"]?.length || 0;
  const readyFeatures = groupedReadyCards["New Features"]?.length || 0;
  const readyImprovements = groupedReadyCards["Improvements"]?.length || 0;
  const readyOther = groupedReadyCards["Other"]?.length || 0;
  const readyPRD = groupedReadyCards["PRD - Priority Bugs"]?.length || 0;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Annual Report - ${boardName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: #f5f7fa;
            color: #333;
        }

        .header {
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            padding: 60px 40px;
            text-align: left;
        }

        .header h1 {
            font-size: 48px;
            font-weight: 700;
            margin-bottom: 8px;
        }

        .header .subtitle {
            font-size: 18px;
            opacity: 0.9;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
        }

        .sections {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 40px;
        }

        .sections-group {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }

        .section {
            background: white;
            border-radius: 8px;
            border-left: 4px solid #2a5298;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .section.bug-fixes {
            border-left-color: #e74c3c;
        }

        .section.features {
            border-left-color: #27ae60;
        }

        .section.improvements {
            border-left-color: #f39c12;
        }

        .section.testing {
            border-left-color: #f1c40f;
        }

        .section.other {
            border-left-color: #95a5a6;
        }

        .section-header {
            padding: 20px;
            border-bottom: 1px solid #ecf0f1;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            font-size: 16px;
        }

        .section-header.bug-fixes {
            background: #fadbd8;
            color: #c0392b;
        }

        .section-header.features {
            background: #d5f4e6;
            color: #229954;
        }

        .section-header.improvements {
            background: #fef5e7;
            color: #b8860b;
        }

        .section-header.testing {
            background: #fffef0;
            color: #d4a017;
        }

        .section-header.other {
            background: #ecf0f1;
            color: #7f8c8d;
        }

        .count {
            background: rgba(0,0,0,0.1);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 700;
        }

        .section-content {
            padding: 20px;
        }

        .item {
            display: flex;
            gap: 12px;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #ecf0f1;
        }

        .item:last-child {
            margin-bottom: 0;
            border-bottom: none;
        }

        .bullet {
            flex-shrink: 0;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            margin-top: 8px;
            background: #2a5298;
        }

        .item.bug-fixes .bullet {
            background: #e74c3c;
        }

        .item.features .bullet {
            background: #27ae60;
        }

        .item.improvements .bullet {
            background: #f39c12;
        }

        .item.testing .bullet {
            background: #f1c40f;
        }

        .item-text {
            flex: 1;
            font-size: 14px;
            line-height: 1.5;
            color: #555;
        }

        .summary {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-top: 40px;
            border-top: 4px solid #2a5298;
        }

        .summary h3 {
            font-size: 18px;
            margin-bottom: 20px;
            color: #1e3c72;
        }

        .summary-item {
            display: flex;
            gap: 12px;
            margin-bottom: 12px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
        }

        .summary-item:last-child {
            margin-bottom: 0;
        }

        .summary-bullet {
            color: #27ae60;
            font-weight: 700;
            flex-shrink: 0;
        }

        .empty-section {
            color: #95a5a6;
            font-style: italic;
            text-align: center;
            padding: 20px;
        }

        .breakdown-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .breakdown-card {
            background: white;
            border-radius: 8px;
            padding: 30px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border: 1px solid #ecf0f1;
        }

        .breakdown-card-number {
            font-size: 48px;
            font-weight: 700;
            color: #1e3c72;
            margin-bottom: 10px;
        }

        .breakdown-card-label {
            font-size: 14px;
            color: #7f8c8d;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        @media (max-width: 768px) {
            .sections {
                grid-template-columns: 1fr;
            }

            .header {
                padding: 40px 20px;
            }

            .header h1 {
                font-size: 32px;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div style="font-size: 14px; opacity: 0.8; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">
            ${boardName}
        </div>
        <h1>Annual Report</h1>
        <div class="subtitle">${startDateStr} to ${endDateStr} | ${totalCards} Tickets Completed</div>
    </div>

    <div class="container">
        <div class="sections">`;

  // Add sections
  const sectionMap = {
    "Bug Fixes": "bug-fixes",
    "New Features": "features",
    "Improvements": "improvements",
    "Currently In Testing": "testing",
    "Other": "other"
  };

  // Helper function to render grouped cards section
  const renderGroupedSection = (groupedCards, sectionTitle, isReadyToRelease = false) => {
    let sectionHtml = `
            <div style="margin-bottom: 60px;">
              <h2 style="font-size: 28px; color: #1e3c72; margin-bottom: 30px; padding-bottom: 10px; border-bottom: 3px solid #2a5298;">${sectionTitle}</h2>
              <div class="sections-group">`;

    for (const [categoryName, cards] of Object.entries(groupedCards)) {
      if (cards.length === 0) continue;

      const className = sectionMap[categoryName] || "other";

      sectionHtml += `
                <div class="section ${className}">
                    <div class="section-header ${className}">
                        <span>${categoryName}</span>
                        <span class="count">${cards.length}</span>
                    </div>
                    <div class="section-content">`;

      cards.forEach(card => {
        const movedDate = card.movedToDoneDate ? new Date(card.movedToDoneDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "N/A";

        // Check for "Release Soon" tag in Ready to Release section
        let badge = "";
        if (isReadyToRelease) {
          const hasReleaseSoonTag = card.labels && card.labels.some(l => l.name.toLowerCase().includes("release soon"));
          if (!hasReleaseSoonTag) {
            badge = ` <span style="background-color: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px; font-weight: 500;">pending to release</span>`;
          }
        }

        sectionHtml += `
                        <div class="item ${className}">
                            <div class="bullet"></div>
                            <div class="item-text">${escapeHtml(card.name)}${badge} <span style="color: #95a5a6; font-size: 13px;">${movedDate}</span></div>
                        </div>`;
      });

      sectionHtml += `
                    </div>
                </div>`;
    }

    sectionHtml += `
              </div>
            </div>`;
    return sectionHtml;
  };

  // Render Done section
  html += renderGroupedSection(groupedDoneCards, "✅ Done", false);

  // Render Ready to Release section if there are cards
  if (readyTotal > 0) {
    html += renderGroupedSection(groupedReadyCards, "🚀 Ready to Release", true);
  }

  html += `
        </div>
    </div>
</body>
</html>`;

  return html;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Extract version from card description (format: "Release X.X.X")
 */
function extractVersionFromDescription(description) {
  if (!description) return null;
  const match = description.match(/Release\s+([\d.]+)/i);
  return match ? match[1] : null;
}

/**
 * Compare semantic versions (returns -1 if a < b, 0 if a === b, 1 if a > b)
 */
function compareVersions(versionA, versionB) {
  const partsA = versionA.split('.').map(Number);
  const partsB = versionB.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const a = partsA[i] || 0;
    const b = partsB[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Group cards by version from all columns
 */
async function getCardsByVersion(boardLists) {
  const cardsByVersion = {};
  let unversioned = [];

  // Columns to search: Done, Ready to Release, Test in Progress, Ready to test
  const columnsToFetch = ['done', 'ready to release', 'test in progress', 'ready to test'];

  for (const columnName of columnsToFetch) {
    const list = boardLists.find(l => l.name.toLowerCase().includes(columnName));
    if (!list) continue;

    console.log(chalk.yellow(`Fetching cards from ${list.name}...`));
    const cards = await getListCards(list.id);

    for (const card of cards) {
      const version = extractVersionFromDescription(card.desc);
      card.columnName = list.name;
      card.columnId = list.id;

      if (version) {
        if (!cardsByVersion[version]) {
          cardsByVersion[version] = [];
        }
        cardsByVersion[version].push(card);
      } else {
        unversioned.push(card);
      }
    }
  }

  return { cardsByVersion, unversioned };
}

/**
 * Get version metadata (status, dates)
 */
function getVersionMetadata(cards) {
  const statuses = { "Done": 0, "Ready to Release": 0, "Test in Progress": 0, "Ready to test": 0 };
  let latestDoneDate = null;

  for (const card of cards) {
    const columnName = card.columnName;
    if (columnName.toLowerCase().includes("done")) {
      statuses["Done"]++;
      const cardDate = new Date(card.dateLastActivity);
      if (!latestDoneDate || cardDate > latestDoneDate) {
        latestDoneDate = cardDate;
      }
    } else if (columnName.toLowerCase().includes("ready to release")) {
      statuses["Ready to Release"]++;
    } else if (columnName.toLowerCase().includes("test in progress")) {
      statuses["Test in Progress"]++;
    } else if (columnName.toLowerCase().includes("ready to test")) {
      statuses["Ready to test"]++;
    }
  }

  return { statuses, latestDoneDate };
}

/**
 * Extract severity from ticket name
 */
function extractSeverity(ticketName) {
  const severityMap = { "Critical": 4, "High": 3, "Medium": 2, "Low": 1 };
  for (const [severity, score] of Object.entries(severityMap)) {
    if (ticketName.match(new RegExp(`\\[${severity}\\]`, 'i'))) {
      return score;
    }
  }
  return 0; // No severity specified
}

/**
 * Sort bug fixes by severity (Critical > High > Medium > Low)
 */
function sortBugsBySeverity(bugs) {
  return bugs.sort((a, b) => extractSeverity(b.name) - extractSeverity(a.name));
}

/**
 * Generate Release Version Report HTML
 */
function generateReleaseVersionReportHTML(version, cards, boardName, previousVersion) {
  const metadata = getVersionMetadata(cards);
  const grouped = groupCardsByLabels(cards, false);

  // Calculate counts
  const totalCards = cards.length;
  const bugCount = grouped["Bug Fixes"]?.length || 0;
  const featCount = grouped["New Features"]?.length || 0;
  const impCount = grouped["Improvements"]?.length || 0;
  const otherCount = grouped["Other"]?.length || 0;
  const testCount = metadata.statuses["Test in Progress"] || 0;

  const readyToReleaseCount = metadata.statuses["Ready to Release"] || 0;
  const readinessPercent = totalCards > 0 ? Math.round((readyToReleaseCount / totalCards) * 100) : 0;

  // Status
  const isReleased = metadata.statuses["Done"] === totalCards;
  const statusLabel = isReleased ? "Released" : "In progress";
  const pillClass = isReleased ? "released" : "prog";
  const releaseDate = metadata.latestDoneDate ? new Date(metadata.latestDoneDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : null;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Release Version Report - ${version}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; }
        .header { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 60px 40px; text-align: center; }
        .header h1 { font-size: 48px; font-weight: 700; margin-bottom: 8px; }
        .header p { font-size: 18px; opacity: 0.9; }
        .pill { display: inline-block; margin-top: 14px; padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
        .pill.prog { background: #fef3c7; color: #92400e; }
        .pill.released { background: #dcfce7; color: #166534; }
        .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
        .section { background: white; border-radius: 8px; margin-bottom: 30px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .section h2 { font-size: 22px; font-weight: 700; padding: 20px; border-bottom: 1px solid #ecf0f1; color: #1e3c72; }
        .section-content { padding: 20px; }
        .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
        .stat { text-align: center; padding: 20px; background: #f9fafb; border-radius: 8px; }
        .stat-value { font-size: 32px; font-weight: 700; color: #1e3c72; margin-bottom: 8px; }
        .stat-label { font-size: 12px; color: #6b7280; font-weight: 600; }
        .readiness { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; align-items: center; padding: 20px; }
        .readiness-percent { font-size: 56px; font-weight: 700; color: #1e3c72; }
        .readiness-bar { width: 100%; height: 22px; background: #f1f5f9; border-radius: 6px; overflow: hidden; }
        .readiness-bar span { display: block; height: 100%; }
        .bar-ready { background: #22c55e; }
        .bar-pending { background: #f59e0b; }
        .bar-test { background: #3b82f6; }
        .legend { display: flex; gap: 20px; margin-top: 12px; font-size: 13px; color: #374151; }
        .legend-item { display: flex; gap: 8px; align-items: center; }
        .legend-color { width: 10px; height: 10px; border-radius: 2px; }
        .items { display: grid; gap: 8px; }
        .item { display: flex; gap: 12px; align-items: flex-start; padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; }
        .item-number { font-weight: 700; color: #9ca3af; min-width: 24px; flex-shrink: 0; }
        .item-text { flex: 1; color: #374151; }
        .badge { font-size: 11px; font-weight: 700; border-radius: 4px; padding: 2px 7px; white-space: nowrap; }
        .badge-pending { background: #fef3c7; color: #92400e; }
        .badge-ready { background: #dcfce7; color: #166534; }
        .badge-test { background: #dbeafe; color: #1e40af; }
        .summary { background: linear-gradient(135deg, #f0f9ff 0%, #f0fdf4 100%); border-left: 4px solid #1e3c72; border-radius: 8px; padding: 28px; margin-top: 30px; }
        .summary h3 { font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #1e3c72; }
        .summary p { font-size: 14px; color: #374151; line-height: 1.8; }
        .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
        .item.hidden { display: none; }
        .expand-btn { display: block; padding: 12px; color: #2a5298; font-weight: 600; font-size: 13px; background: none; border: none; cursor: pointer; text-align: center; width: 100%; margin-top: 8px; }
        .expand-btn:hover { color: #1e3a8a; text-decoration: underline; }
    </style>
    <script>
        function toggleExpand(id) {
            const items = document.querySelectorAll('[data-group="' + id + '"]');
            const btn = document.getElementById('btn-' + id);
            let hasHidden = false;
            items.forEach(item => {
                if (item.classList.contains('hidden')) {
                    item.classList.remove('hidden');
                    hasHidden = true;
                }
            });
            if (hasHidden) {
                btn.textContent = '▼ Collapse';
            } else {
                items.forEach((item, idx) => {
                    if (idx >= 5) {
                        item.classList.add('hidden');
                    }
                });
                const extra = items.length - 5;
                btn.textContent = extra > 0 ? '▶ Expand (' + extra + ' more)' : '';
                if (extra === 0) btn.style.display = 'none';
            }
        }
    </script>
</head>
<body>
    <div class="header">
        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Release Version Report</div>
        <h1>v${version}</h1>
        <p>${boardName}</p>
        <span class="pill ${pillClass}">${statusLabel}${releaseDate ? `, ${releaseDate}` : ''}</span>
        <div style="font-size: 12px; opacity: 0.8; margin-top: 10px;">${new Date().toLocaleDateString('en-US')}</div>
    </div>

    <div class="container">
        <div class="section">
            <h2>Executive Summary</h2>
            <div class="section-content">
                <div class="stats">
                    <div class="stat">
                        <div class="stat-value">${totalCards}</div>
                        <div class="stat-label">Total Items</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" style="color: #dc2626;">${bugCount}</div>
                        <div class="stat-label">Bugs Fixed</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" style="color: #16a34a;">${featCount}</div>
                        <div class="stat-label">Features Added</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" style="color: #d97706;">${impCount}</div>
                        <div class="stat-label">Improvements</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" style="color: #7c3aed;">${otherCount}</div>
                        <div class="stat-label">Other</div>
                    </div>
                </div>
            </div>
        </div>

        ${!isReleased ? `<div class="section">
            <h2>Release Readiness</h2>
            <div class="section-content">
                <div class="readiness">
                    <div>
                        <div class="readiness-percent">${readinessPercent}%</div>
                        <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">${readyToReleaseCount} of ${totalCards} tickets are in Ready to Release</div>
                    </div>
                    <div>
                        <div class="readiness-bar">
                            <span class="bar-ready" style="width: ${readinessPercent}%"></span>
                            <span class="bar-pending" style="width: ${Math.round((metadata.statuses["Ready to Release"] || 0) / totalCards * 100) * 0.5}%"></span>
                            <span class="bar-test" style="width: ${Math.round(testCount / totalCards * 100)}%"></span>
                        </div>
                        <div class="legend">
                            <div class="legend-item">
                                <div class="legend-color bar-ready"></div>
                                <span>Ready to Release ${readyToReleaseCount}</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color bar-pending"></div>
                                <span>Pending ${metadata.statuses["Ready to Release"] || 0}</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color bar-test"></div>
                                <span>Testing ${testCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>` : ''}

        <div class="section">
            <h2>Bug Fixes (${bugCount})</h2>
            <div class="section-content">
                ${bugCount > 0 ? `<div class="items">
                    ${sortBugsBySeverity(grouped["Bug Fixes"] || []).map((card, i) => `
                        <div class="item ${i >= 5 ? 'hidden' : ''}" data-group="bugs">
                            <span class="item-number">${i + 1}</span>
                            <span class="item-text">${escapeHtml(card.name)}</span>
                            ${!isReleased ? `<span class="badge ${getStatusBadgeClass(card.columnName)}">${getStatusLabel(card.columnName)}</span>` : ''}
                        </div>
                    `).join('')}
                    ${bugCount > 5 ? `<button class="expand-btn" id="btn-bugs" onclick="toggleExpand('bugs')">▶ Expand (${bugCount - 5} more)</button>` : ''}
                </div>` : '<div style="color: #9ca3af; font-style: italic;">No bug fixes</div>'}
            </div>
        </div>

        <div class="section">
            <h2>New Features (${featCount})</h2>
            <div class="section-content">
                ${featCount > 0 ? `<div class="items">
                    ${(grouped["New Features"] || []).map((card, i) => `
                        <div class="item ${i >= 5 ? 'hidden' : ''}" data-group="features">
                            <span class="item-number">${i + 1}</span>
                            <span class="item-text">${escapeHtml(card.name)}</span>
                            ${!isReleased ? `<span class="badge ${getStatusBadgeClass(card.columnName)}">${getStatusLabel(card.columnName)}</span>` : ''}
                        </div>
                    `).join('')}
                    ${featCount > 5 ? `<button class="expand-btn" id="btn-features" onclick="toggleExpand('features')">▶ Expand (${featCount - 5} more)</button>` : ''}
                </div>` : '<div style="color: #9ca3af; font-style: italic;">No features</div>'}
            </div>
        </div>

        <div class="section">
            <h2>Improvements (${impCount})</h2>
            <div class="section-content">
                ${impCount > 0 ? `<div class="items">
                    ${(grouped["Improvements"] || []).map((card, i) => `
                        <div class="item ${i >= 5 ? 'hidden' : ''}" data-group="improvements">
                            <span class="item-number">${i + 1}</span>
                            <span class="item-text">${escapeHtml(card.name)}</span>
                            ${!isReleased ? `<span class="badge ${getStatusBadgeClass(card.columnName)}">${getStatusLabel(card.columnName)}</span>` : ''}
                        </div>
                    `).join('')}
                    ${impCount > 5 ? `<button class="expand-btn" id="btn-improvements" onclick="toggleExpand('improvements')">▶ Expand (${impCount - 5} more)</button>` : ''}
                </div>` : '<div style="color: #9ca3af; font-style: italic;">No improvements</div>'}
            </div>
        </div>

        <div class="section">
            <h2>Other (${otherCount})</h2>
            <div class="section-content">
                ${otherCount > 0 ? `<div class="items">
                    ${(grouped["Other"] || []).map((card, i) => `
                        <div class="item ${i >= 5 ? 'hidden' : ''}" data-group="other">
                            <span class="item-number">${i + 1}</span>
                            <span class="item-text">${escapeHtml(card.name)}</span>
                            ${!isReleased ? `<span class="badge ${getStatusBadgeClass(card.columnName)}">${getStatusLabel(card.columnName)}</span>` : ''}
                        </div>
                    `).join('')}
                    ${otherCount > 5 ? `<button class="expand-btn" id="btn-other" onclick="toggleExpand('other')">▶ Expand (${otherCount - 5} more)</button>` : ''}
                </div>` : '<div style="color: #9ca3af; font-style: italic;">No other items</div>'}
            </div>
        </div>

        <div class="summary">
            <h3>Summary</h3>
            <p>v${version} contains ${totalCards} tickets: ${bugCount} bug fixes, ${featCount} features, ${impCount} improvements and ${otherCount} other items. ${readyToReleaseCount} are in Ready to Release and ${metadata.statuses["Done"] || 0} are in Done.</p>
        </div>
    </div>

    <div class="footer">
        ${boardName} · Release Version Report · v${version}
    </div>
</body>
</html>`;

  return html;
}

/**
 * Generate Release Version Breakdown HTML
 */
function generateReleaseVersionBreakdownHTML(versionGroups, boardName, unversionedCount) {
  const versions = Object.keys(versionGroups).sort((a, b) => compareVersions(b, a));
  const totalTickets = Object.values(versionGroups).reduce((sum, cards) => sum + cards.length, 0);

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Release Version Breakdown</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; }
        .header { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 60px 40px; text-align: center; }
        .header h1 { font-size: 48px; font-weight: 700; margin-bottom: 8px; }
        .header p { font-size: 18px; opacity: 0.9; }
        .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
        .section { background: white; border-radius: 8px; margin-bottom: 30px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .section h2 { font-size: 22px; font-weight: 700; padding: 20px; border-bottom: 1px solid #ecf0f1; color: #1e3c72; }
        .section-content { padding: 20px; }
        .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
        .stat { text-align: center; padding: 20px; background: #f9fafb; border-radius: 8px; }
        .stat-value { font-size: 32px; font-weight: 700; color: #1e3c72; margin-bottom: 8px; }
        .stat-label { font-size: 12px; color: #6b7280; font-weight: 600; }
        .version-row { display: grid; grid-template-columns: 120px 1fr 60px; gap: 14px; align-items: center; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
        .version-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .version-label { font-weight: 700; color: #0f172a; }
        .version-bar { display: flex; height: 26px; border-radius: 5px; overflow: hidden; background: #f1f5f9; }
        .version-bar span { height: 100%; display: block; }
        .bar-bug { background: #ef4444; }
        .bar-feat { background: #22c55e; }
        .bar-imp { background: #f59e0b; }
        .bar-other { background: #8b5cf6; }
        .version-count { font-weight: 700; font-size: 15px; text-align: right; color: #0f172a; }
        .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .table th { background: #f9fafb; padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
        .table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
        .table tr:hover { background: #f9fafb; }
        .summary { background: linear-gradient(135deg, #f0f9ff 0%, #f0fdf4 100%); border-left: 4px solid #1e3c72; border-radius: 8px; padding: 28px; margin-top: 30px; }
        .summary h3 { font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #1e3c72; }
        .summary p { font-size: 14px; color: #374151; line-height: 1.8; }
        .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="header">
        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Release Version Breakdown</div>
        <h1>${versions[versions.length - 1]} to ${versions.slice(0, 1)[0]}</h1>
        <p>${boardName}</p>
        <div style="font-size: 12px; opacity: 0.8; margin-top: 10px;">${new Date().toLocaleDateString('en-US')}</div>
    </div>

    <div class="container">
        <div class="section">
            <h2>Executive Summary</h2>
            <div class="section-content">
                <div class="stats">
                    <div class="stat">
                        <div class="stat-value">${versions.length}</div>
                        <div class="stat-label">Versions</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${totalTickets}</div>
                        <div class="stat-label">Tickets with Version</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${Math.round(totalTickets / versions.length)}</div>
                        <div class="stat-label">Avg per Version</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${Math.max(...Object.values(versionGroups).map(c => c.length))}</div>
                        <div class="stat-label">Largest</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${unversionedCount}</div>
                        <div class="stat-label">No Version</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Tickets per Version</h2>
            <div class="section-content">
                ${versions.map(version => {
                  const cards = versionGroups[version];
                  const grouped = groupCardsByLabels(cards, false);
                  const bugCount = grouped["Bug Fixes"]?.length || 0;
                  const featCount = grouped["New Features"]?.length || 0;
                  const impCount = grouped["Improvements"]?.length || 0;
                  const otherCount = grouped["Other"]?.length || 0;
                  const total = cards.length;

                  const bugPercent = (bugCount / total) * 100;
                  const featPercent = (featCount / total) * 100;
                  const impPercent = (impCount / total) * 100;
                  const otherPercent = (otherCount / total) * 100;

                  return `
                    <div class="version-row">
                        <div class="version-label">v${version}</div>
                        <div class="version-bar">
                            <span class="bar-bug" style="width: ${bugPercent}%"></span>
                            <span class="bar-feat" style="width: ${featPercent}%"></span>
                            <span class="bar-imp" style="width: ${impPercent}%"></span>
                            <span class="bar-other" style="width: ${otherPercent}%"></span>
                        </div>
                        <div class="version-count">${total}</div>
                    </div>
                  `;
                }).join('')}
            </div>
        </div>

        <div class="summary">
            <h3>Summary</h3>
            <p>${totalTickets} tickets are spread across ${versions.length} versions, ${Math.round(totalTickets / versions.length)} per version on average. ${unversionedCount} tickets have no version and are not counted.</p>
        </div>
    </div>

    <div class="footer">
        ${boardName} · Release Version Breakdown · ${versions.length} versions
    </div>
</body>
</html>`;

  return html;
}

/**
 * Helper to get badge class based on column name
 */
function getStatusBadgeClass(columnName) {
  if (columnName.toLowerCase().includes("ready to release")) return "badge-ready";
  if (columnName.toLowerCase().includes("test")) return "badge-test";
  return "badge-pending";
}

/**
 * Helper to get status label
 */
function getStatusLabel(columnName) {
  if (columnName.toLowerCase().includes("ready to release")) return "ready";
  if (columnName.toLowerCase().includes("test")) return "testing";
  return "pending";
}

/**
 * Main function
 * @param {Object} options - Optional configuration object for CI mode
 *   - type: report type (required in CI mode)
 *   - board: board name (optional, defaults to "Hunter Luxor Migration")
 *   - startDate: start date in YYYY-MM-DD format
 *   - endDate: end date in YYYY-MM-DD format
 *   - outputDir: output directory (optional, defaults to "reports/")
 *   - title: report title (optional, defaults to "Annual Report")
 */
async function generateReleaseNotes(options) {
  // Determine if running in CI mode
  const isCIMode = !!options;

  try {

    if (!isCIMode) {
      console.log(chalk.cyan("\n📋 RELEASE NOTES GENERATOR\n"));
    }

    let startDateStr, endDateStr;
    let reportType;
    let selectedBoard;
    let reportTitle;
    let outputDir = isCIMode ? "reports" : "output/report";

    // In CI mode, validate credentials immediately
    if (isCIMode) {
      if (!TRELLO_API_KEY || !TRELLO_TOKEN) {
        throw new Error("Missing Trello API credentials. Please check your .env file.");
      }

      if (!options.type) {
        throw new Error("Missing required argument: --type");
      }

      reportType = options.type;
      reportTitle = options.title || "Annual Report";
      outputDir = options.outputDir ? options.outputDir.replace(/\/$/, "") : "reports";
      startDateStr = options.startDate;
      endDateStr = options.endDate;

      // Log CI mode startup info
      console.log(`[CI] Report type: ${reportType}`);
      console.log(`[CI] Board: ${options.board}`);
      console.log(`[CI] Output: ${outputDir}`);
    }

    // Step 1: Get boards
    if (!isCIMode) {
      console.log(chalk.yellow("Fetching Trello boards..."));
    }
    let boards = await getTrelloBoards();

    // Filter out Node BT boards (matches "Node BT", "Node-BT", etc.)
    boards = boards.filter(b => !b.name.match(/Node\s*-?\s*BT/i));

    if (boards.length === 0) {
      throw new Error("No boards found");
    }

    // Step 2: Select board
    if (isCIMode) {
      // CI mode: find board by name
      const boardName = options.board || "Hunter Luxor Migration";
      selectedBoard = boards.find(b => b.name === boardName);
      if (!selectedBoard) {
        throw new Error(`Board not found: ${boardName}`);
      }
      if (!isCIMode) {
        console.log(chalk.green(`✅ Selected: ${selectedBoard.name}\n`));
      }
    } else {
      // Interactive mode: prompt user
      const result = await inquirer.prompt([
        {
          type: "select",
          name: "selectedBoard",
          message: "Select a board:",
          choices: boards.map(b => ({
            name: b.name,
            value: b
          }))
        }
      ]);
      selectedBoard = result.selectedBoard;
      console.log(chalk.green(`✅ Selected: ${selectedBoard.name}\n`));
    }

    // Step 2: Get report type
    if (!isCIMode) {
      const result = await inquirer.prompt([
        {
          type: "select",
          name: "reportType",
          message: "Select report type:",
          choices: [
            {
              name: "Date Range Report (Done column)",
              value: "date-range",
              description: "All tickets from Done column within date range"
            },
            {
              name: "Release Report (Ready to Release with Release Soon tag)",
              value: "release-ready",
              description: "Tickets in Ready to Release with Release Soon tag"
            },
            {
              name: "Pending to Release Report (Ready to Release without Release Soon tag)",
              value: "pending-release",
              description: "Tickets in Ready to Release without Release Soon tag"
            },
            {
              name: "Bugs Fixing Report (Bugs from Ready to Release by product)",
              value: "bugs-by-product",
              description: "Separate bugs by PRD prefix: FX (Luxor FX) and DX (Luxor DX)"
            },
            {
              name: "Luxor DX Bugs Report (Only DX prefix bugs)",
              value: "bugs-dx-only",
              description: "List of all bugs with PRD-DX prefix from Ready to Release"
            },
            {
              name: "Release Version Report (All tickets for one version)",
              value: "release-version",
              description: "All tickets for a specific release version"
            },
            {
              name: "Release Version Breakdown (Ticket count per version)",
              value: "release-version-breakdown",
              description: "Summary of all versions with ticket counts"
            }
          ]
        }
      ]);
      reportType = result.reportType;
      console.log(chalk.green(`✅ Report type: ${reportType}\n`));
    }

    // Step 3: Get custom report title (skip for version reports)
    if (!isCIMode && reportType !== "release-version" && reportType !== "release-version-breakdown") {
      const result = await inquirer.prompt([
        {
          type: "input",
          name: "title",
          message: "Report title:",
          default: "Annual Report"
        }
      ]);
      reportTitle = result.title;
      console.log(chalk.green(`✅ Report title: ${reportTitle}\n`));
    } else if (isCIMode && reportTitle === undefined) {
      reportTitle = options.title || "Annual Report";
    }

    if (!reportTitle) {
      reportTitle = "Annual Report";
    }

    // Step 4: Get lists and find "Done", "Ready to Release", "Test in Progress", and "Ready to test"
    console.log(chalk.yellow("Fetching lists..."));
    const lists = await getBoardLists(selectedBoard.id);
    const doneList = lists.find(l => l.name.toLowerCase().includes("done"));
    const readyToReleaseList = lists.find(l => l.name.toLowerCase().includes("ready to release"));
    const testInProgressList = lists.find(l => l.name.toLowerCase().includes("test in progress"));
    const readyToTestList = lists.find(l => l.name.toLowerCase().includes("ready to test"));

    if (!doneList) {
      throw new Error("No 'Done' column found");
    }

    console.log(chalk.green(`✅ Found: ${doneList.name}`));
    if (readyToReleaseList) {
      console.log(chalk.green(`✅ Found: ${readyToReleaseList.name}`));
    } else if (reportType !== "date-range" && reportType !== "release-version" && reportType !== "release-version-breakdown") {
      throw new Error("'Ready to Release' column not found. This report type requires it.");
    }
    if (testInProgressList && (reportType === "release-ready" || reportType === "release-version" || reportType === "release-version-breakdown")) {
      console.log(chalk.green(`✅ Found: ${testInProgressList.name}`));
    }
    console.log("");

    // Step 4: Get date range (only if not provided via command line and needed for date-range report)
    if (reportType === "date-range") {
      if (!startDateStr || !endDateStr) {
        if (isCIMode) {
          throw new Error("Missing required arguments for date-range report: --start YYYY-MM-DD and --end YYYY-MM-DD");
        }
        const result = await inquirer.prompt([
          {
            type: "input",
            name: "startDateStr",
            message: "Start date (YYYY-MM-DD):",
            default: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
          },
          {
            type: "input",
            name: "endDateStr",
            message: "End date (YYYY-MM-DD):",
            default: new Date().toISOString().split("T")[0]
          }
        ]);
        startDateStr = result.startDateStr;
        endDateStr = result.endDateStr;
      }
      if (!isCIMode) {
        console.log(chalk.green(`✅ Date range: ${startDateStr} to ${endDateStr}\n`));
      }
    } else {
      // For release/pending reports, use today's date for display
      startDateStr = new Date().toISOString().split("T")[0];
      endDateStr = new Date().toISOString().split("T")[0];
      if (!isCIMode) {
        console.log(chalk.green(`✅ Date range: ${startDateStr} to ${endDateStr}\n`));
      }
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    // Step 5: Fetch cards based on report type
    let filteredDoneCards = [];
    let filteredReadyCards = [];
    let filteredTestInProgressCards = [];

    if (reportType === "release-version" || reportType === "release-version-breakdown") {
      console.log(chalk.yellow("Fetching cards by version..."));
      const { cardsByVersion, unversioned } = await getCardsByVersion(lists);

      const versionList = Object.keys(cardsByVersion).sort((a, b) => compareVersions(b, a));

      if (reportType === "release-version") {
        // Select a specific version
        let selectedVersion;

        if (isCIMode && options.version) {
          // CI mode: use provided version
          selectedVersion = options.version;
          if (!versionList.includes(selectedVersion)) {
            throw new Error(`Version "${selectedVersion}" not found. Available versions: ${versionList.join(", ")}`);
          }
        } else if (isCIMode) {
          // CI mode without version specified
          throw new Error(`Release version report requires --version argument. Available versions: ${versionList.join(", ")}`);
        } else {
          // Interactive mode: prompt user
          const { selected } = await inquirer.prompt([
            {
              type: "select",
              name: "selected",
              message: "Select release version:",
              choices: versionList.map(v => ({
                name: `${v}   ${cardsByVersion[v].length} tickets`,
                value: v
              }))
            }
          ]);
          selectedVersion = selected;
          console.log(chalk.green(`✅ Selected version: ${selectedVersion}\n`));
        }

        // Generate single version report
        const versionCards = cardsByVersion[selectedVersion];
        const versionHtml = generateReleaseVersionReportHTML(selectedVersion, versionCards, selectedBoard.name, null);

        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `report_release_version_v${selectedVersion}_${selectedBoard.name.replace(/\s+/g, "_")}_${timestamp}.html`;
        const filepath = path.join(process.cwd(), outputDir, filename);

        if (!fs.existsSync(path.join(process.cwd(), outputDir))) {
          fs.mkdirSync(path.join(process.cwd(), outputDir), { recursive: true });
        }

        fs.writeFileSync(filepath, versionHtml);

        if (!isCIMode) {
          console.log(chalk.green(`\n✅ Report generated!\n`));
        }
        const relativeFilePath = path.join(outputDir, filename);
        console.log(`File: ${relativeFilePath}`);
        console.log(`Tickets: ${versionCards.length}`);
        return;
      } else {
        // Generate breakdown report for all versions
        const breakdownHtml = generateReleaseVersionBreakdownHTML(cardsByVersion, selectedBoard.name, unversioned.length);

        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `report_release_version_breakdown_${selectedBoard.name.replace(/\s+/g, "_")}_${timestamp}.html`;
        const filepath = path.join(process.cwd(), outputDir, filename);

        if (!fs.existsSync(path.join(process.cwd(), outputDir))) {
          fs.mkdirSync(path.join(process.cwd(), outputDir), { recursive: true });
        }

        fs.writeFileSync(filepath, breakdownHtml);

        if (!isCIMode) {
          console.log(chalk.green(`\n✅ Report generated!\n`));
        }
        const relativeFilePath = path.join(outputDir, filename);
        console.log(`File: ${relativeFilePath}`);
        console.log(`Versions: ${versionList.length}`);
        console.log(`Tickets: ${Object.values(cardsByVersion).reduce((sum, cards) => sum + cards.length, 0)}`);
        console.log(`Unversioned: ${unversioned.length}`);
        return;
      }
    } else if (reportType === "date-range") {
      console.log(chalk.yellow("Fetching cards from Done column..."));
      const doneCards = await getListCards(doneList.id);
      console.log(chalk.yellow("Checking when cards were completed..."));
      filteredDoneCards = await filterCardsByDateRange(doneCards, startDate, endDate);
      console.log(chalk.green(`✅ Found ${filteredDoneCards.length} cards in Done column\n`));
    } else if (reportType === "release-ready") {
      console.log(chalk.yellow("Fetching cards from Ready to Release column..."));
      const readyCards = await getListCards(readyToReleaseList.id);
      // Filter for cards WITH Release Soon tag
      const filteredReady = readyCards.filter(card => {
        const hasReleaseSoonTag = card.labels && card.labels.some(l => l.name.toLowerCase().includes("release soon"));
        return hasReleaseSoonTag;
      });

      // Fetch dates for Ready to Release cards
      console.log(chalk.yellow("Fetching move dates..."));
      for (const card of filteredReady) {
        const movedDate = await getCardMovedToReadyToReleaseDate(card.id);
        card.movedToDoneDate = movedDate; // Use this field for consistency
      }
      filteredReadyCards = filteredReady;
      console.log(chalk.green(`✅ Found ${filteredReadyCards.length} cards with Release Soon tag`));

      // Also check Test in Progress column for Release Soon tickets
      if (testInProgressList) {
        console.log(chalk.yellow("Fetching cards from Test in Progress column..."));
        const testCards = await getListCards(testInProgressList.id);
        // Filter for cards WITH Release Soon tag
        const filteredTest = testCards.filter(card => {
          const hasReleaseSoonTag = card.labels && card.labels.some(l => l.name.toLowerCase().includes("release soon"));
          return hasReleaseSoonTag;
        });

        // Fetch dates for Test in Progress cards
        for (const card of filteredTest) {
          const movedDate = await getCardMovedToColumnDate(card.id, "test in progress");
          card.movedToDoneDate = movedDate;
        }
        filteredTestInProgressCards = filteredTest;
        console.log(chalk.green(`✅ Found ${filteredTestInProgressCards.length} cards in Test in Progress with Release Soon tag\n`));
      } else {
        console.log("")
      }
    } else if (reportType === "pending-release") {
      console.log(chalk.yellow("Fetching cards from Ready to Release column..."));
      const readyCards = await getListCards(readyToReleaseList.id);
      // Filter for cards WITHOUT Release Soon tag
      const filteredReady = readyCards.filter(card => {
        const hasReleaseSoonTag = card.labels && card.labels.some(l => l.name.toLowerCase().includes("release soon"));
        return !hasReleaseSoonTag;
      });

      // Fetch dates for Ready to Release cards
      console.log(chalk.yellow("Fetching move dates..."));
      for (const card of filteredReady) {
        const movedDate = await getCardMovedToReadyToReleaseDate(card.id);
        card.movedToDoneDate = movedDate;
      }
      filteredReadyCards = filteredReady;
      console.log(chalk.green(`✅ Found ${filteredReadyCards.length} cards pending release\n`));
    } else if (reportType === "bugs-by-product") {
      console.log(chalk.yellow("Fetching cards from Ready to Release column..."));
      const readyCards = await getListCards(readyToReleaseList.id);
      // Filter for bug tickets only
      const bugCards = readyCards.filter(card => isBugTicket(card.name));

      // Fetch dates for bug cards
      console.log(chalk.yellow("Fetching move dates..."));
      for (const card of bugCards) {
        const movedDate = await getCardMovedToReadyToReleaseDate(card.id);
        card.movedToDoneDate = movedDate;
      }

      filteredReadyCards = bugCards;
      console.log(chalk.green(`✅ Found ${bugCards.length} bug tickets in Ready to Release\n`));
    } else if (reportType === "bugs-dx-only") {
      console.log(chalk.yellow("Fetching cards from Ready to Release column..."));
      const readyCards = await getListCards(readyToReleaseList.id);
      // Filter for DX bugs only (PRD-[number] DX / format, with optional space before /)
      const dxReadyCards = readyCards.filter(card => card.name.match(/^PRD-\d+\s+DX\s*\//i));

      // Fetch dates for Ready to Release DX bugs
      console.log(chalk.yellow("Fetching move dates..."));
      for (const card of dxReadyCards) {
        const movedDate = await getCardMovedToReadyToReleaseDate(card.id);
        card.movedToDoneDate = movedDate;
        card.source = "Ready to Release"; // Mark source column
      }

      // Also fetch from Test in Progress column if it exists
      let dxTestCards = [];
      if (testInProgressList) {
        console.log(chalk.yellow("Fetching cards from Test in Progress column..."));
        const testCards = await getListCards(testInProgressList.id);
        // Filter for DX bugs only
        dxTestCards = testCards.filter(card => card.name.match(/^PRD-\d+\s+DX\s*\//i));

        // Fetch dates for Test in Progress DX bugs
        for (const card of dxTestCards) {
          const movedDate = await getCardMovedToColumnDate(card.id, "test in progress");
          card.movedToDoneDate = movedDate;
          card.source = "Test in Progress"; // Mark source column
        }
      }

      // Also fetch from Ready to test column if it exists
      let dxReadyToTestCards = [];
      if (readyToTestList) {
        console.log(chalk.yellow("Fetching cards from Ready to test column..."));
        const readyToTestCards = await getListCards(readyToTestList.id);
        // Filter for DX bugs only
        dxReadyToTestCards = readyToTestCards.filter(card => card.name.match(/^PRD-\d+\s+DX\s*\//i));

        // Fetch dates for Ready to test DX bugs
        for (const card of dxReadyToTestCards) {
          const movedDate = await getCardMovedToColumnDate(card.id, "ready to test");
          card.movedToDoneDate = movedDate;
          card.source = "Ready to test"; // Mark source column
        }
      }

      // Combine all lists
      filteredReadyCards = [...dxReadyCards, ...dxTestCards, ...dxReadyToTestCards];
      console.log(chalk.green(`✅ Found ${dxReadyCards.length} DX bugs in Ready to Release`));
      console.log(chalk.green(`✅ Found ${dxTestCards.length} DX bugs in Test in Progress`));
      console.log(chalk.green(`✅ Found ${dxReadyToTestCards.length} DX bugs in Ready to test\n`));
    }

    const totalCards = filteredDoneCards.length + filteredReadyCards.length + filteredTestInProgressCards.length;
    if (totalCards === 0) {
      console.log(chalk.yellow("No cards found for this report"));
      process.exit(0);
    }

    // Step 6: Group by labels or product (depending on report type)
    let groupedDoneCards = {};
    let groupedReadyCards = {};
    let groupedTestInProgressCards = {};

    if (reportType === "bugs-by-product") {
      // Group bugs by product (FX, DX, Other)
      groupedReadyCards = groupBugsByProduct(filteredReadyCards);
    } else if (reportType === "bugs-dx-only") {
      // Group DX bugs only (simple single category)
      groupedReadyCards = groupDXBugsOnly(filteredReadyCards);
    } else {
      // Group by labels for other report types
      groupedDoneCards = groupCardsByLabels(filteredDoneCards, false);
      groupedReadyCards = groupCardsByLabels(filteredReadyCards, reportType === "release-ready" || reportType === "pending-release");
      groupedTestInProgressCards = filteredTestInProgressCards.length > 0
        ? groupCardsByLabels(filteredTestInProgressCards, false)
        : {};
    }

    // Step 7: Generate HTML
    console.log(chalk.yellow("Generating Report HTML..."));
    const html = generateProfessionalReport(groupedDoneCards, groupedReadyCards, groupedTestInProgressCards, reportTitle, selectedBoard.name, startDateStr, endDateStr, reportType);

    // Step 8: Save file
    const timestamp = new Date().toISOString().split("T")[0];
    const sanitizedTitle = reportTitle.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const filename = `report_${sanitizedTitle}_${selectedBoard.name.replace(/\s+/g, "_")}_${timestamp}.html`;
    const filepath = path.join(process.cwd(), outputDir, filename);

    if (!fs.existsSync(path.join(process.cwd(), outputDir))) {
      fs.mkdirSync(path.join(process.cwd(), outputDir), { recursive: true });
    }

    fs.writeFileSync(filepath, html);

    // Output summary
    const relativeFilePath = path.join(outputDir, filename);

    if (isCIMode) {
      // CI mode: structured output
      console.log(`[SUCCESS] Report generated`);
      console.log(`[OUTPUT] File=${relativeFilePath}`);
      console.log(`[OUTPUT] Type=${reportType}`);
      console.log(`[OUTPUT] Board=${selectedBoard.name}`);
      console.log(`[OUTPUT] Tickets=${totalCards}`);
      if (reportType === "date-range") {
        console.log(`[OUTPUT] Done=${filteredDoneCards.length}`);
      } else if (reportType === "release-ready") {
        console.log(`[OUTPUT] ReadyToRelease=${filteredReadyCards.length}`);
        console.log(`[OUTPUT] TestInProgress=${filteredTestInProgressCards.length}`);
      } else if (reportType === "pending-release") {
        console.log(`[OUTPUT] ReadyToReleasePending=${filteredReadyCards.length}`);
      } else if (reportType === "bugs-by-product") {
        const luxorFX = groupedReadyCards["Luxor FX"]?.length || 0;
        const luxorDX = groupedReadyCards["Luxor DX"]?.length || 0;
        const otherBugs = groupedReadyCards["Other Bugs"]?.length || 0;
        console.log(`[OUTPUT] LuxorFX=${luxorFX}`);
        console.log(`[OUTPUT] LuxorDX=${luxorDX}`);
        console.log(`[OUTPUT] OtherBugs=${otherBugs}`);
      } else if (reportType === "bugs-dx-only") {
        const readyCount = filteredReadyCards.filter(c => c.source === "Ready to Release").length;
        const testCount = filteredReadyCards.filter(c => c.source === "Test in Progress").length;
        const readyToTestCount = filteredReadyCards.filter(c => c.source === "Ready to test").length;
        console.log(`[OUTPUT] ReadyToRelease=${readyCount}`);
        console.log(`[OUTPUT] TestInProgress=${testCount}`);
        console.log(`[OUTPUT] ReadyToTest=${readyToTestCount}`);
      }
      console.log(`[OUTPUT] StartDate=${startDateStr}`);
      console.log(`[OUTPUT] EndDate=${endDateStr}`);
    } else {
      // Interactive mode: user-friendly output with colors
      console.log(chalk.green(`\n✅ Report generated!\n`));
      console.log(chalk.cyan(`📄 File: ${relativeFilePath}`));
      console.log(chalk.cyan(`📊 Tickets: ${totalCards}`));
      if (reportType === "date-range") {
        console.log(chalk.cyan(`   Done: ${filteredDoneCards.length}`));
      } else if (reportType === "release-ready") {
        console.log(chalk.cyan(`   Ready to Release: ${filteredReadyCards.length} | Test in Progress: ${filteredTestInProgressCards.length}`));
      } else if (reportType === "pending-release") {
        console.log(chalk.cyan(`   Ready to Release (Pending): ${filteredReadyCards.length}`));
      } else if (reportType === "bugs-by-product") {
        const luxorFX = groupedReadyCards["Luxor FX"]?.length || 0;
        const luxorDX = groupedReadyCards["Luxor DX"]?.length || 0;
        const otherBugs = groupedReadyCards["Other Bugs"]?.length || 0;
        console.log(chalk.cyan(`   Luxor FX: ${luxorFX} | Luxor DX: ${luxorDX} | Other: ${otherBugs}`));
      } else if (reportType === "bugs-dx-only") {
        const readyCount = filteredReadyCards.filter(c => c.source === "Ready to Release").length;
        const testCount = filteredReadyCards.filter(c => c.source === "Test in Progress").length;
        const readyToTestCount = filteredReadyCards.filter(c => c.source === "Ready to test").length;
        console.log(chalk.cyan(`   Ready to Release: ${readyCount} | Test in Progress: ${testCount} | Ready to test: ${readyToTestCount}`));
      }
      console.log(chalk.cyan(`📅 Period: ${startDateStr} to ${endDateStr}\n`));
    }

  } catch (error) {
    if (isCIMode) {
      console.error(`[ERROR] ${error.message}`);
    } else {
      console.error(chalk.red(`❌ Error: ${error.message}`));
    }
    process.exit(1);
  }
}

// Check if being run directly (remove auto-call to prevent duplicate execution when imported)

export { generateReleaseNotes };

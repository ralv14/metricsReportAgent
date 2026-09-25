import chalk from "chalk";
import fs from "fs";
import path from "path";

/**
 * Generate Professional Annual Report HTML
 */
function generateProfessionalReport(groupedDoneCards, groupedReadyCards, groupedTestInProgressCards, reportTitle, boardName, startDateStr, endDateStr, reportType = "date-range") {
  const doneTotal = Object.values(groupedDoneCards).flat().length;
  const readyTotal = Object.values(groupedReadyCards).flat().length;
  const testInProgressTotal = Object.values(groupedTestInProgressCards).flat().length;
  const completedTotal = doneTotal;

  // Calculate pending to release count (Ready items without Release Soon tag)
  const allReadyCards = Object.values(groupedReadyCards).flat();
  const pendingToReleaseCount = allReadyCards.filter(card => {
    const hasReleaseSoonTag = card.labels && card.labels.some(l => l.name.toLowerCase().includes("release soon"));
    return !hasReleaseSoonTag;
  }).length;

  // Calculate combined category counts (Done + Ready + Test in Progress) - merge PRD bugs into Bug Fixes
  const totalBugFixes = (groupedDoneCards["Bug Fixes"]?.length || 0) + (groupedDoneCards["PRD - Priority Bugs"]?.length || 0) + (groupedReadyCards["Bug Fixes"]?.length || 0) + (groupedReadyCards["PRD - Priority Bugs"]?.length || 0) + (groupedTestInProgressCards["Bug Fixes"]?.length || 0) + (groupedTestInProgressCards["PRD - Priority Bugs"]?.length || 0);
  const totalFeatures = (groupedDoneCards["New Features"]?.length || 0) + (groupedReadyCards["New Features"]?.length || 0) + (groupedTestInProgressCards["New Features"]?.length || 0);
  const totalImprovements = (groupedDoneCards["Improvements"]?.length || 0) + (groupedReadyCards["Improvements"]?.length || 0) + (groupedTestInProgressCards["Improvements"]?.length || 0);
  const totalOther = (groupedDoneCards["Other"]?.length || 0) + (groupedReadyCards["Other"]?.length || 0) + (groupedTestInProgressCards["Other"]?.length || 0);
  const totalAll = doneTotal + readyTotal + testInProgressTotal;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportTitle} - ${boardName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
            background: #ffffff;
            color: #1f2937;
        }

        .hero {
            background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
            color: white;
            padding: 80px 40px;
            text-align: center;
        }

        .hero h1 {
            font-size: 56px;
            font-weight: 700;
            margin-bottom: 16px;
            letter-spacing: -0.5px;
        }

        .hero p {
            font-size: 18px;
            color: #cbd5e1;
            margin-bottom: 8px;
        }

        .hero .date {
            font-size: 14px;
            color: #94a3b8;
            margin-top: 16px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0;
        }

        section {
            padding: 60px 40px;
            border-bottom: 1px solid #e5e7eb;
        }

        section:last-of-type {
            border-bottom: none;
        }

        section h2 {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 40px;
            color: #111827;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 20px;
            background: #f9fafb;
            border-radius: 12px;
            padding: 32px;
            border: 1px solid #e5e7eb;
            margin-bottom: 40px;
        }

        .stat {
            text-align: center;
        }

        .stat-value {
            font-size: 40px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 8px;
        }

        .stat-label {
            font-size: 13px;
            color: #6b7280;
            font-weight: 600;
        }

        .breakdown {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 32px;
            margin-bottom: 40px;
        }

        .breakdown-item {
            border-radius: 12px;
            padding: 32px;
            background: white;
            border: 1px solid #e5e7eb;
            border-left: 5px solid #e5e7eb;
        }

        .breakdown-item h3 {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 24px;
        }

        .breakdown-number {
            font-size: 48px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 8px;
        }

        .breakdown-item.bugs {
            border-left-color: #ef4444;
        }

        .breakdown-item.bugs .breakdown-number {
            color: #dc2626;
        }

        .breakdown-item.features {
            border-left-color: #22c55e;
        }

        .breakdown-item.features .breakdown-number {
            color: #16a34a;
        }

        .breakdown-item.improvements {
            border-left-color: #f59e0b;
        }

        .breakdown-item.improvements .breakdown-number {
            color: #d97706;
        }

        .breakdown-item.other {
            border-left-color: #8b5cf6;
        }

        .breakdown-item.other .breakdown-number {
            color: #7c3aed;
        }

        .breakdown-description {
            font-size: 14px;
            color: #6b7280;
            line-height: 1.6;
        }

        .items-list {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
        }

        .item {
            font-size: 13px;
            color: #374151;
            padding: 12px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            display: flex;
            gap: 12px;
            align-items: center;
        }

        .item-number {
            font-weight: 700;
            color: #9ca3af;
            flex-shrink: 0;
            min-width: 28px;
        }

        .item-text {
            flex: 1;
            min-width: 0;
        }

        .item-date {
            color: #9ca3af;
            font-size: 12px;
            flex-shrink: 0;
            white-space: nowrap;
        }

        .section-header {
            font-size: 18px;
            font-weight: 700;
            color: #111827;
            margin: 40px 0 20px 0;
            padding-bottom: 12px;
            border-bottom: 2px solid #e5e7eb;
        }

        .summary {
            background: linear-gradient(135deg, #f0f9ff 0%, #f0fdf4 100%);
            border-radius: 12px;
            padding: 40px;
            border-left: 4px solid #0f172a;
            margin: 40px 0;
        }

        .summary h3 {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 16px;
            color: #0f172a;
        }

        .summary p {
            font-size: 14px;
            color: #374151;
            line-height: 1.8;
            margin-bottom: 12px;
        }

        footer {
            background: #f9fafb;
            padding: 40px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
            font-size: 13px;
            color: #6b7280;
        }

        @media (max-width: 768px) {
            .hero h1 { font-size: 36px; }
            .stats-grid, .breakdown { grid-template-columns: 1fr; }
            section { padding: 40px 20px; }
        }

        @page {
            size: A4;
            margin: 0.5in 0.5in 0.5in 0.5in;
            @bottom-left { content: ""; }
            @bottom-center { content: ""; }
            @bottom-right { content: ""; }
            @top-left { content: ""; }
            @top-center { content: ""; }
            @top-right { content: ""; }
        }

        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }

            html {
                margin: 0;
                padding: 0;
            }

            body {
                margin: 0;
                padding: 0;
                background: white;
                font-size: 11pt;
                line-height: 1.4;
            }

            .hero {
                page-break-after: avoid;
                padding: 40px 20px;
            }

            .hero h1 {
                font-size: 28pt;
                margin-bottom: 8px;
            }

            .hero p {
                font-size: 14pt;
                margin-bottom: 4px;
            }

            .hero .date {
                font-size: 11pt;
                margin-top: 8px;
            }

            section {
                padding: 20px;
                border-bottom: 1px solid #ccc;
                page-break-inside: avoid;
            }

            section h2 {
                font-size: 18pt;
                margin-bottom: 16px;
                margin-top: 0;
                page-break-after: avoid;
            }

            .stats-grid {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 8px;
                background: #f0f0f0;
                padding: 16px;
                page-break-inside: avoid;
            }

            .stat {
                page-break-inside: avoid;
            }

            .stat-value {
                font-size: 24pt;
                margin-bottom: 4px;
            }

            .stat-label {
                font-size: 10pt;
            }

            .breakdown {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 16px;
                page-break-inside: avoid;
            }

            .breakdown-item {
                border-radius: 0;
                padding: 12px;
                page-break-inside: avoid;
                border: 1px solid #ccc;
            }

            .breakdown-item h3 {
                font-size: 14pt;
                margin-bottom: 8px;
            }

            .breakdown-number {
                font-size: 32pt;
                margin-bottom: 4px;
            }

            .breakdown-description {
                font-size: 10pt;
            }

            .section-header {
                font-size: 12pt;
                font-weight: 700;
                margin: 12px 0 8px 0;
                padding-bottom: 4px;
                border-bottom: 1px solid #ccc;
                page-break-after: avoid;
            }

            .items-list {
                page-break-inside: avoid;
            }

            .item {
                font-size: 10pt;
                padding: 6px;
                margin-bottom: 4px;
                border: none;
                background: white;
                page-break-inside: avoid;
            }

            .item-number {
                min-width: 20px;
                font-size: 9pt;
            }

            .item-text {
                font-size: 10pt;
            }

            .item-date {
                font-size: 9pt;
                white-space: nowrap;
            }

            .summary {
                background: #f0f0f0;
                border: 1px solid #ccc;
                page-break-inside: avoid;
            }

            .summary h3 {
                font-size: 14pt;
                margin-bottom: 8px;
            }

            .summary p {
                font-size: 11pt;
                margin-bottom: 6px;
            }

            footer {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="hero">
        <h1>${reportTitle}</h1>
        <p>${boardName}</p>
        <div class="date">${reportType === "date-range" ? `${startDateStr} — ${endDateStr}` : startDateStr}</div>
    </div>

    <div class="container">
        <!-- Executive Summary -->
        <section>
            <h2>Executive Summary</h2>
            <div class="stats-grid" style="${reportType === "bugs-dx-only" ? "grid-template-columns: 1fr;" : ""}">
                <div class="stat">
                    <div class="stat-value">${totalAll}</div>
                    <div class="stat-label">${reportType === "bugs-dx-only" ? "Total Luxor DX Bugs" : "Total Items"}</div>
                </div>
                ${reportType !== "bugs-dx-only" ? `
                <div class="stat">
                    <div class="stat-value">${totalBugFixes}</div>
                    <div class="stat-label">Bugs Fixed</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${totalFeatures}</div>
                    <div class="stat-label">Features Added</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${totalImprovements}</div>
                    <div class="stat-label">Improvements</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${totalOther}</div>
                    <div class="stat-label">Other</div>
                </div>
                ` : ""}
            </div>
        </section>

        <!-- Overview Section -->
        <section>
            <h2>Overview</h2>
            ${reportType === "bugs-dx-only" ? `
            <div class="breakdown" style="grid-template-columns: 1fr;">
                <div class="breakdown-item bugs">
                    <div class="breakdown-number">${totalAll}</div>
                    <h3>Luxor DX Bugs</h3>
                    <p class="breakdown-description">All bugs with PRD-DX prefix ready for release.</p>
                </div>
            </div>
            ` : `
            <div class="breakdown">
                <div class="breakdown-item bugs">
                    <div class="breakdown-number">${totalBugFixes}</div>
                    <h3>Bug Fixes</h3>
                    <p class="breakdown-description">Critical and high-severity issues resolved. Items tracked with PRD- identifiers or numbered tickets.</p>
                </div>

                <div class="breakdown-item features">
                    <div class="breakdown-number">${totalFeatures}</div>
                    <h3>Features</h3>
                    <p class="breakdown-description">New functionality and system additions.</p>
                </div>

                <div class="breakdown-item improvements">
                    <div class="breakdown-number">${totalImprovements}</div>
                    <h3>Improvements</h3>
                    <p class="breakdown-description">UI/UX updates and optimizations.</p>
                </div>

                <div class="breakdown-item other">
                    <div class="breakdown-number">${totalOther}</div>
                    <h3>Other</h3>
                    <p class="breakdown-description">Additional improvements and updates.</p>
                </div>
            </div>
            `}

            ${renderCombinedItems(groupedDoneCards, groupedReadyCards, groupedTestInProgressCards, reportType)}
        </section>

        <!-- Summary -->
        <section>
            <div class="summary">
                <h3>Summary</h3>
                ${reportType === "date-range" ? `<p><strong>Period:</strong> ${startDateStr} — ${endDateStr}</p>` : ''}
                <p><strong>Total Items:</strong> ${totalAll}</p>
                ${reportType !== "bugs-dx-only" ? `<p><strong>Completed (Done):</strong> ${completedTotal}</p>` : ''}
                ${reportType !== "bugs-dx-only" ? `<p><strong>Ready to Release:</strong> ${readyTotal} (${pendingToReleaseCount} pending)</p>` : ''}
                ${testInProgressTotal > 0 && reportType !== "bugs-dx-only" ? `<p><strong>Test in Progress:</strong> ${testInProgressTotal}</p>` : ''}
                ${reportType !== "bugs-dx-only" ? `<p><strong>Breakdown:</strong> ${totalBugFixes} bugs fixed | ${totalFeatures} features added | ${totalImprovements} improvements | ${totalOther} other items</p>` : ''}
                ${reportType !== "bugs-dx-only" ? `<p style="font-size: 12px; color: #6b7280; margin-top: 16px;">✅ Breakdown adds up to Total Items: ${totalBugFixes + totalFeatures + totalImprovements + totalOther} = ${totalAll}</p>` : ''}
            </div>
        </section>
    </div>
</body>
</html>`;

  return html;
}

/**
 * Render Combined Done, Ready to Release, and Test in Progress Items
 */
function renderCombinedItems(groupedDoneCards, groupedReadyCards, groupedTestInProgressCards, reportType = "date-range") {
  let html = "";

  // Merge PRD and Bug Fixes into single Bug Fixes category
  const mergedDoneCards = { ...groupedDoneCards };
  const mergedReadyCards = { ...groupedReadyCards };
  const mergedTestInProgressCards = { ...groupedTestInProgressCards };

  // Helper function to merge PRD and Bug Fixes
  const mergePRDIntoBugFixes = (groupedCards) => {
    if (groupedCards["PRD - Priority Bugs"]) {
      if (!groupedCards["Bug Fixes"]) {
        groupedCards["Bug Fixes"] = [];
      }
      groupedCards["Bug Fixes"] = [
        ...groupedCards["Bug Fixes"],
        ...groupedCards["PRD - Priority Bugs"]
      ];
      delete groupedCards["PRD - Priority Bugs"];
    }
  };

  // Combine Bug Fixes and PRD - Priority Bugs in all sections
  mergePRDIntoBugFixes(mergedDoneCards);
  mergePRDIntoBugFixes(mergedReadyCards);
  mergePRDIntoBugFixes(mergedTestInProgressCards);

  // Create a map of all categories (excluding PRD now)
  const allCategories = new Set([
    ...Object.keys(mergedDoneCards),
    ...Object.keys(mergedReadyCards),
    ...Object.keys(mergedTestInProgressCards)
  ]);

  for (const categoryName of allCategories) {
    const doneCards = mergedDoneCards[categoryName] || [];
    const readyCards = mergedReadyCards[categoryName] || [];
    const testCards = mergedTestInProgressCards[categoryName] || [];
    const totalCount = doneCards.length + readyCards.length + testCards.length;

    if (totalCount === 0) continue;

    html += `<div class="section-header">${categoryName} (${totalCount})</div>`;
    html += `<div class="items-list">`;

    let itemNumber = 1;

    // Helper function to get date string
    const getDateString = (card) => {
      if (card.movedToDoneDate) {
        return new Date(card.movedToDoneDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
      }
      // Fallback to dateLastActivity
      if (card.dateLastActivity) {
        return new Date(card.dateLastActivity).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
      }
      return "N/A";
    };

    // Add Done items first
    doneCards.forEach(card => {
      const movedDate = getDateString(card);

      html += `
            <div class="item">
                <span class="item-number">${itemNumber++}</span>
                <span class="item-text">${escapeHtml(card.name)}</span>
                <span class="item-date">${movedDate}</span>
            </div>`;
    });

    // Add Ready to Release items
    readyCards.forEach(card => {
      const movedDate = getDateString(card);

      // Determine badge based on source or Release Soon tag
      let badge = '';
      if (card.source === "Test in Progress") {
        badge = '<span style="background-color: #e8f4f8; color: #0369a1; padding: 2px 6px; border-radius: 6px; font-size: 10px; margin-right: 6px;">test in progress</span>';
      } else if (card.source === "Ready to test") {
        badge = '<span style="background-color: #fce4d6; color: #c65911; padding: 2px 6px; border-radius: 6px; font-size: 10px; margin-right: 6px;">ready to test</span>';
      } else if (reportType !== "bugs-dx-only") {
        // Only show pending badge for non-DX reports
        const hasReleaseSoonTag = card.labels && card.labels.some(l => l.name.toLowerCase().includes("release soon"));
        if (!hasReleaseSoonTag) {
          badge = '<span style="background-color: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 6px; font-size: 10px; margin-right: 6px;">pending</span>';
        }
      }

      html += `
            <div class="item">
                <span class="item-number">${itemNumber++}</span>
                <span class="item-text">${badge}${escapeHtml(card.name)}</span>
                <span class="item-date">${movedDate}</span>
            </div>`;
    });

    // Add Test in Progress items
    testCards.forEach(card => {
      const movedDate = getDateString(card);

      const badge = '<span style="background-color: #e8f4f8; color: #0369a1; padding: 2px 6px; border-radius: 6px; font-size: 10px; margin-right: 6px;">test in progress</span>';

      html += `
            <div class="item">
                <span class="item-number">${itemNumber++}</span>
                <span class="item-text">${badge}${escapeHtml(card.name)}</span>
                <span class="item-date">${movedDate}</span>
            </div>`;
    });

    html += `</div>`;
  }

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

export { generateProfessionalReport };

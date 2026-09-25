import { generateReleaseNotes } from "./releaseNotesGenerator.js";
import chalk from "chalk";

/**
 * Simple CLI argument parser
 */
function parseArgs(args) {
  const parsed = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].substring(2);
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        parsed[key] = args[i + 1];
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }

  return parsed;
}

async function main() {
  try {
    // Parse command-line arguments (skip node and script name)
    const cliArgs = process.argv.slice(2);
    const args = parseArgs(cliArgs);

    // Detect mode: CI mode if --type is provided, otherwise interactive mode
    const isCI = !!args.type;

    if (isCI) {
      // CI mode: require type argument
      const options = {
        type: args.type,
        board: args.board || "Hunter Luxor Migration",
        startDate: args.start,
        endDate: args.end,
        outputDir: args.output || "reports/",
        title: args.title || "Annual Report",
        version: args.version
      };

      await generateReleaseNotes(options);
    } else {
      // Interactive mode: no options provided
      await generateReleaseNotes();
    }
  } catch (error) {
    console.error(chalk.red(`❌ Error: ${error.message}`));
    process.exit(1);
  }
}

main();

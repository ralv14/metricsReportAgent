import { generateReleaseNotes } from "./releaseNotesGenerator.js";
import chalk from "chalk";

async function main() {
  try {
    await generateReleaseNotes();
  } catch (error) {
    console.error(chalk.red(`❌ Error: ${error.message}`));
    process.exit(1);
  }
}

main();

# Metrics Report Agent

A powerful Node.js CLI tool for generating comprehensive release notes and metrics reports from Trello boards.

## Features

### Report Types

1. **Date Range Report** - All tickets from Done column within a specified date range
2. **Release Report** - Tickets in Ready to Release with Release Soon tag
3. **Pending to Release Report** - Tickets in Ready to Release without Release Soon tag
4. **Bugs Fixing Report** - Bugs from Ready to Release separated by product (FX/DX)
5. **Luxor DX Bugs Report** - Only DX prefix bugs from multiple columns
6. **Release Version Report** - All tickets for a specific release version with readiness metrics
7. **Release Version Breakdown** - Summary of all versions with ticket counts and composition

### Smart Categorization

- **Automatic Bug Detection**: Identifies bugs by PRD prefix or numbered pattern
- **Feature Recognition**: Automatically categorizes tickets with "Add" or "Implement" keywords
- **Severity Sorting**: Bugs sorted by severity ([Critical], [High], [Medium], [Low])
- **Label-Based Grouping**: Supports custom labels for categorization

### User Features

- ✅ Interactive CLI with Trello board selection
- ✅ Version extraction from card descriptions (e.g., "Release 4.6.29")
- ✅ Expand/collapse lists for easier navigation
- ✅ Professional HTML report generation
- ✅ Readiness tracking for in-progress versions
- ✅ Cross-column card tracking
- ✅ Automatic Node BT board filtering

## Installation

### Prerequisites
- Node.js 14+ 
- Trello API credentials (API Key and Token)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/metrics-report-agent.git
cd metrics-report-agent
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

4. Add your Trello credentials to `.env`:
```
TRELLO_KEY=your_api_key_here
TRELLO_TOKEN=your_token_here
```

### Get Trello Credentials

1. Visit [Trello Developer API](https://trello.com/app-key)
2. Copy your **API Key**
3. Click "Token" to generate your **Token**
4. Add both to `.env` file

## Usage

### Basic Command

```bash
node src/main.js --release-notes
```

### With Date Range Arguments

```bash
node src/main.js --release-notes 2024-01-01 2024-12-31
```

### Interactive Flow

1. Select your Trello board (Hunter Luxor Migration by default)
2. Choose the report type
3. Enter report title (if applicable)
4. Select options based on report type
5. Report generates in `output/report/` folder

## Report Output

All reports are generated as HTML files with:
- Professional styling
- Category breakdown (Bugs, Features, Improvements, Other)
- Status tracking (Done, Ready to Release, Testing, Pending)
- Severity indicators for bugs
- Expand/collapse functionality for large ticket lists

### Output Location
```
output/report/report_[type]_[board]_[date].html
```

## Project Structure

```
├── src/
│   ├── main.js                      # Entry point
│   ├── releaseNotesGenerator.js      # Core report logic
│   └── professionalReportGenerator.js # HTML generation
├── output/
│   └── report/                       # Generated reports
├── .env                              # Environment variables (gitignored)
├── package.json                      # Dependencies
└── README.md                          # This file
```

## Ticket Format

### Severity Tags (in ticket title)
```
[Critical] - System-breaking issue
[High]     - Major functionality affected
[Medium]   - Noticeable issue
[Low]      - Minor issue
```

### Version Format (in description)
```
Release 4.6.29
Release 4.7.0
```

### Ticket Naming Conventions
- Bugs: `PRD-123`, `123 -`, or `[Critical]`
- Features: Contains "Add" or "Implement"
- Improvements: Labeled as improvement/enhancement
- Other: Default category

## Dependencies

- **chalk** - Terminal string styling
- **inquirer** - Interactive CLI prompts
- **axios** - HTTP client for Trello API
- **dotenv** - Environment variable management

## Configuration

### .env Variables
```
TRELLO_KEY=your_api_key
TRELLO_TOKEN=your_token
```

### .gitignore
```
node_modules/
.env
output/
```

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

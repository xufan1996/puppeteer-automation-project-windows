# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Puppeteer-based automation tool designed to scrape and process enterprise WeChat group data. The application provides a web interface for configuring and monitoring automation tasks that interact with WeChat Work platform.

## Architecture

**Multi-Process Design:**
- `server.js`: Express web server providing REST API and web interface
- `src/main.js`: Main automation script handling login flow and coordination
- `src/worker.js`: Worker processes for parallel data processing
- Workers use independent browser instances for concurrent operations

**Key Components:**
- Web interface (`public/`) for task configuration and monitoring
- Chrome browser bundled in `chrome/` directory for consistent execution
- Real-time logging system with WebSocket-like updates
- Authentication sharing between main process and workers via cookies/localStorage

## Development Commands

```bash
# Development
npm start                    # Start development server
npm run dev                  # Same as start

# Chrome Installation
npm run install-chrome       # Install specific Chrome version (116.0.5793.0)

# Building
npm run build               # Build for current platform
npm run build-win          # Build Windows x64 executable 
npm run build-win-clean    # Build with reduced warnings (recommended)
npm run build-all          # Build for Windows, macOS, Linux
npm run build-win-deploy   # Clean build and run deployment script

# Testing
npm test                    # Test Windows executable functionality
npm run test-exe           # Same as test

# Deployment
npm run deploy              # Run deployment script
```

## Critical Configuration

**Puppeteer + pkg Compatibility:**
- Chrome executable path is dynamically determined using `getChromePath()` function
- Detects pkg environment via `typeof process.pkg !== 'undefined'`
- Uses bundled Chrome from `chrome/win64-116.0.5793.0/chrome-win64/chrome.exe` in packaged apps
- Both `main.js` and `worker.js` must specify `executablePath` in puppeteer.launch()

**Windows Compatibility:**
- Uses `process.env.COMSPEC` for cmd.exe path to avoid "spawn cmd enoent" errors
- Worker processes launched via spawn() with platform-specific command resolution
- Handles Windows process termination via taskkill

## Environment Variables

Copy `.env.example` to `.env` and configure:
- `SEARCH_KEYWORD`: Search term for WeChat groups
- `MAX_ITEMS`: Limit processed items (-1 for unlimited)
- `PORT`: Server port (default: 3000)

## pkg Configuration Notes

The `package.json` pkg section includes:
- Assets: `chrome/**/*`, `public/**/*`, `src/**/*.js`, `.env.example`, `.puppeteerrc.cjs`
- Scripts: `server.js`, `src/main.js`, `src/worker.js` (renamed from .cjs to .js for pkg compatibility)
- Options: `--no-bytecode`, `--public-packages=*`, `--compress=Brotli` for optimized builds

**Build Optimization:**
- `build-clean.js` script temporarily moves problematic directories during build
- `.puppeteerrc.cjs` disables automatic Chromium download
- `.pkgignore` filters out unnecessary files from the build

## Debugging and Logging

**Enhanced Logging Features:**
- Environment detection logs (platform, architecture, pkg mode)
- Chrome path validation with detailed file system checks
- Process spawn logging with command validation
- Puppeteer launch error tracking with stack traces
- Worker process detailed status reporting

**Windows-Specific Error Handling:**
- Uses `shell: true` option in spawn() to avoid cmd.exe path issues
- Eliminates `spawn cmd enoent` errors by using direct node process spawning
- All spawn operations use shell mode on Windows for better compatibility
- Includes `windowsHide: true` to prevent console windows from appearing

## Data Processing Flow

1. Main process handles WeChat login and navigation
2. Extracts list items from management interface
3. Spawns worker processes for parallel processing
4. Each worker opens independent browser with shared authentication
5. Workers process individual items (extract, modify, save)
6. Real-time progress reporting via server logs

## Authentication Architecture

- Main process collects cookies and localStorage after login
- Authentication data stored in `global.authData`
- Workers receive auth data via process arguments
- Each worker sets cookies/localStorage before navigation
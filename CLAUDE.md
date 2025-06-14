# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **TaskCache**, a Progressive Web App (PWA) that synchronizes and manages tasks from external sources like Notion and Google Tasks. The app works offline using IndexedDB for local storage and provides a mobile-first interface for task management.

## Architecture

### Core Components
- **Frontend**: Next.js 13.5.1 with TypeScript, static export configuration
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Data Layer**: IndexedDB for local persistence, API clients for external services
- **PWA Features**: Service worker, manifest.json, offline functionality

### Key Data Flow
1. External APIs (Notion/Google Tasks) → API Clients → IndexedDB → React State
2. User interactions update local state and IndexedDB
3. Sync operations merge remote data with local state (preserving read/stocked flags)

### Important Files Structure
- `app/page.tsx` - Main application logic and state management
- `lib/indexeddb.ts` - Database schema and operations
- `lib/api-clients.ts` - External API integrations (Notion, Google Tasks)
- `components/` - UI components including task cards and settings
- `hooks/` - Custom hooks for pull-to-refresh, PWA install, toast notifications

## Development Commands

### Setup and Development
```bash
make run          # Install dependencies and start dev server with browser opening
npm run dev       # Start development server (requires npm i first)
```

### Build and Production
```bash
make build        # Install deps if needed, then build for production
npm run build     # Build static export
npm run start     # Serve production build
```

### Code Quality
```bash
npm run lint      # Run ESLint (disabled during builds)
```

### Utilities
```bash
make clean        # Remove node_modules
make npmi         # Install dependencies
make npmi-<pkg>   # Install specific package
```

## Key Technical Details

### Static Export Configuration
- Uses `output: 'export'` in next.config.js
- Images are unoptimized for static hosting
- ESLint is disabled during builds

### IndexedDB Schema
- **Tasks store**: Indexed by source, completion status, read/stocked status
- **Settings store**: Stores API configurations and sync timestamps
- Storage persistence is requested for offline reliability

### API Integration
- **Notion**: Uses v2022-06-28 API with database queries
- **Google Tasks**: Currently mock implementation (authentication placeholder)
- Tasks are merged with local state, preserving user-specific flags (read/stocked)

### PWA Features
- Service worker registration in main component
- Pull-to-refresh functionality using custom hook
- Manifest configured for standalone mobile app experience

## Testing Notes

The project currently has no test suite configured. When adding tests:
- Consider testing IndexedDB operations with fake-indexeddb
- Mock API clients for unit tests
- Test PWA functionality requires service worker mocking

## Common Development Tasks

When working with this codebase:
- Always preserve local task state (read/stocked) during sync operations
- Use the existing toast system for user feedback
- Follow the existing component patterns from shadcn/ui
- Test offline functionality and IndexedDB operations
- Ensure mobile-first responsive design principles
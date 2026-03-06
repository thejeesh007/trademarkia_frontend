# Trademarkia Frontend Assignment

Incremental implementation for a real-time collaborative spreadsheet using Next.js, TypeScript, Tailwind, and Firebase.

## Current Progress
- Project scaffold complete
- Dashboard implemented with create/list flow
- Firestore-backed document persistence
- Spreadsheet editor UI in place (`/doc/[id]`)
- Editable 40x20 grid with row/column headers and keyboard navigation
- Firestore-backed cell autosave with realtime updates between sessions
- Save-state indicator in editor (`Connecting`, `Saving`, `Saved`, `Error`)
- Formula engine v1: `=SUM(...)`, arithmetic (`+ - * /`), and cell references

## Next Steps
- Add presence (active collaborators)
- Add identity (Google sign-in or display name)
- Add collaborator presence UI

## Local Setup
1. Copy `.env.example` to `.env.local`
2. Fill Firebase web app values
3. Run:
   - `npm install`
   - `npm run dev`

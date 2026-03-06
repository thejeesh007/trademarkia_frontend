# Trademarkia Frontend Assignment

Incremental implementation for a real-time collaborative spreadsheet using Next.js, TypeScript, Tailwind, and Firebase.

## Current Progress
- Project scaffold complete
- Dashboard implemented with create/list flow
- Firestore-backed document persistence
- Spreadsheet editor UI in place (`/doc/[id]`)
- Editable 40x20 grid with row/column headers and keyboard navigation

## Next Steps
- Persist grid cell values in Firestore
- Add realtime syncing and presence
- Add formula parsing (`SUM`, arithmetic, cell references)

## Local Setup
1. Copy `.env.example` to `.env.local`
2. Fill Firebase web app values
3. Run:
   - `npm install`
   - `npm run dev`

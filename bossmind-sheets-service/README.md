# BossMind Sheets Service (Railway)

## What it does
- GET /api/next-title
  - Finds first row where status=READY
  - Sets status=QUEUED and picked_at=now
  - Returns the picked title

- POST /api/mark-used
  - Marks a row as USED and sets used_at=now (optionally video_id)

## Deploy to Railway
1) Push this folder to GitHub
2) Create Railway project from repo
3) Add env vars:
   - GOOGLE_SERVICE_ACCOUNT_JSON
   - GOOGLE_SHEET_ID
   - GOOGLE_SHEET_NAME
   - (optional) ALLOWED_ORIGIN
4) Deploy

## Test
- /health
- /api/next-title

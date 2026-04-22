<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7120a548-09d7-42ff-af15-4a086a89eab9

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Supabase Storage

This project uploads images to Supabase Storage through the Express server.

Required env vars:

- `SUPABASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` must stay server-side only.
- The storage bucket should exist before you upload images.
- The upload flow uses `getPublicUrl`, so the bucket should be public.
- You can verify the connection at `GET /api/supabase/status`.

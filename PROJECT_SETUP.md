# Korean Wave Community project setup

This project uses Next.js App Router, TypeScript, Tailwind CSS, and pnpm.

## Structure

- `src/app`: routes, root layout, and global mobile-first styles
- `src/components`: shared interface components
- `src/features`: feature-specific UI and logic
- `src/lib/supabase`: reserved for future Supabase clients and helpers
- `src/types`: shared TypeScript types
- `public`: static assets

## Deployment and configuration

Copy `.env.example` to `.env.local` when local environment values are needed. Do not commit `.env.local`.

Vercel can build this project using the scripts in `package.json`. When Supabase is introduced, add the same public variables to the Vercel project settings.

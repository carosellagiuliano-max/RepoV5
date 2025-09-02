# Copilot Instructions for Schnittwerk Your Style

## Project Overview
This is a production-ready hair salon booking system with React frontend and Supabase backend.

## Hard Constraints - NEVER VIOLATE THESE
- ❌ **NO UI/styling changes**: Never modify existing CSS, Tailwind config, or component styles
- ❌ **NO changes to existing customer frontend appearance**: The customer-facing UI must remain visually identical
- ❌ **NO modifications to**: `**/*.css`, `tailwind.config.*`, `src/components/ui/**`
- ❌ **NO renaming of existing ENV variables**

## What You CAN Do
- ✅ Add new files in: `src/admin/**`, `src/lib/**`, `src/hooks/**`, `netlify/functions/**`, `docs/**`, `tests/**`
- ✅ Add to `public/` only: `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, `_headers`
- ✅ Extend `.env.example` (but don't rename existing variables)
- ✅ Add new TypeScript types and interfaces
- ✅ Create new backend functions and database migrations
- ✅ Add tests, documentation, and CI/CD improvements

## Code Quality Standards
- ✅ TypeScript strict mode required
- ✅ All Netlify functions must use JWT validation + Zod schemas
- ✅ Proper error handling with structured logging
- ✅ Use existing toast/alert components for user feedback
- ✅ Follow existing code patterns and conventions

## Architecture Patterns
- **Frontend**: React + TypeScript + Vite
- **State**: React Query for server state, React Context for app state  
- **Auth**: Supabase Auth with RBAC (admin/staff/customer roles)
- **Backend**: Netlify Functions (BFF pattern) + Supabase
- **Database**: Supabase with RLS policies
- **Storage**: Supabase Storage for media files

## Development Workflow
- Make incremental changes in small, focused PRs
- Always test changes locally before committing
- Update documentation when adding new features
- Follow the existing project structure and naming conventions
- Prioritize security and performance in all implementations
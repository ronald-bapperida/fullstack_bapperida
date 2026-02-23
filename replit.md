# Portal Admin BAPPERIDA Kalimantan Tengah

## Overview
Admin panel untuk BAPPERIDA (Badan Perencanaan, Penelitian dan Pengembangan Daerah) Kalimantan Tengah. Sistem dual-domain: BAPPEDA dan RIDA.

## Tech Stack
- **Frontend**: React + TypeScript, Wouter (routing), TanStack Query, Shadcn UI, Tailwind CSS
- **Backend**: Express.js + TypeScript, JWT Auth
- **Database**: PostgreSQL + Drizzle ORM
- **File Storage**: Local filesystem (`/uploads`)

## Default Credentials
| Username | Password | Role |
|----------|----------|------|
| superadmin | Admin@123 | Super Admin |
| admin_bpp | Admin@123 | Admin BAPPEDA |
| admin_rida | Admin@123 | Admin RIDA |

## RBAC Roles
- **super_admin**: Full access to all modules
- **admin_bpp**: BAPPEDA modules (News, Categories, Banners, Menus, Documents)
- **admin_rida**: RIDA modules (Research Permits, Surveys, Final Reports, Letter Templates, Suggestions)

## Modules

### BAPPEDA Domain
- **Berita (CMS)**: News management with categories, featured images, status (draft/published), soft delete & trash
- **Kategori Berita**: News category management
- **Banner**: Banner management with view/click tracking, schedule (start_at/end_at)
- **Menus**: Dynamic menu management with nested items (location: header/footer/mobile)
- **Dokumen PPID**: Document management with access levels (terbuka/terbatas/rahasia), soft delete

### RIDA Domain
- **Izin Penelitian**: Research permit workflow (submitted → in_review → revision_requested → approved → generated_letter → sent/rejected)
  - Auto-generates request number: BAPPERIDA-RID-YYYY-000001 (race-condition safe using DB transaction)
  - Status history tracking
  - HTML letter generation from templates
- **Survei IKM**: Satisfaction survey with 9 questions, IKM score calculation
- **Laporan Akhir**: Final research report uploads
- **Kotak Saran**: Suggestion/feedback box
- **Template Surat**: HTML letter templates with placeholders

## Key Features
- JWT-based authentication (stored in localStorage)
- Soft delete with trash + restore for: News, Banners, Documents, Menus, Research Permits
- File uploads (local filesystem): images (5MB), PDFs (1MB for permits)
- Auto-slug generation (UUID-suffixed, collision-safe)
- Race-condition-safe request number sequence generation
- Dashboard statistics per domain

## Architecture
```
client/src/
  contexts/auth.tsx       # Auth context + JWT management
  components/app-sidebar.tsx  # RBAC-aware sidebar
  pages/
    login.tsx             # Login page
    dashboard.tsx         # Statistics dashboard
    news/                 # News CRUD
    banners/              # Banner management
    menus/                # Menu management
    documents/            # Document PPID
    permits/              # Research permit workflow
    surveys/              # IKM surveys
    reports/              # Final reports
    suggestions/          # Suggestion box
    letter-templates/     # Letter template editor
    users/                # User management (super_admin only)

server/
  db.ts                   # Drizzle connection
  storage.ts              # All CRUD operations (DatabaseStorage)
  routes.ts               # All API endpoints + seed function
  auth.ts                 # JWT helpers + middleware

shared/
  schema.ts               # Complete Drizzle schema (all tables)
```

## API Endpoints
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `GET /api/admin/dashboard` - Dashboard stats
- `GET|POST|PATCH|DELETE /api/admin/news*` - News CRUD
- `GET|POST|PATCH|DELETE /api/admin/news-categories*` - Categories
- `GET|POST|PATCH|DELETE /api/admin/banners*` - Banners
- `GET|POST|PATCH|DELETE /api/admin/menus*` - Menus
- `GET|POST|PATCH|DELETE /api/admin/documents*` - Documents
- `GET|POST /api/admin/permits*` - Research permits
- `PATCH /api/admin/permits/:id/status` - Update permit status
- `POST /api/admin/permits/:id/generate-letter` - Generate HTML letter
- `GET /api/admin/surveys` - Survey list
- `GET /api/admin/final-reports` - Final reports
- `GET /api/admin/suggestions` - Suggestions
- `GET|POST|PATCH /api/admin/letter-templates*` - Letter templates
- `GET|POST|PATCH /api/admin/users*` - User management
- Public: `GET /api/news`, `GET /api/banners/active`, `GET /api/menus`, `GET /api/documents`
- Public: `POST /api/permits`, `GET /api/permits/:id`, `POST /api/surveys`, `POST /api/final-reports`, `POST /api/suggestions`

# Portal Admin BAPPERIDA Kalimantan Tengah

## Overview
Admin panel untuk BAPPERIDA (Badan Perencanaan, Penelitian dan Pengembangan Daerah) Kalimantan Tengah. Sistem dual-domain: BAPPEDA dan RIDA.

## Tech Stack
- **Frontend**: React + TypeScript, Wouter (routing), TanStack Query, Shadcn UI, Tailwind CSS, **react-quill-new** (rich text editor)
- **Node.js Backend**: Express.js + TypeScript, JWT Auth (port 5000 - serves React admin panel)
- **Database**: PostgreSQL (Replit built-in) + Drizzle ORM
- **File Storage**: Local filesystem (`/uploads`)

## Architecture
- **Node.js API (port 5000)**: Serves React admin panel via Express + Drizzle ORM

## Default Credentials
| Username | Password | Role |
|----------|----------|------|
| superadmin | Admin@123 | Super Admin |
| admin_bpp | Admin@123 | Admin BAPPEDA |
| admin_rida | Admin@123 | Admin RIDA |

## RBAC Roles
- **super_admin**: Full access to all modules
- **admin_bpp**: BAPPEDA modules (News, Categories, Banners, Menus, Documents, Document Masters)
- **admin_rida**: RIDA modules (Research Permits, Surveys, Final Reports, Letter Templates, Suggestions)

## Recent Changes
- **PPID Layanan PPID (Keberatan + Permohonan Informasi)**: Added two new PPID service modules — Formulir Keberatan and Permohonan Informasi. Each has: DB tables (`ppid_objections`, `ppid_information_requests`), Flutter/public POST API, admin list+detail pages with status update panel, sidebar nav under "Layanan PPID" (admin_bpp + superadmin). Flutter endpoints: `POST /api/ppid/objections`, `POST /api/ppid/information-requests`.
- **Letter Template `<<KEPADA>>` Multi-line**: Added `kepada` config field — supports multi-line recipient address; `\n` converted to DOCX `<w:br/>`. DOCX newline support applies to all variables including `<<TEMBUSAN>>`.
- **Favicon**: Changed to BAPPERIDA logo (`logo_bapperida.png`).
- **Dashboard Redesign**: Gradient hero header, colored stat cards, gradient charts, donut pie, satisfaction progress bars.
- **Letter Template Dynamic Variables**: 25+ DOCX variables, config panel with official details, tembusan, kepada, and cheatsheet.
- **i18n Wiring**: All pages wired with `useLang()` + `t()`.

## Modules

### BAPPEDA Domain
- **Berita (CMS)**: News management with categories, featured images, status (draft/published), soft delete & trash. Draft-first workflow, inline publish toggle.
- **Kategori Berita**: News category management
- **Banner**: Banner management with view/click tracking, desktop/mobile image, schedule
- **Menus**: Dynamic menu management with nested items (location: header/footer/mobile)
- **Dokumen PPID**: Document management with access levels (terbuka/terbatas/rahasia), soft delete
  - **Jenis Dokumen** (`/documents/kinds`): CRUD untuk jenis dokumen
  - **Kategori Dokumen** (`/documents/categories`): CRUD kategori PPID
  - **Tipe File** (`/documents/types`): CRUD tipe file dengan extension field

### RIDA Domain
- **Izin Penelitian**: Research permit workflow (submitted → in_review → revision_requested → approved → generated_letter → sent/rejected)
  - Auto-generates request number: BAPPERIDA-RID-YYYY-000001 (race-condition safe using DB transaction)
  - Status history tracking
  - DOCX letter generation from plaintext templates
- **Survei IKM**: Satisfaction survey with 9 questions
- **Laporan Akhir**: Final research report uploads
- **Kotak Saran**: Suggestion/feedback box
- **Template Surat**: Plaintext letter templates with placeholders + preview dialog + DOCX generation

## Key Features
- JWT-based authentication (stored in localStorage)
- Soft delete with trash + restore for: News, Banners, Documents, Menus, Research Permits
- File uploads (local filesystem): images (5MB), PDFs (1MB for permits)
- Auto-slug generation (UUID-suffixed, collision-safe)
- Race-condition-safe request number sequence generation
- Dashboard statistics per domain
- **Draft-first workflow**: News auto-saves as draft; publish toggle button inline in list view
- **Document masters**: Mandatory kind/category/type fields with filter dropdowns; seeded with PPID data; full CRUD pages
- **Banner image upload**: Desktop + mobile image fields with preview
- **DOCX generation**: Letter templates generate proper Word documents via `docx` npm package
- **Quill rich text editor**: Paste image support (intercepts via onCapturePaste override), caption dialog after upload, full toolbar; 100ms setup delay prevents "non-instantiated editor" error
- **Collapsible sidebar**: Dokumen PPID section with expandable sub-items; BAPPERIDA + Kalteng logos in sidebar header
- **Logout confirmation**: AlertDialog modal before logout
- **Language switcher**: Indonesian/English (ID/EN) with flags in top-right header; t() used across news, permits, users, letter-templates pages for page titles, buttons, table headers
- **User management tabs**: Split by role (Super Admin, Admin RIDA, Admin BAPPEDA)
- **Letter template DOCX**: Proper government letter format — letterhead table with logos (Kalteng + BAPPERIDA), double horizontal line, IZIN PENELITIAN title, Membaca/Perihal/Mengingat sections, conditions a-e, signature block (Kabid RIDA), CC list, 1-month validity

## Architecture
```
client/src/
  contexts/
    auth.tsx           # Auth context + JWT management
    language.tsx       # Language context (ID/EN i18n)
  components/app-sidebar.tsx  # RBAC-aware sidebar with collapsible Dokumen section
  pages/
    login.tsx          # Login page
    dashboard.tsx      # Statistics dashboard
    news/              # News CRUD + categories
    banners/           # Banner management
    menus/             # Menu management
    documents/
      index.tsx        # Document list + CRUD
      masters.tsx      # DocKindsPage, DocCategoriesPage, DocTypesPage (reusable MasterPage)
    permits/           # Research permit workflow
    surveys/           # IKM surveys
    reports/           # Final reports
    suggestions/       # Suggestion box
    letter-templates/  # Plaintext letter templates + preview
    users/             # User management with tabs by role

server/
  db.ts               # Drizzle connection
  storage.ts          # All CRUD operations (DatabaseStorage) including doc master CRUD
  routes.ts           # All API endpoints + seed function
  auth.ts             # JWT helpers + middleware

shared/
  schema.ts           # Complete Drizzle schema (all tables)

backend/                    # Go backend (port 8080) for Flutter
  internal/
    transport/http/         # Gin handlers (auth, news, banner, menu, document, permit, misc)
    repository/postgres/    # Raw SQL repositories
    domain/                 # Domain types
    middleware/             # JWT auth + role-based middleware
```

## Node.js API Endpoints (port 5000 - for React Admin)
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `GET /api/admin/dashboard` - Dashboard stats
- `GET|POST|PATCH|DELETE /api/admin/news*` - News CRUD
- `GET|POST|PATCH|DELETE /api/admin/news-categories*` - Categories
- `GET|POST|PATCH|DELETE /api/admin/banners*` - Banners
- `GET|POST|PATCH|DELETE /api/admin/menus*` - Menus
- `GET|POST|PATCH|DELETE /api/admin/documents*` - Documents
- `GET|POST|PATCH|DELETE /api/admin/document-kinds*` - Document kinds CRUD
- `GET|POST|PATCH|DELETE /api/admin/document-categories*` - Document categories CRUD
- `GET|POST|PATCH|DELETE /api/admin/document-types*` - Document types CRUD
- `GET|POST /api/admin/permits*` - Research permits
- `PATCH /api/admin/permits/:id/status` - Update permit status
- `POST /api/admin/permits/:id/generate-letter` - Generate DOCX letter
- `GET /api/admin/surveys` - Survey list
- `GET /api/admin/final-reports` - Final reports
- `GET /api/admin/suggestions` - Suggestions
- `GET|POST|PATCH /api/admin/letter-templates*` - Letter templates
- `GET|POST|PATCH /api/admin/users*` - User management
- Public: `GET /api/news`, `GET /api/news/:slug`, `GET /api/news-categories`
- Public: `GET /api/banners/active`, `POST /api/banners/:id/view`, `POST /api/banners/:id/click`
- Public: `GET /api/menus/:location`, `GET /api/documents`, `GET /api/documents/:id`
- Public: `GET /api/document-kinds`, `GET /api/document-categories`, `GET /api/document-types`
- Public: `POST /api/permits`, `POST /api/surveys`, `POST /api/final-reports`, `POST /api/suggestions`

## Go API Endpoints (port 8080 - for Flutter)
- Health: `GET /health`
- Auth: `POST /api/auth/login`, `GET /api/auth/me`
- Public news: `GET /api/news`, `GET /api/news/:slug`
- Public banners: `GET /api/banners/active?placement=home`
- Public menus: `GET /api/menus/:location`
- Public documents: `GET /api/documents`, `GET /api/documents/:id`
- Public masters: `GET /api/document-kinds`, `GET /api/document-categories`, `GET /api/document-types`
- Admin news: `GET|POST|PATCH|DELETE /api/admin/news*`, `GET|POST|PATCH|DELETE /api/admin/news-categories*`
- Admin banners: `GET|POST|PATCH|DELETE /api/admin/banners*`
- Admin menus: `GET|POST|PATCH|DELETE /api/admin/menus*`, `PATCH|DELETE /api/admin/menu-items/:id`
- Admin documents: `GET|POST|PATCH|DELETE /api/admin/documents*`
- Admin doc masters: `POST|PATCH|DELETE /api/admin/document-kinds/:id`, categories, types
- Admin permits: `GET /api/admin/permits*`, `PATCH /api/admin/permits/:id/status`
- Admin surveys: `GET /api/admin/surveys`
- Admin reports: `GET /api/admin/final-reports`
- Admin suggestions: `GET /api/admin/suggestions`
- Admin letter templates: `GET|POST|PATCH /api/admin/letter-templates*`
- Admin users: `GET|POST|PATCH /api/admin/users*` (super_admin only)

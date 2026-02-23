# BAPPERIDA Go Backend

Backend Go dengan arsitektur Clean Architecture untuk Portal Admin BAPPERIDA Kalimantan Tengah.

## Cara Menjalankan

```bash
cd backend

# Development (langsung run)
go run cmd/api/main.go

# Build dulu, lalu run
make build && make run

# Atau dengan binary langsung
make build
GO_API_PORT=8080 ./bin/bapperida-api
```

## Arsitektur (Clean Architecture)

```
backend/
├── cmd/api/main.go              ← Entry point, dependency injection
├── internal/
│   ├── domain/
│   │   └── entities.go          ← Entities: User, News, Permit, dll (PURE Go, tanpa deps)
│   ├── usecase/
│   │   ├── auth_usecase.go      ← Business logic: Login, token generation
│   │   ├── news_usecase.go      ← Business logic: Validasi, CRUD berita
│   │   └── permit_usecase.go    ← Business logic: Validasi transisi status permit
│   ├── repository/
│   │   └── postgres/
│   │       ├── db.go            ← Koneksi PostgreSQL
│   │       ├── user_repo.go     ← Raw SQL untuk users
│   │       ├── news_repo.go     ← Raw SQL untuk news
│   │       └── permit_repo.go   ← Raw SQL + race-safe sequence
│   ├── transport/
│   │   └── http/
│   │       ├── router.go        ← Route registration (Gin)
│   │       ├── auth_handler.go  ← Handler: Login, Me
│   │       ├── news_handler.go  ← Handler: CRUD berita
│   │       └── permit_handler.go← Handler: Submit & update status
│   ├── middleware/
│   │   └── auth.go              ← JWT middleware, RequireRole()
│   └── pkg/
│       ├── response/            ← Standard JSON response helpers
│       ├── slug/                ← UUID-suffixed slug generator
│       └── storage/             ← File upload helper (multipart)
└── Makefile
```

## Dependency Flow (penting untuk dipahami)

```
main.go
  └── router.go (transport)
        └── *_handler.go (transport)
              └── *_usecase.go (usecase / business logic)
                    └── postgres/*_repo.go (repository)
                          └── entities.go (domain)
```

Setiap layer HANYA import layer di bawahnya. Ini yang membuat kode mudah di-test.

## API Endpoints

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | /health | No | - |
| POST | /api/auth/login | No | - |
| GET | /api/auth/me | Bearer | any |
| POST | /api/permits | No | - |
| GET | /api/admin/news | Bearer | super_admin, admin_bpp |
| POST | /api/admin/news | Bearer | super_admin, admin_bpp |
| PATCH | /api/admin/news/:id | Bearer | super_admin, admin_bpp |
| DELETE | /api/admin/news/:id | Bearer | super_admin, admin_bpp |
| POST | /api/admin/news/:id/restore | Bearer | super_admin, admin_bpp |
| DELETE | /api/admin/news/:id/permanent | Bearer | super_admin, admin_bpp |
| GET | /api/admin/permits | Bearer | super_admin, admin_rida |
| PATCH | /api/admin/permits/:id/status | Bearer | super_admin, admin_rida |

## Environment Variables

| Var | Default | Keterangan |
|-----|---------|------------|
| DATABASE_URL | (required) | PostgreSQL connection string |
| JWT_SECRET | bapperida-jwt-secret-dev | Secret untuk JWT signing |
| GO_API_PORT | 8080 | Port server |

## Contoh Request

### Login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}'
```

### Get News List
```bash
TOKEN="eyJhbGci..."
curl http://localhost:8080/api/admin/news \
  -H "Authorization: Bearer $TOKEN"
```

### Submit Research Permit
```bash
curl -X POST http://localhost:8080/api/permits \
  -H "Content-Type: application/json" \
  -d '{
    "email": "researcher@example.com",
    "full_name": "Nama Peneliti",
    "nim_nik": "1234567890",
    "birth_place": "Palangka Raya",
    "work_unit": "Universitas Palangka Raya",
    "institution": "Fakultas MIPA",
    "phone_wa": "08123456789",
    "citizenship": "WNI",
    "research_location": "Kalimantan Tengah",
    "research_duration": "3 bulan",
    "research_title": "Studi Biodiversitas Hutan Kalteng",
    "signer_position": "Dekan",
    "intro_letter_number": "001/UPR/2025",
    "intro_letter_date": "2025-01-15",
    "agreement_final_report": true
  }'
```

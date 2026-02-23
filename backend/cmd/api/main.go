// Command api is the entry point for the BAPPERIDA Go REST API.
//
// Architecture overview:
//
//	┌───────────────────────────────────────────────────────────────┐
//	│  Transport (HTTP)                                             │
//	│  internal/transport/http/*.go  — Gin handlers, routing       │
//	├───────────────────────────────────────────────────────────────┤
//	│  Usecase (Business Logic)                                     │
//	│  internal/usecase/*.go         — Validation, orchestration   │
//	├───────────────────────────────────────────────────────────────┤
//	│  Repository (Data Access)                                     │
//	│  internal/repository/postgres  — Raw SQL queries             │
//	├───────────────────────────────────────────────────────────────┤
//	│  Domain (Entities & Contracts)                               │
//	│  internal/domain/entities.go   — Pure Go structs, no deps    │
//	└───────────────────────────────────────────────────────────────┘
//
// To run:
//
//	cd backend && go run cmd/api/main.go
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"

	"github.com/bapperida/portal/internal/repository/postgres"
	handler "github.com/bapperida/portal/internal/transport/http"
	"github.com/bapperida/portal/internal/usecase"
)

func main() {
	// Load .env if present (dev convenience)
	_ = godotenv.Load(".env")

	// 1. Connect to database
	db, err := postgres.Connect()
	if err != nil {
		log.Fatalf("DB connection failed: %v", err)
	}
	defer db.Close()

	// 2. Wire repositories
	userRepo := postgres.NewUserRepository(db)
	newsRepo := postgres.NewNewsRepository(db)
	permitRepo := postgres.NewPermitRepository(db)

	// 3. Wire usecases (business logic layer)
	authUC := usecase.NewAuthUsecase(userRepo)
	newsUC := usecase.NewNewsUsecase(newsRepo)
	permitUC := usecase.NewPermitUsecase(permitRepo)

	// 4. Wire HTTP handlers (transport layer)
	authHandler := handler.NewAuthHandler(authUC, userRepo)
	newsHandler := handler.NewNewsHandler(newsUC)
	permitHandler := handler.NewPermitHandler(permitUC)

	// 5. Build router
	r := handler.NewRouter(authHandler, newsHandler, permitHandler, authUC.JWTSecret())

	// 6. Start server
	port := os.Getenv("GO_API_PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 BAPPERIDA Go API listening on :%s\n", port)
	fmt.Println("   Docs: GET /health")
	fmt.Println("   Auth: POST /api/auth/login")
	fmt.Println("   News: GET  /api/admin/news  (Bearer token required)")
	fmt.Println("   Permits: GET /api/admin/permits (Bearer token required)")

	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

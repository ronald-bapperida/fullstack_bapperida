// Package usecase contains business logic / application layer.
// This is the "clean architecture" core: it depends only on domain, not on DB or HTTP.
package usecase

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/bapperida/portal/internal/domain"
	"github.com/bapperida/portal/internal/middleware"
	"github.com/bapperida/portal/internal/repository/postgres"
)

type AuthUsecase struct {
	userRepo  *postgres.UserRepository
	jwtSecret string
}

func NewAuthUsecase(userRepo *postgres.UserRepository) *AuthUsecase {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "bapperida-jwt-secret-dev"
	}
	return &AuthUsecase{userRepo: userRepo, jwtSecret: secret}
}

func (u *AuthUsecase) JWTSecret() string {
	return u.jwtSecret
}

type LoginResult struct {
	Token string      `json:"token"`
	User  *domain.User `json:"user"`
}

func (u *AuthUsecase) Login(username, password string) (*LoginResult, error) {
	user, err := u.userRepo.FindByUsername(username)
	if err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("username atau password salah")
	}
	if !u.userRepo.VerifyPassword(user, password) {
		return nil, fmt.Errorf("username atau password salah")
	}

	claims := &middleware.Claims{
		ID:       user.ID,
		Username: user.Username,
		Role:     string(user.Role),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(u.jwtSecret))
	if err != nil {
		return nil, fmt.Errorf("token signing failed: %w", err)
	}

	return &LoginResult{Token: token, User: user}, nil
}

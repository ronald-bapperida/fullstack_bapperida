package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/bapperida/portal/internal/pkg/response"
)

const UserKey = "user"

type Claims struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// Auth extracts and validates JWT from Authorization header.
func Auth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			response.Unauthorized(c, "Token tidak ditemukan")
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			response.Unauthorized(c, "Token tidak valid atau sudah kedaluwarsa")
			c.Abort()
			return
		}

		c.Set(UserKey, claims)
		c.Next()
	}
}

// RequireRole returns a middleware that allows only specified roles.
func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}

	return func(c *gin.Context) {
		rawClaims, exists := c.Get(UserKey)
		if !exists {
			response.Unauthorized(c, "Tidak terautentikasi")
			c.Abort()
			return
		}

		claims, ok := rawClaims.(*Claims)
		if !ok || !allowed[claims.Role] {
			response.Forbidden(c, "Akses ditolak untuk role ini")
			c.Abort()
			return
		}
		c.Next()
	}
}

// GetClaims is a helper to retrieve claims from context.
func GetClaims(c *gin.Context) *Claims {
	raw, _ := c.Get(UserKey)
	claims, _ := raw.(*Claims)
	return claims
}

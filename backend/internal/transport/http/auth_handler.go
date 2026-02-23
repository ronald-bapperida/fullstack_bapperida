// Package http wires HTTP handlers using Gin.
// Handler layer is thin: it only parses request, calls usecase, returns response.
package http

import (
	"github.com/gin-gonic/gin"

	"github.com/bapperida/portal/internal/middleware"
	"github.com/bapperida/portal/internal/pkg/response"
	"github.com/bapperida/portal/internal/repository/postgres"
	"github.com/bapperida/portal/internal/usecase"
)

type AuthHandler struct {
	uc       *usecase.AuthUsecase
	userRepo *postgres.UserRepository
}

func NewAuthHandler(uc *usecase.AuthUsecase, userRepo *postgres.UserRepository) *AuthHandler {
	return &AuthHandler{uc: uc, userRepo: userRepo}
}

type loginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "username dan password wajib diisi")
		return
	}

	result, err := h.uc.Login(req.Username, req.Password)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	response.OK(c, result)
}

// GET /api/auth/me  (requires auth middleware)
func (h *AuthHandler) Me(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if claims == nil {
		response.Unauthorized(c, "tidak terautentikasi")
		return
	}

	user, err := h.userRepo.FindByID(claims.ID)
	if err != nil || user == nil {
		response.NotFound(c, "pengguna tidak ditemukan")
		return
	}

	response.OK(c, user)
}

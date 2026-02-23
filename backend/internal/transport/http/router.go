package http

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/bapperida/portal/internal/middleware"
)

// NewRouter builds and returns a configured Gin engine.
// Architecture note:
//   - Transport layer = this file (routing, HTTP concerns only)
//   - Usecase layer  = business logic (auth_usecase.go, news_usecase.go, etc.)
//   - Repository     = data access (postgres/*.go)
func NewRouter(
	authHandler *AuthHandler,
	newsHandler *NewsHandler,
	permitHandler *PermitHandler,
	jwtSecret string,
) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	// CORS middleware
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "bapperida-go-api"})
	})

	api := r.Group("/api")

	// ─── Auth ─────────────────────────────────────────────────────────────────
	auth := api.Group("/auth")
	{
		auth.POST("/login", authHandler.Login)
		auth.GET("/me", middleware.Auth(jwtSecret), authHandler.Me)
	}

	// ─── Public endpoints ─────────────────────────────────────────────────────
	public := api.Group("")
	{
		// Anyone can submit a research permit application
		public.POST("/permits", permitHandler.Submit)
	}

	// ─── Admin endpoints (require JWT) ────────────────────────────────────────
	protected := api.Group("/admin")
	protected.Use(middleware.Auth(jwtSecret))
	{
		// News — admin_bpp + super_admin
		newsBPP := protected.Group("/news")
		newsBPP.Use(middleware.RequireRole("super_admin", "admin_bpp"))
		{
			newsBPP.GET("", newsHandler.List)
			newsBPP.GET("/:id", newsHandler.GetByID)
			newsBPP.POST("", newsHandler.Create)
			newsBPP.PATCH("/:id", newsHandler.Update)
			newsBPP.DELETE("/:id", newsHandler.SoftDelete)
			newsBPP.POST("/:id/restore", newsHandler.Restore)
			newsBPP.DELETE("/:id/permanent", newsHandler.HardDelete)
		}

		// Research Permits — admin_rida + super_admin
		permitRIDA := protected.Group("/permits")
		permitRIDA.Use(middleware.RequireRole("super_admin", "admin_rida"))
		{
			permitRIDA.GET("", permitHandler.List)
			permitRIDA.GET("/:id", permitHandler.GetByID)
			permitRIDA.PATCH("/:id/status", permitHandler.UpdateStatus)
		}
	}

	return r
}

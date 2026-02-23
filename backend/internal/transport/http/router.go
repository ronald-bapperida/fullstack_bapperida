package http

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/bapperida/portal/internal/middleware"
)

// NewRouter builds and returns a configured Gin engine.
func NewRouter(
	authHandler *AuthHandler,
	newsHandler *NewsHandler,
	permitHandler *PermitHandler,
	bannerHandler *BannerHandler,
	menuHandler *MenuHandler,
	documentHandler *DocumentHandler,
	newsCatHandler *NewsCategoryHandler,
	surveyHandler *SurveyHandler,
	finalReportHandler *FinalReportHandler,
	suggestionHandler *SuggestionHandler,
	letterTemplateHandler *LetterTemplateHandler,
	userHandler *UserHandler,
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

	// ─── Public endpoints (for Flutter mobile) ─────────────────────────────────
	public := api.Group("")
	{
		// Research permit application - anyone
		public.POST("/permits", permitHandler.Submit)

		// News - published only
		public.GET("/news", newsHandler.PublicList)
		public.GET("/news/:slug", newsHandler.GetBySlug)

		// News categories - public
		public.GET("/news-categories", newsCatHandler.List)

		// Banners - active by placement
		public.GET("/banners/active", bannerHandler.ActiveByPlacement)
		public.POST("/banners/:id/view", bannerHandler.TrackView)
		public.POST("/banners/:id/click", bannerHandler.TrackClick)

		// Menus - active by location
		public.GET("/menus/:location", menuHandler.GetByLocation)

		// Documents - terbuka + published only
		public.GET("/documents", documentHandler.PublicList)
		public.GET("/documents/:id", documentHandler.GetByID)

		// Document masters - public
		public.GET("/document-kinds", documentHandler.ListKinds)
		public.GET("/document-categories", documentHandler.ListCategories)
		public.GET("/document-types", documentHandler.ListTypes)

		// Survey & suggestions - anyone can submit
		public.POST("/surveys", surveyHandler.Create)
		public.POST("/suggestions", suggestionHandler.Create)

		// Final reports - research subjects submit these
		public.POST("/final-reports", finalReportHandler.Create)
	}

	// ─── Admin endpoints (require JWT) ────────────────────────────────────────
	protected := api.Group("/admin")
	protected.Use(middleware.Auth(jwtSecret))
	{
		// ── News (admin_bpp + super_admin) ──────────────────────────────────
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

		// ── News Categories (admin_bpp + super_admin) ───────────────────────
		catGroup := protected.Group("/news-categories")
		catGroup.Use(middleware.RequireRole("super_admin", "admin_bpp"))
		{
			catGroup.POST("", newsCatHandler.Create)
			catGroup.PATCH("/:id", newsCatHandler.Update)
			catGroup.DELETE("/:id", newsCatHandler.Delete)
		}

		// ── Research Permits (admin_rida + super_admin) ─────────────────────
		permitRIDA := protected.Group("/permits")
		permitRIDA.Use(middleware.RequireRole("super_admin", "admin_rida"))
		{
			permitRIDA.GET("", permitHandler.List)
			permitRIDA.GET("/:id", permitHandler.GetByID)
			permitRIDA.PATCH("/:id/status", permitHandler.UpdateStatus)
		}

		// ── Banners (admin_bpp + super_admin) ───────────────────────────────
		bannerGroup := protected.Group("/banners")
		bannerGroup.Use(middleware.RequireRole("super_admin", "admin_bpp"))
		{
			bannerGroup.GET("", bannerHandler.List)
			bannerGroup.GET("/:id", bannerHandler.GetByID)
			bannerGroup.POST("", bannerHandler.Create)
			bannerGroup.PATCH("/:id", bannerHandler.Update)
			bannerGroup.DELETE("/:id", bannerHandler.SoftDelete)
			bannerGroup.POST("/:id/restore", bannerHandler.Restore)
		}

		// ── Menus (admin_bpp + super_admin) ─────────────────────────────────
		menuGroup := protected.Group("/menus")
		menuGroup.Use(middleware.RequireRole("super_admin", "admin_bpp"))
		{
			menuGroup.GET("", menuHandler.List)
			menuGroup.GET("/:id", menuHandler.GetByID)
			menuGroup.POST("", menuHandler.Create)
			menuGroup.PATCH("/:id", menuHandler.Update)
			menuGroup.DELETE("/:id", menuHandler.Delete)
			menuGroup.POST("/:id/items", menuHandler.CreateItem)
		}
		menuItemGroup := protected.Group("/menu-items")
		menuItemGroup.Use(middleware.RequireRole("super_admin", "admin_bpp"))
		{
			menuItemGroup.PATCH("/:id", menuHandler.UpdateItem)
			menuItemGroup.DELETE("/:id", menuHandler.DeleteItem)
		}

		// ── Documents (all admin roles) ──────────────────────────────────────
		docGroup := protected.Group("/documents")
		docGroup.Use(middleware.RequireRole("super_admin", "admin_bpp", "admin_rida"))
		{
			docGroup.GET("", documentHandler.AdminList)
			docGroup.GET("/:id", documentHandler.GetByID)
			docGroup.POST("", documentHandler.Create)
			docGroup.PATCH("/:id", documentHandler.Update)
			docGroup.DELETE("/:id", documentHandler.SoftDelete)
			docGroup.POST("/:id/restore", documentHandler.Restore)
		}

		// ── Document Masters (super_admin only) ──────────────────────────────
		docMasters := protected.Group("")
		docMasters.Use(middleware.RequireRole("super_admin"))
		{
			docMasters.POST("/document-kinds", documentHandler.CreateKind)
			docMasters.POST("/document-categories", documentHandler.CreateCategory)
			docMasters.POST("/document-types", documentHandler.CreateType)
		}

		// ── Surveys (admin_rida + super_admin) ───────────────────────────────
		surveyGroup := protected.Group("/surveys")
		surveyGroup.Use(middleware.RequireRole("super_admin", "admin_rida"))
		{
			surveyGroup.GET("", surveyHandler.List)
		}

		// ── Final Reports (admin_rida + super_admin) ─────────────────────────
		frGroup := protected.Group("/final-reports")
		frGroup.Use(middleware.RequireRole("super_admin", "admin_rida"))
		{
			frGroup.GET("", finalReportHandler.List)
		}

		// ── Suggestion Box (all admin) ───────────────────────────────────────
		suggGroup := protected.Group("/suggestions")
		suggGroup.Use(middleware.RequireRole("super_admin", "admin_bpp", "admin_rida"))
		{
			suggGroup.GET("", suggestionHandler.List)
		}

		// ── Letter Templates (super_admin + admin_rida) ──────────────────────
		ltGroup := protected.Group("/letter-templates")
		ltGroup.Use(middleware.RequireRole("super_admin", "admin_rida"))
		{
			ltGroup.GET("", letterTemplateHandler.List)
			ltGroup.GET("/:id", letterTemplateHandler.GetByID)
			ltGroup.POST("", letterTemplateHandler.Create)
			ltGroup.PATCH("/:id", letterTemplateHandler.Update)
		}

		// ── Users (super_admin only) ─────────────────────────────────────────
		userGroup := protected.Group("/users")
		userGroup.Use(middleware.RequireRole("super_admin"))
		{
			userGroup.GET("", userHandler.List)
			userGroup.POST("", userHandler.Create)
			userGroup.PATCH("/:id", userHandler.Update)
		}
	}

	return r
}

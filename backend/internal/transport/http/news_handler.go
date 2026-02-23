package http

import (
        "strconv"
        "time"

        "github.com/gin-gonic/gin"

        "github.com/bapperida/portal/internal/domain"
        "github.com/bapperida/portal/internal/middleware"
        "github.com/bapperida/portal/internal/pkg/response"
        "github.com/bapperida/portal/internal/repository/postgres"
        "github.com/bapperida/portal/internal/usecase"
)

type NewsHandler struct {
        uc *usecase.NewsUsecase
}

func NewNewsHandler(uc *usecase.NewsUsecase) *NewsHandler {
        return &NewsHandler{uc: uc}
}

// GET /api/admin/news
func (h *NewsHandler) List(c *gin.Context) {
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
        f := postgres.NewsFilter{
                Status: c.Query("status"),
                Search: c.Query("search"),
                Trash:  c.Query("trash") == "true",
                Page:   page, Limit: limit,
        }
        result, err := h.uc.List(f)
        if err != nil {
                response.InternalError(c, err.Error())
                return
        }
        response.OK(c, result)
}

// GET /api/admin/news/:id
func (h *NewsHandler) GetByID(c *gin.Context) {
        n, err := h.uc.GetByID(c.Param("id"))
        if err != nil {
                response.NotFound(c, err.Error())
                return
        }
        response.OK(c, n)
}

type createNewsRequest struct {
        Title           string  `json:"title" binding:"required"`
        CategoryID      *string `json:"category_id"`
        Content         string  `json:"content" binding:"required"`
        Excerpt         *string `json:"excerpt"`
        URL             *string `json:"url"`
        FeaturedImage   *string `json:"featured_image"`
        FeaturedCaption *string `json:"featured_caption"`
        Status          string  `json:"status"`
        EventAt         *string `json:"event_at"`
        PublishedAt     *string `json:"published_at"`
}

func parseTime(s *string) *time.Time {
        if s == nil || *s == "" {
                return nil
        }
        t, err := time.Parse(time.RFC3339, *s)
        if err != nil {
                return nil
        }
        return &t
}

// POST /api/admin/news
func (h *NewsHandler) Create(c *gin.Context) {
        var req createNewsRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                response.BadRequest(c, err.Error())
                return
        }

        claims := middleware.GetClaims(c)
        authorID := claims.ID

        status := domain.NewsStatus(req.Status)
        if status == "" {
                status = domain.NewsStatusDraft
        }

        n, err := h.uc.Create(postgres.CreateNewsInput{
                Title:           req.Title,
                CategoryID:      req.CategoryID,
                Content:         req.Content,
                Excerpt:         req.Excerpt,
                URL:             req.URL,
                FeaturedImage:   req.FeaturedImage,
                FeaturedCaption: req.FeaturedCaption,
                Status:          status,
                EventAt:         parseTime(req.EventAt),
                PublishedAt:     parseTime(req.PublishedAt),
                AuthorID:        &authorID,
        })
        if err != nil {
                response.BadRequest(c, err.Error())
                return
        }
        response.Created(c, n)
}

// PATCH /api/admin/news/:id
func (h *NewsHandler) Update(c *gin.Context) {
        var req createNewsRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                response.BadRequest(c, err.Error())
                return
        }

        status := domain.NewsStatus(req.Status)
        if status == "" {
                status = domain.NewsStatusDraft
        }

        n, err := h.uc.Update(c.Param("id"), postgres.UpdateNewsInput{
                Title:           req.Title,
                CategoryID:      req.CategoryID,
                Content:         req.Content,
                Excerpt:         req.Excerpt,
                URL:             req.URL,
                FeaturedImage:   req.FeaturedImage,
                FeaturedCaption: req.FeaturedCaption,
                Status:          status,
                EventAt:         parseTime(req.EventAt),
                PublishedAt:     parseTime(req.PublishedAt),
        })
        if err != nil {
                response.BadRequest(c, err.Error())
                return
        }
        response.OK(c, n)
}

// DELETE /api/admin/news/:id  (soft delete)
func (h *NewsHandler) SoftDelete(c *gin.Context) {
        if err := h.uc.SoftDelete(c.Param("id")); err != nil {
                response.InternalError(c, err.Error())
                return
        }
        response.OK(c, gin.H{"message": "berita dipindahkan ke trash"})
}

// POST /api/admin/news/:id/restore
func (h *NewsHandler) Restore(c *gin.Context) {
        if err := h.uc.Restore(c.Param("id")); err != nil {
                response.InternalError(c, err.Error())
                return
        }
        response.OK(c, gin.H{"message": "berita berhasil dipulihkan"})
}

// DELETE /api/admin/news/:id/permanent
func (h *NewsHandler) HardDelete(c *gin.Context) {
        if err := h.uc.HardDelete(c.Param("id")); err != nil {
                response.InternalError(c, err.Error())
                return
        }
        response.OK(c, gin.H{"message": "berita dihapus permanen"})
}

// GET /api/news  (public - published only, for Flutter)
func (h *NewsHandler) PublicList(c *gin.Context) {
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
        f := postgres.NewsFilter{
                Search: c.Query("search"),
                Page:   page, Limit: limit,
        }
        result, err := h.uc.PublicList(f)
        if err != nil {
                response.InternalError(c, err.Error())
                return
        }
        response.OK(c, result)
}

// GET /api/news/:slug  (public - by slug, for Flutter)
func (h *NewsHandler) GetBySlug(c *gin.Context) {
        n, err := h.uc.GetBySlug(c.Param("slug"))
        if err != nil {
                response.NotFound(c, err.Error())
                return
        }
        response.OK(c, n)
}

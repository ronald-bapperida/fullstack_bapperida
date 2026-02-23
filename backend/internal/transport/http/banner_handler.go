package http

import (
        "strconv"

        "github.com/gin-gonic/gin"

        "github.com/bapperida/portal/internal/domain"
        "github.com/bapperida/portal/internal/pkg/response"
        "github.com/bapperida/portal/internal/repository/postgres"
)

type BannerHandler struct {
        repo *postgres.BannerRepository
}

func NewBannerHandler(repo *postgres.BannerRepository) *BannerHandler {
        return &BannerHandler{repo: repo}
}

// GET /api/admin/banners
func (h *BannerHandler) List(c *gin.Context) {
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

        var isActive *bool
        if v := c.Query("is_active"); v != "" {
                b := v == "true"
                isActive = &b
        }

        f := postgres.BannerFilter{
                Placement: c.Query("placement"),
                IsActive:  isActive,
                Trash:     c.Query("trash") == "true",
                Search:    c.Query("search"),
                Page: page, Limit: limit,
        }

        items, total, err := h.repo.List(f)
        if err != nil {
                response.InternalError(c, err.Error())
                return
        }
        if items == nil { items = []domain.Banner{} }
        response.OK(c, domain.PaginatedResult[domain.Banner]{Items: items, Total: total, Page: page, Limit: limit})
}

// GET /api/banners/active  (public - for Flutter)
func (h *BannerHandler) ActiveByPlacement(c *gin.Context) {
        placement := c.DefaultQuery("placement", "home")
        items, err := h.repo.ActiveByPlacement(placement)
        if err != nil {
                response.InternalError(c, err.Error())
                return
        }
        if items == nil { items = []domain.Banner{} }
        response.OK(c, items)
}

// GET /api/admin/banners/:id
func (h *BannerHandler) GetByID(c *gin.Context) {
        b, err := h.repo.FindByID(c.Param("id"))
        if err != nil { response.InternalError(c, err.Error()); return }
        if b == nil { response.NotFound(c, "banner tidak ditemukan"); return }
        response.OK(c, b)
}

type bannerRequest struct {
        Title        string  `json:"title" binding:"required"`
        Slug         *string `json:"slug"`
        Placement    string  `json:"placement" binding:"required"`
        ImageDesktop *string `json:"image_desktop"`
        ImageMobile  *string `json:"image_mobile"`
        AltText      *string `json:"alt_text"`
        LinkType     string  `json:"link_type"`
        LinkURL      *string `json:"link_url"`
        Target       string  `json:"target"`
        SortOrder    int     `json:"sort_order"`
        StartAt      *string `json:"start_at"`
        EndAt        *string `json:"end_at"`
        IsActive     bool    `json:"is_active"`
}

func (req *bannerRequest) toInput() postgres.BannerInput {
        lt := domain.BannerLinkType(req.LinkType)
        if lt == "" { lt = domain.BannerLinkExternal }
        target := req.Target
        if target == "" { target = "_self" }
        return postgres.BannerInput{
                Title: req.Title, Slug: req.Slug, Placement: req.Placement,
                ImageDesktop: req.ImageDesktop, ImageMobile: req.ImageMobile, AltText: req.AltText,
                LinkType: lt, LinkURL: req.LinkURL, Target: target,
                SortOrder: req.SortOrder, IsActive: req.IsActive,
                StartAt: parseTime(req.StartAt), EndAt: parseTime(req.EndAt),
        }
}

// POST /api/admin/banners
func (h *BannerHandler) Create(c *gin.Context) {
        var req bannerRequest
        if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
        b, err := h.repo.Create(req.toInput())
        if err != nil { response.InternalError(c, err.Error()); return }
        response.Created(c, b)
}

// PATCH /api/admin/banners/:id
func (h *BannerHandler) Update(c *gin.Context) {
        var req bannerRequest
        if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
        b, err := h.repo.Update(c.Param("id"), req.toInput())
        if err != nil { response.InternalError(c, err.Error()); return }
        if b == nil { response.NotFound(c, "banner tidak ditemukan"); return }
        response.OK(c, b)
}

// DELETE /api/admin/banners/:id
func (h *BannerHandler) SoftDelete(c *gin.Context) {
        if err := h.repo.SoftDelete(c.Param("id")); err != nil { response.InternalError(c, err.Error()); return }
        response.OK(c, gin.H{"message": "banner dipindahkan ke trash"})
}

// POST /api/admin/banners/:id/restore
func (h *BannerHandler) Restore(c *gin.Context) {
        if err := h.repo.Restore(c.Param("id")); err != nil { response.InternalError(c, err.Error()); return }
        response.OK(c, gin.H{"message": "banner dipulihkan"})
}

// POST /api/banners/:id/view  (public)
func (h *BannerHandler) TrackView(c *gin.Context) {
        h.repo.IncrementView(c.Param("id"))
        response.OK(c, gin.H{"ok": true})
}

// POST /api/banners/:id/click  (public)
func (h *BannerHandler) TrackClick(c *gin.Context) {
        h.repo.IncrementClick(c.Param("id"))
        response.OK(c, gin.H{"ok": true})
}

// parseTime helper is defined in news_handler.go - accessible within same package

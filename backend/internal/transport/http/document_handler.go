package http

import (
        "strconv"

        "github.com/gin-gonic/gin"

        "github.com/bapperida/portal/internal/domain"
        "github.com/bapperida/portal/internal/pkg/response"
        "github.com/bapperida/portal/internal/repository/postgres"
)

type DocumentHandler struct {
        repo *postgres.DocumentRepository
}

func NewDocumentHandler(repo *postgres.DocumentRepository) *DocumentHandler {
        return &DocumentHandler{repo: repo}
}

// ─── Masters ──────────────────────────────────────────────────────────────────

func (h *DocumentHandler) ListKinds(c *gin.Context) {
        items, err := h.repo.ListKinds()
        if err != nil { response.InternalError(c, err.Error()); return }
        if items == nil { items = []domain.DocumentMaster{} }
        response.OK(c, items)
}

func (h *DocumentHandler) ListCategories(c *gin.Context) {
        items, err := h.repo.ListCategories()
        if err != nil { response.InternalError(c, err.Error()); return }
        if items == nil { items = []domain.DocumentMaster{} }
        response.OK(c, items)
}

func (h *DocumentHandler) ListTypes(c *gin.Context) {
        items, err := h.repo.ListTypes()
        if err != nil { response.InternalError(c, err.Error()); return }
        if items == nil { items = []domain.DocumentType{} }
        response.OK(c, items)
}

type masterRequest struct {
        Name string `json:"name" binding:"required"`
}
type typeRequest struct {
        Name      string `json:"name" binding:"required"`
        Extension string `json:"extension"`
}

func (h *DocumentHandler) CreateKind(c *gin.Context) {
        var req masterRequest
        if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
        m, err := h.repo.CreateKind(req.Name)
        if err != nil { response.InternalError(c, err.Error()); return }
        response.Created(c, m)
}

func (h *DocumentHandler) CreateCategory(c *gin.Context) {
        var req masterRequest
        if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
        m, err := h.repo.CreateCategory(req.Name)
        if err != nil { response.InternalError(c, err.Error()); return }
        response.Created(c, m)
}

func (h *DocumentHandler) CreateType(c *gin.Context) {
        var req typeRequest
        if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
        dt, err := h.repo.CreateType(req.Name, req.Extension)
        if err != nil { response.InternalError(c, err.Error()); return }
        response.Created(c, dt)
}

func (h *DocumentHandler) UpdateKind(c *gin.Context) {
        var req masterRequest
        if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
        m, err := h.repo.UpdateKind(c.Param("id"), req.Name)
        if err != nil { response.InternalError(c, err.Error()); return }
        if m == nil { response.NotFound(c, "jenis tidak ditemukan"); return }
        response.OK(c, m)
}
func (h *DocumentHandler) DeleteKind(c *gin.Context) {
        if err := h.repo.DeleteKind(c.Param("id")); err != nil { response.InternalError(c, err.Error()); return }
        response.OK(c, gin.H{"message": "jenis dihapus"})
}
func (h *DocumentHandler) UpdateCategory(c *gin.Context) {
        var req masterRequest
        if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
        m, err := h.repo.UpdateCategory(c.Param("id"), req.Name)
        if err != nil { response.InternalError(c, err.Error()); return }
        if m == nil { response.NotFound(c, "kategori tidak ditemukan"); return }
        response.OK(c, m)
}
func (h *DocumentHandler) DeleteCategory(c *gin.Context) {
        if err := h.repo.DeleteCategory(c.Param("id")); err != nil { response.InternalError(c, err.Error()); return }
        response.OK(c, gin.H{"message": "kategori dihapus"})
}
func (h *DocumentHandler) UpdateType(c *gin.Context) {
        var req typeRequest
        if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
        dt, err := h.repo.UpdateType(c.Param("id"), req.Name, req.Extension)
        if err != nil { response.InternalError(c, err.Error()); return }
        if dt == nil { response.NotFound(c, "tipe tidak ditemukan"); return }
        response.OK(c, dt)
}
func (h *DocumentHandler) DeleteType(c *gin.Context) {
        if err := h.repo.DeleteType(c.Param("id")); err != nil { response.InternalError(c, err.Error()); return }
        response.OK(c, gin.H{"message": "tipe dihapus"})
}

// ─── Documents ────────────────────────────────────────────────────────────────

// GET /api/admin/documents  or  GET /api/documents (public, only terbuka)
func (h *DocumentHandler) List(c *gin.Context, adminMode bool) {
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

        f := postgres.DocumentFilter{
                Status:      c.Query("status"),
                AccessLevel: c.Query("access_level"),
                CategoryID:  c.Query("category_id"),
                TypeID:      c.Query("type_id"),
                KindID:      c.Query("kind_id"),
                Search:      c.Query("search"),
                Trash:       c.Query("trash") == "true",
                Page: page, Limit: limit,
        }

        // Public API: only show terbuka + published
        if !adminMode {
                f.AccessLevel = "terbuka"
                f.Status = "published"
        }

        items, total, err := h.repo.List(f)
        if err != nil { response.InternalError(c, err.Error()); return }
        if items == nil { items = []domain.Document{} }
        response.OK(c, domain.PaginatedResult[domain.Document]{Items: items, Total: total, Page: page, Limit: limit})
}

func (h *DocumentHandler) AdminList(c *gin.Context) { h.List(c, true) }
func (h *DocumentHandler) PublicList(c *gin.Context) { h.List(c, false) }

func (h *DocumentHandler) GetByID(c *gin.Context) {
        doc, err := h.repo.FindByID(c.Param("id"))
        if err != nil { response.InternalError(c, err.Error()); return }
        if doc == nil { response.NotFound(c, "dokumen tidak ditemukan"); return }
        response.OK(c, doc)
}

type documentRequest struct {
        Title       string  `json:"title" binding:"required"`
        DocNo       *string `json:"doc_no"`
        KindID      *string `json:"kind_id"`
        CategoryID  *string `json:"category_id"`
        TypeID      *string `json:"type_id"`
        Publisher   *string `json:"publisher"`
        Content     *string `json:"content"`
        FileURL     *string `json:"file_url"`
        AccessLevel string  `json:"access_level"`
        PublishedAt *string `json:"published_at"`
        Status      string  `json:"status"`
}

// POST /api/admin/documents
func (h *DocumentHandler) Create(c *gin.Context) {
        var req documentRequest
        if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }

        al := domain.AccessLevel(req.AccessLevel); if al == "" { al = domain.AccessLevelTerbuka }
        st := domain.NewsStatus(req.Status); if st == "" { st = domain.NewsStatusDraft }

        input := postgres.DocumentInput{
                Title: req.Title, DocNo: req.DocNo, KindID: req.KindID, CategoryID: req.CategoryID,
                TypeID: req.TypeID, Publisher: req.Publisher, Content: req.Content,
                FileURL: req.FileURL, AccessLevel: al, Status: st,
                PublishedAt: parseTime(req.PublishedAt),
        }
        doc, err := h.repo.Create(input)
        if err != nil { response.InternalError(c, err.Error()); return }
        response.Created(c, doc)
}

// PATCH /api/admin/documents/:id
func (h *DocumentHandler) Update(c *gin.Context) {
        var req documentRequest
        if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }

        al := domain.AccessLevel(req.AccessLevel); if al == "" { al = domain.AccessLevelTerbuka }
        st := domain.NewsStatus(req.Status); if st == "" { st = domain.NewsStatusDraft }

        input := postgres.DocumentInput{
                Title: req.Title, DocNo: req.DocNo, KindID: req.KindID, CategoryID: req.CategoryID,
                TypeID: req.TypeID, Publisher: req.Publisher, Content: req.Content,
                FileURL: req.FileURL, AccessLevel: al, Status: st,
                PublishedAt: parseTime(req.PublishedAt),
        }
        doc, err := h.repo.Update(c.Param("id"), input)
        if err != nil { response.InternalError(c, err.Error()); return }
        if doc == nil { response.NotFound(c, "dokumen tidak ditemukan"); return }
        response.OK(c, doc)
}

// DELETE /api/admin/documents/:id
func (h *DocumentHandler) SoftDelete(c *gin.Context) {
        if err := h.repo.SoftDelete(c.Param("id")); err != nil { response.InternalError(c, err.Error()); return }
        response.OK(c, gin.H{"message": "dokumen dipindahkan ke trash"})
}

// POST /api/admin/documents/:id/restore
func (h *DocumentHandler) Restore(c *gin.Context) {
        if err := h.repo.Restore(c.Param("id")); err != nil { response.InternalError(c, err.Error()); return }
        response.OK(c, gin.H{"message": "dokumen dipulihkan"})
}

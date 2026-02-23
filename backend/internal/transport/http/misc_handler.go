// Package http contains handlers for surveys, suggestions, final reports, letter templates, news categories.
package http

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bapperida/portal/internal/domain"
	"github.com/bapperida/portal/internal/middleware"
	"github.com/bapperida/portal/internal/pkg/response"
	"github.com/bapperida/portal/internal/repository/postgres"
)

// ─── News Category Handler ────────────────────────────────────────────────────

type NewsCategoryHandler struct {
	repo *postgres.NewsCategoryRepository
}

func NewNewsCategoryHandler(repo *postgres.NewsCategoryRepository) *NewsCategoryHandler {
	return &NewsCategoryHandler{repo: repo}
}

func (h *NewsCategoryHandler) List(c *gin.Context) {
	items, err := h.repo.List()
	if err != nil { response.InternalError(c, err.Error()); return }
	if items == nil { items = []domain.NewsCategory{} }
	response.OK(c, items)
}

type newsCatRequest struct {
	Name        string  `json:"name" binding:"required"`
	Slug        string  `json:"slug" binding:"required"`
	Description *string `json:"description"`
}

func (h *NewsCategoryHandler) Create(c *gin.Context) {
	var req newsCatRequest
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
	cat, err := h.repo.Create(req.Name, req.Slug, req.Description)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.Created(c, cat)
}

func (h *NewsCategoryHandler) Update(c *gin.Context) {
	var req newsCatRequest
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
	cat, err := h.repo.Update(c.Param("id"), req.Name, req.Slug, req.Description)
	if err != nil { response.InternalError(c, err.Error()); return }
	if cat == nil { response.NotFound(c, "kategori tidak ditemukan"); return }
	response.OK(c, cat)
}

func (h *NewsCategoryHandler) Delete(c *gin.Context) {
	if err := h.repo.Delete(c.Param("id")); err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, gin.H{"message": "kategori dihapus"})
}

// ─── Survey Handler ───────────────────────────────────────────────────────────

type SurveyHandler struct {
	repo *postgres.SurveyRepository
}

func NewSurveyHandler(repo *postgres.SurveyRepository) *SurveyHandler {
	return &SurveyHandler{repo: repo}
}

func (h *SurveyHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	items, total, err := h.repo.List(postgres.SurveyFilter{Search: c.Query("search"), Page: page, Limit: limit})
	if err != nil { response.InternalError(c, err.Error()); return }
	if items == nil { items = []domain.Survey{} }
	response.OK(c, domain.PaginatedResult[domain.Survey]{Items: items, Total: total, Page: page, Limit: limit})
}

func (h *SurveyHandler) Create(c *gin.Context) {
	var s domain.Survey
	if err := c.ShouldBindJSON(&s); err != nil { response.BadRequest(c, err.Error()); return }
	created, err := h.repo.Create(s)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.Created(c, created)
}

// ─── Final Report Handler ─────────────────────────────────────────────────────

type FinalReportHandler struct {
	repo *postgres.FinalReportRepository
}

func NewFinalReportHandler(repo *postgres.FinalReportRepository) *FinalReportHandler {
	return &FinalReportHandler{repo: repo}
}

func (h *FinalReportHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	items, total, err := h.repo.List(postgres.FinalReportFilter{Search: c.Query("search"), Page: page, Limit: limit})
	if err != nil { response.InternalError(c, err.Error()); return }
	if items == nil { items = []domain.FinalReport{} }
	response.OK(c, domain.PaginatedResult[domain.FinalReport]{Items: items, Total: total, Page: page, Limit: limit})
}

func (h *FinalReportHandler) Create(c *gin.Context) {
	var fr domain.FinalReport
	if err := c.ShouldBindJSON(&fr); err != nil { response.BadRequest(c, err.Error()); return }
	created, err := h.repo.Create(fr)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.Created(c, created)
}

// ─── Suggestion Handler ───────────────────────────────────────────────────────

type SuggestionHandler struct {
	repo *postgres.SuggestionRepository
}

func NewSuggestionHandler(repo *postgres.SuggestionRepository) *SuggestionHandler {
	return &SuggestionHandler{repo: repo}
}

func (h *SuggestionHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	items, total, err := h.repo.List(postgres.SuggestionFilter{Page: page, Limit: limit})
	if err != nil { response.InternalError(c, err.Error()); return }
	if items == nil { items = []domain.Suggestion{} }
	response.OK(c, domain.PaginatedResult[domain.Suggestion]{Items: items, Total: total, Page: page, Limit: limit})
}

type suggestionRequest struct {
	Name    *string `json:"name"`
	Email   *string `json:"email"`
	Message string  `json:"message" binding:"required"`
}

func (h *SuggestionHandler) Create(c *gin.Context) {
	var req suggestionRequest
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
	s, err := h.repo.Create(req.Name, req.Email, req.Message)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.Created(c, s)
}

// ─── Letter Template Handler ──────────────────────────────────────────────────

type LetterTemplateHandler struct {
	repo *postgres.LetterTemplateRepository
}

func NewLetterTemplateHandler(repo *postgres.LetterTemplateRepository) *LetterTemplateHandler {
	return &LetterTemplateHandler{repo: repo}
}

func (h *LetterTemplateHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	var isActive *bool
	if v := c.Query("is_active"); v != "" {
		b := v == "true"; isActive = &b
	}

	items, total, err := h.repo.List(postgres.LetterTemplateFilter{
		Search: c.Query("search"), IsActive: isActive, Page: page, Limit: limit,
	})
	if err != nil { response.InternalError(c, err.Error()); return }
	if items == nil { items = []domain.LetterTemplate{} }
	response.OK(c, domain.PaginatedResult[domain.LetterTemplate]{Items: items, Total: total, Page: page, Limit: limit})
}

func (h *LetterTemplateHandler) GetByID(c *gin.Context) {
	lt, err := h.repo.FindByID(c.Param("id"))
	if err != nil { response.InternalError(c, err.Error()); return }
	if lt == nil { response.NotFound(c, "template tidak ditemukan"); return }
	response.OK(c, lt)
}

type letterTemplateRequest struct {
	Name         string  `json:"name" binding:"required"`
	Type         string  `json:"type"`
	Content      string  `json:"content" binding:"required"`
	Placeholders *string `json:"placeholders"`
	IsActive     bool    `json:"is_active"`
}

func (h *LetterTemplateHandler) Create(c *gin.Context) {
	var req letterTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
	claims := middleware.GetClaims(c)
	var createdBy *string
	if claims != nil { createdBy = &claims.ID }
	templateType := req.Type; if templateType == "" { templateType = "research_permit" }
	lt, err := h.repo.Create(req.Name, templateType, req.Content, req.Placeholders, req.IsActive, createdBy)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.Created(c, lt)
}

func (h *LetterTemplateHandler) Update(c *gin.Context) {
	var req letterTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
	claims := middleware.GetClaims(c)
	var updatedBy *string
	if claims != nil { updatedBy = &claims.ID }
	templateType := req.Type; if templateType == "" { templateType = "research_permit" }
	lt, err := h.repo.Update(c.Param("id"), req.Name, templateType, req.Content, req.Placeholders, req.IsActive, updatedBy)
	if err != nil { response.InternalError(c, err.Error()); return }
	if lt == nil { response.NotFound(c, "template tidak ditemukan"); return }
	response.OK(c, lt)
}

// ─── User Handler ─────────────────────────────────────────────────────────────

type UserHandler struct {
	repo *postgres.UserRepository
}

func NewUserHandler(repo *postgres.UserRepository) *UserHandler {
	return &UserHandler{repo: repo}
}

func (h *UserHandler) List(c *gin.Context) {
	users, err := h.repo.List()
	if err != nil { response.InternalError(c, err.Error()); return }
	if users == nil { users = []domain.User{} }
	response.OK(c, users)
}

type createUserRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	FullName string `json:"full_name" binding:"required"`
	Password string `json:"password" binding:"required,min=8"`
	Role     string `json:"role" binding:"required"`
}

func (h *UserHandler) Create(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
	u, err := h.repo.Create(req.Username, req.Email, req.FullName, req.Password, domain.Role(req.Role))
	if err != nil { response.InternalError(c, "gagal membuat pengguna: "+err.Error()); return }
	response.Created(c, u)
}

type updateUserRequest struct {
	FullName string `json:"full_name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Role     string `json:"role" binding:"required"`
	IsActive bool   `json:"is_active"`
}

func (h *UserHandler) Update(c *gin.Context) {
	var req updateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
	u, err := h.repo.Update(c.Param("id"), req.FullName, req.Email, domain.Role(req.Role), req.IsActive)
	if err != nil { response.InternalError(c, err.Error()); return }
	if u == nil { response.NotFound(c, "pengguna tidak ditemukan"); return }
	response.OK(c, u)
}

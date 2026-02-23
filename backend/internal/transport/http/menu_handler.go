package http

import (
	"github.com/gin-gonic/gin"

	"github.com/bapperida/portal/internal/domain"
	"github.com/bapperida/portal/internal/pkg/response"
	"github.com/bapperida/portal/internal/repository/postgres"
)

type MenuHandler struct {
	repo *postgres.MenuRepository
}

func NewMenuHandler(repo *postgres.MenuRepository) *MenuHandler {
	return &MenuHandler{repo: repo}
}

// GET /api/admin/menus  or GET /api/menus (public with location filter)
func (h *MenuHandler) List(c *gin.Context) {
	location := c.Query("location")
	activeOnly := c.Query("active_only") == "true"
	items, err := h.repo.List(location, activeOnly)
	if err != nil { response.InternalError(c, err.Error()); return }
	if items == nil { items = []domain.Menu{} }
	response.OK(c, items)
}

// GET /api/menus/:location (public - for Flutter)
func (h *MenuHandler) GetByLocation(c *gin.Context) {
	items, err := h.repo.List(c.Param("location"), true)
	if err != nil { response.InternalError(c, err.Error()); return }
	if items == nil { items = []domain.Menu{} }
	// Load items for each menu
	var result []domain.Menu
	for _, m := range items {
		full, _ := h.repo.FindByID(m.ID)
		if full != nil { result = append(result, *full) }
	}
	if result == nil { result = []domain.Menu{} }
	response.OK(c, result)
}

// GET /api/admin/menus/:id
func (h *MenuHandler) GetByID(c *gin.Context) {
	m, err := h.repo.FindByID(c.Param("id"))
	if err != nil { response.InternalError(c, err.Error()); return }
	if m == nil { response.NotFound(c, "menu tidak ditemukan"); return }
	response.OK(c, m)
}

type menuRequest struct {
	Name     string `json:"name" binding:"required"`
	Location string `json:"location" binding:"required"`
	IsActive bool   `json:"is_active"`
}

// POST /api/admin/menus
func (h *MenuHandler) Create(c *gin.Context) {
	var req menuRequest
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
	m, err := h.repo.Create(req.Name, domain.MenuLocation(req.Location), req.IsActive)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.Created(c, m)
}

// PATCH /api/admin/menus/:id
func (h *MenuHandler) Update(c *gin.Context) {
	var req menuRequest
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
	m, err := h.repo.Update(c.Param("id"), req.Name, domain.MenuLocation(req.Location), req.IsActive)
	if err != nil { response.InternalError(c, err.Error()); return }
	if m == nil { response.NotFound(c, "menu tidak ditemukan"); return }
	response.OK(c, m)
}

// DELETE /api/admin/menus/:id
func (h *MenuHandler) Delete(c *gin.Context) {
	if err := h.repo.SoftDelete(c.Param("id")); err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, gin.H{"message": "menu dihapus"})
}

// ─── Menu Items ───────────────────────────────────────────────────────────────

type menuItemRequest struct {
	MenuID      string  `json:"menu_id" binding:"required"`
	ParentID    *string `json:"parent_id"`
	Title       string  `json:"title" binding:"required"`
	Type        string  `json:"type"`
	Value       *string `json:"value"`
	Icon        *string `json:"icon"`
	Target      string  `json:"target"`
	RequiresAuth bool   `json:"requires_auth"`
	SortOrder   int     `json:"sort_order"`
}

// POST /api/admin/menus/:id/items
func (h *MenuHandler) CreateItem(c *gin.Context) {
	var req menuItemRequest
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
	req.MenuID = c.Param("id")
	target := req.Target; if target == "" { target = "_self" }
	input := postgres.MenuItemInput{
		MenuID: req.MenuID, ParentID: req.ParentID, Title: req.Title,
		Type: domain.MenuItemType(req.Type), Value: req.Value, Icon: req.Icon,
		Target: target, RequiresAuth: req.RequiresAuth, SortOrder: req.SortOrder,
	}
	item, err := h.repo.CreateItem(input)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.Created(c, item)
}

// PATCH /api/admin/menu-items/:id
func (h *MenuHandler) UpdateItem(c *gin.Context) {
	var req menuItemRequest
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, err.Error()); return }
	target := req.Target; if target == "" { target = "_self" }
	input := postgres.MenuItemInput{
		MenuID: req.MenuID, ParentID: req.ParentID, Title: req.Title,
		Type: domain.MenuItemType(req.Type), Value: req.Value, Icon: req.Icon,
		Target: target, RequiresAuth: req.RequiresAuth, SortOrder: req.SortOrder,
	}
	item, err := h.repo.UpdateItem(c.Param("id"), input)
	if err != nil { response.InternalError(c, err.Error()); return }
	if item == nil { response.NotFound(c, "menu item tidak ditemukan"); return }
	response.OK(c, item)
}

// DELETE /api/admin/menu-items/:id
func (h *MenuHandler) DeleteItem(c *gin.Context) {
	if err := h.repo.DeleteItem(c.Param("id")); err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, gin.H{"message": "menu item dihapus"})
}

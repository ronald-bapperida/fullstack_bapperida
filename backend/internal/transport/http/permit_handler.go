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

type PermitHandler struct {
	uc *usecase.PermitUsecase
}

func NewPermitHandler(uc *usecase.PermitUsecase) *PermitHandler {
	return &PermitHandler{uc: uc}
}

// GET /api/admin/permits
func (h *PermitHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	f := postgres.PermitFilter{
		Status: c.Query("status"),
		Search: c.Query("search"),
		Page: page, Limit: limit,
	}
	result, err := h.uc.List(f)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, result)
}

// GET /api/admin/permits/:id
func (h *PermitHandler) GetByID(c *gin.Context) {
	p, err := h.uc.GetByID(c.Param("id"))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.OK(c, p)
}

type submitPermitRequest struct {
	Email                string `json:"email" binding:"required,email"`
	FullName             string `json:"full_name" binding:"required"`
	NimNik               string `json:"nim_nik" binding:"required"`
	BirthPlace           string `json:"birth_place" binding:"required"`
	WorkUnit             string `json:"work_unit" binding:"required"`
	Institution          string `json:"institution" binding:"required"`
	PhoneWA              string `json:"phone_wa" binding:"required"`
	Citizenship          string `json:"citizenship" binding:"required"`
	ResearchLocation     string `json:"research_location" binding:"required"`
	ResearchDuration     string `json:"research_duration" binding:"required"`
	ResearchTitle        string `json:"research_title" binding:"required"`
	SignerPosition        string `json:"signer_position" binding:"required"`
	IntroLetterNumber    string `json:"intro_letter_number" binding:"required"`
	IntroLetterDate      string `json:"intro_letter_date" binding:"required"`
	AgreementFinalReport bool   `json:"agreement_final_report"`
}

// POST /api/permits  (public)
func (h *PermitHandler) Submit(c *gin.Context) {
	var req submitPermitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	letterDate, err := time.Parse("2006-01-02", req.IntroLetterDate)
	if err != nil {
		response.BadRequest(c, "format tanggal surat pengantar harus YYYY-MM-DD")
		return
	}

	p, err := h.uc.Submit(postgres.CreatePermitInput{
		Email:                req.Email,
		FullName:             req.FullName,
		NimNik:               req.NimNik,
		BirthPlace:           req.BirthPlace,
		WorkUnit:             req.WorkUnit,
		Institution:          req.Institution,
		PhoneWA:              req.PhoneWA,
		Citizenship:          req.Citizenship,
		ResearchLocation:     req.ResearchLocation,
		ResearchDuration:     req.ResearchDuration,
		ResearchTitle:        req.ResearchTitle,
		SignerPosition:        req.SignerPosition,
		IntroLetterNumber:    req.IntroLetterNumber,
		IntroLetterDate:      letterDate,
		AgreementFinalReport: req.AgreementFinalReport,
	})
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Created(c, p)
}

type updateStatusRequest struct {
	Status string  `json:"status" binding:"required"`
	Note   *string `json:"note"`
}

// PATCH /api/admin/permits/:id/status
func (h *PermitHandler) UpdateStatus(c *gin.Context) {
	var req updateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetClaims(c)
	processedBy := &claims.ID

	if err := h.uc.UpdateStatus(c.Param("id"), domain.PermitStatus(req.Status), req.Note, processedBy); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, gin.H{"message": "status berhasil diperbarui"})
}

package usecase

import (
	"fmt"

	"github.com/bapperida/portal/internal/domain"
	"github.com/bapperida/portal/internal/repository/postgres"
)

type PermitUsecase struct {
	repo *postgres.PermitRepository
}

func NewPermitUsecase(repo *postgres.PermitRepository) *PermitUsecase {
	return &PermitUsecase{repo: repo}
}

func (u *PermitUsecase) List(f postgres.PermitFilter) (domain.PaginatedResult[domain.ResearchPermit], error) {
	items, total, err := u.repo.List(f)
	if err != nil {
		return domain.PaginatedResult[domain.ResearchPermit]{}, err
	}
	if items == nil {
		items = []domain.ResearchPermit{}
	}
	return domain.PaginatedResult[domain.ResearchPermit]{
		Items: items, Total: total, Page: f.Page, Limit: f.Limit,
	}, nil
}

func (u *PermitUsecase) GetByID(id string) (*domain.ResearchPermit, error) {
	p, err := u.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, fmt.Errorf("izin penelitian tidak ditemukan")
	}
	return p, nil
}

func (u *PermitUsecase) Submit(input postgres.CreatePermitInput) (*domain.ResearchPermit, error) {
	if input.FullName == "" || input.Email == "" {
		return nil, fmt.Errorf("nama dan email wajib diisi")
	}
	if input.ResearchTitle == "" {
		return nil, fmt.Errorf("judul penelitian wajib diisi")
	}
	return u.repo.Create(input)
}

func (u *PermitUsecase) UpdateStatus(id string, status domain.PermitStatus, note *string, processedBy *string) error {
	// Validate status transition
	current, err := u.repo.FindByID(id)
	if err != nil || current == nil {
		return fmt.Errorf("izin penelitian tidak ditemukan")
	}

	valid := isValidTransition(current.Status, status)
	if !valid {
		return fmt.Errorf("transisi status dari '%s' ke '%s' tidak diizinkan", current.Status, status)
	}

	return u.repo.UpdateStatus(id, status, note, processedBy)
}

// isValidTransition defines allowed status transitions.
func isValidTransition(from, to domain.PermitStatus) bool {
	allowed := map[domain.PermitStatus][]domain.PermitStatus{
		domain.PermitStatusSubmitted:        {domain.PermitStatusInReview},
		domain.PermitStatusInReview:         {domain.PermitStatusApproved, domain.PermitStatusRevisionRequired, domain.PermitStatusRejected},
		domain.PermitStatusRevisionRequired: {domain.PermitStatusInReview},
		domain.PermitStatusApproved:         {domain.PermitStatusGeneratedLetter},
		domain.PermitStatusGeneratedLetter:  {domain.PermitStatusSent},
	}
	for _, allowed := range allowed[from] {
		if allowed == to {
			return true
		}
	}
	return false
}

package usecase

import (
        "fmt"

        "github.com/bapperida/portal/internal/domain"
        "github.com/bapperida/portal/internal/repository/postgres"
)

type NewsUsecase struct {
        repo *postgres.NewsRepository
}

func NewNewsUsecase(repo *postgres.NewsRepository) *NewsUsecase {
        return &NewsUsecase{repo: repo}
}

func (u *NewsUsecase) List(f postgres.NewsFilter) (domain.PaginatedResult[domain.News], error) {
        items, total, err := u.repo.List(f)
        if err != nil {
                return domain.PaginatedResult[domain.News]{}, err
        }
        if items == nil {
                items = []domain.News{}
        }
        return domain.PaginatedResult[domain.News]{
                Items: items, Total: total, Page: f.Page, Limit: f.Limit,
        }, nil
}

func (u *NewsUsecase) GetByID(id string) (*domain.News, error) {
        n, err := u.repo.FindByID(id)
        if err != nil {
                return nil, err
        }
        if n == nil {
                return nil, fmt.Errorf("berita tidak ditemukan")
        }
        return n, nil
}

func (u *NewsUsecase) Create(input postgres.CreateNewsInput) (*domain.News, error) {
        if input.Title == "" {
                return nil, fmt.Errorf("judul tidak boleh kosong")
        }
        if input.Content == "" {
                return nil, fmt.Errorf("konten tidak boleh kosong")
        }
        return u.repo.Create(input)
}

func (u *NewsUsecase) Update(id string, input postgres.UpdateNewsInput) (*domain.News, error) {
        if input.Title == "" {
                return nil, fmt.Errorf("judul tidak boleh kosong")
        }
        n, err := u.repo.Update(id, input)
        if err != nil {
                return nil, err
        }
        if n == nil {
                return nil, fmt.Errorf("berita tidak ditemukan")
        }
        return n, nil
}

func (u *NewsUsecase) SoftDelete(id string) error {
        return u.repo.SoftDelete(id)
}

func (u *NewsUsecase) Restore(id string) error {
        return u.repo.Restore(id)
}

func (u *NewsUsecase) HardDelete(id string) error {
        return u.repo.HardDelete(id)
}

// PublicList returns only published news (for Flutter mobile app)
func (u *NewsUsecase) PublicList(f postgres.NewsFilter) (domain.PaginatedResult[domain.News], error) {
        f.Status = string(domain.NewsStatusPublished)
        return u.List(f)
}

// GetBySlug returns a published news item by slug (for Flutter mobile app)
func (u *NewsUsecase) GetBySlug(slug string) (*domain.News, error) {
        n, err := u.repo.FindBySlug(slug)
        if err != nil {
                return nil, err
        }
        if n == nil {
                return nil, fmt.Errorf("berita tidak ditemukan")
        }
        // Increment view count asynchronously
        go u.repo.IncrementView(n.ID)
        return n, nil
}

package postgres

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/bapperida/portal/internal/domain"
)

type BannerRepository struct {
	db *sql.DB
}

func NewBannerRepository(db *sql.DB) *BannerRepository {
	return &BannerRepository{db: db}
}

const bannerCols = `
	id, title, slug, placement, image_desktop, image_mobile, alt_text,
	link_type, link_url, target, sort_order,
	start_at, end_at, is_active, view_count, click_count,
	deleted_at, created_at, updated_at`

func scanBanner(row interface{ Scan(...any) error }) (*domain.Banner, error) {
	b := &domain.Banner{}
	return b, row.Scan(
		&b.ID, &b.Title, &b.Slug, &b.Placement, &b.ImageDesktop, &b.ImageMobile, &b.AltText,
		&b.LinkType, &b.LinkURL, &b.Target, &b.SortOrder,
		&b.StartAt, &b.EndAt, &b.IsActive, &b.ViewCount, &b.ClickCount,
		&b.DeletedAt, &b.CreatedAt, &b.UpdatedAt,
	)
}

type BannerFilter struct {
	Placement string
	IsActive  *bool
	Trash     bool
	Search    string
	Page      int
	Limit     int
}

func (r *BannerRepository) List(f BannerFilter) ([]domain.Banner, int, error) {
	if f.Page < 1 { f.Page = 1 }
	if f.Limit < 1 { f.Limit = 10 }

	conditions := []string{}
	args := []interface{}{}
	i := 1

	if f.Trash {
		conditions = append(conditions, "deleted_at IS NOT NULL")
	} else {
		conditions = append(conditions, "deleted_at IS NULL")
	}
	if f.Placement != "" {
		conditions = append(conditions, fmt.Sprintf("placement = $%d", i))
		args = append(args, f.Placement); i++
	}
	if f.IsActive != nil {
		conditions = append(conditions, fmt.Sprintf("is_active = $%d", i))
		args = append(args, *f.IsActive); i++
	}
	if f.Search != "" {
		conditions = append(conditions, fmt.Sprintf("title ILIKE $%d", i))
		args = append(args, "%"+f.Search+"%"); i++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")
	var total int
	if err := r.db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM banners %s", where), args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (f.Page - 1) * f.Limit
	args = append(args, f.Limit, offset)
	q := fmt.Sprintf("SELECT %s FROM banners %s ORDER BY sort_order ASC, created_at DESC LIMIT $%d OFFSET $%d",
		bannerCols, where, i, i+1)

	rows, err := r.db.Query(q, args...)
	if err != nil { return nil, 0, err }
	defer rows.Close()

	var items []domain.Banner
	for rows.Next() {
		b, err := scanBanner(rows)
		if err != nil { return nil, 0, err }
		items = append(items, *b)
	}
	return items, total, nil
}

func (r *BannerRepository) ActiveByPlacement(placement string) ([]domain.Banner, error) {
	now := time.Now()
	q := fmt.Sprintf(`SELECT %s FROM banners 
		WHERE deleted_at IS NULL AND is_active = true AND placement = $1
		AND (start_at IS NULL OR start_at <= $2)
		AND (end_at IS NULL OR end_at >= $2)
		ORDER BY sort_order ASC`, bannerCols)
	rows, err := r.db.Query(q, placement, now)
	if err != nil { return nil, err }
	defer rows.Close()
	var items []domain.Banner
	for rows.Next() {
		b, err := scanBanner(rows)
		if err != nil { return nil, err }
		items = append(items, *b)
	}
	return items, nil
}

func (r *BannerRepository) FindByID(id string) (*domain.Banner, error) {
	q := fmt.Sprintf("SELECT %s FROM banners WHERE id=$1", bannerCols)
	b, err := scanBanner(r.db.QueryRow(q, id))
	if err == sql.ErrNoRows { return nil, nil }
	return b, err
}

type BannerInput struct {
	Title        string
	Slug         *string
	Placement    string
	ImageDesktop *string
	ImageMobile  *string
	AltText      *string
	LinkType     domain.BannerLinkType
	LinkURL      *string
	Target       string
	SortOrder    int
	StartAt      *time.Time
	EndAt        *time.Time
	IsActive     bool
}

func (r *BannerRepository) Create(input BannerInput) (*domain.Banner, error) {
	id := uuid.New().String()
	now := time.Now()
	q := fmt.Sprintf(`INSERT INTO banners
		(id, title, slug, placement, image_desktop, image_mobile, alt_text,
		 link_type, link_url, target, sort_order, start_at, end_at, is_active,
		 view_count, click_count, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,0,0,$15,$16)
		RETURNING %s`, bannerCols)
	return scanBanner(r.db.QueryRow(q,
		id, input.Title, input.Slug, input.Placement, input.ImageDesktop, input.ImageMobile, input.AltText,
		input.LinkType, input.LinkURL, input.Target, input.SortOrder, input.StartAt, input.EndAt, input.IsActive,
		now, now,
	))
}

func (r *BannerRepository) Update(id string, input BannerInput) (*domain.Banner, error) {
	q := fmt.Sprintf(`UPDATE banners SET
		title=$2, slug=$3, placement=$4, image_desktop=$5, image_mobile=$6, alt_text=$7,
		link_type=$8, link_url=$9, target=$10, sort_order=$11, start_at=$12, end_at=$13,
		is_active=$14, updated_at=$15
		WHERE id=$1 AND deleted_at IS NULL RETURNING %s`, bannerCols)
	b, err := scanBanner(r.db.QueryRow(q,
		id, input.Title, input.Slug, input.Placement, input.ImageDesktop, input.ImageMobile, input.AltText,
		input.LinkType, input.LinkURL, input.Target, input.SortOrder, input.StartAt, input.EndAt,
		input.IsActive, time.Now(),
	))
	if err == sql.ErrNoRows { return nil, nil }
	return b, err
}

func (r *BannerRepository) SoftDelete(id string) error {
	_, err := r.db.Exec(`UPDATE banners SET deleted_at=$2 WHERE id=$1`, id, time.Now())
	return err
}

func (r *BannerRepository) Restore(id string) error {
	_, err := r.db.Exec(`UPDATE banners SET deleted_at=NULL WHERE id=$1`, id)
	return err
}

func (r *BannerRepository) IncrementView(id string) error {
	_, err := r.db.Exec(`UPDATE banners SET view_count=view_count+1 WHERE id=$1`, id)
	return err
}

func (r *BannerRepository) IncrementClick(id string) error {
	_, err := r.db.Exec(`UPDATE banners SET click_count=click_count+1 WHERE id=$1`, id)
	return err
}

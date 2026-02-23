package postgres

import (
        "database/sql"
        "fmt"
        "strings"
        "time"

        "github.com/google/uuid"

        "github.com/bapperida/portal/internal/domain"
        "github.com/bapperida/portal/internal/pkg/slug"
)

type NewsRepository struct {
        db *sql.DB
}

func NewNewsRepository(db *sql.DB) *NewsRepository {
        return &NewsRepository{db: db}
}

const newsColumns = `
        id, title, slug, category_id, content, excerpt, url,
        featured_image, featured_caption, status, event_at, published_at,
        author_id, view_count, deleted_at, created_at, updated_at`

func scanNews(row interface{ Scan(...any) error }) (*domain.News, error) {
        n := &domain.News{}
        return n, row.Scan(
                &n.ID, &n.Title, &n.Slug, &n.CategoryID, &n.Content, &n.Excerpt, &n.URL,
                &n.FeaturedImage, &n.FeaturedCaption, &n.Status, &n.EventAt, &n.PublishedAt,
                &n.AuthorID, &n.ViewCount, &n.DeletedAt, &n.CreatedAt, &n.UpdatedAt,
        )
}

type NewsFilter struct {
        Status    string
        Trash     bool
        Search    string
        Page      int
        Limit     int
}

func (r *NewsRepository) List(f NewsFilter) ([]domain.News, int, error) {
        if f.Page < 1 {
                f.Page = 1
        }
        if f.Limit < 1 {
                f.Limit = 10
        }

        conditions := []string{}
        args := []interface{}{}
        i := 1

        if f.Trash {
                conditions = append(conditions, "deleted_at IS NOT NULL")
        } else {
                conditions = append(conditions, "deleted_at IS NULL")
        }

        if f.Status != "" {
                conditions = append(conditions, fmt.Sprintf("status = $%d", i))
                args = append(args, f.Status)
                i++
        }

        if f.Search != "" {
                conditions = append(conditions, fmt.Sprintf("(title ILIKE $%d OR excerpt ILIKE $%d)", i, i))
                args = append(args, "%"+f.Search+"%")
                i++
        }

        where := "WHERE " + strings.Join(conditions, " AND ")
        if len(conditions) == 0 {
                where = ""
        }

        // count
        var total int
        countQ := fmt.Sprintf("SELECT COUNT(*) FROM news %s", where)
        if err := r.db.QueryRow(countQ, args...).Scan(&total); err != nil {
                return nil, 0, err
        }

        // paginated query
        offset := (f.Page - 1) * f.Limit
        args = append(args, f.Limit, offset)
        q := fmt.Sprintf(`SELECT %s FROM news %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
                newsColumns, where, i, i+1)

        rows, err := r.db.Query(q, args...)
        if err != nil {
                return nil, 0, err
        }
        defer rows.Close()

        var items []domain.News
        for rows.Next() {
                n, err := scanNews(rows)
                if err != nil {
                        return nil, 0, err
                }
                items = append(items, *n)
        }
        return items, total, nil
}

func (r *NewsRepository) FindByID(id string) (*domain.News, error) {
        q := fmt.Sprintf("SELECT %s FROM news WHERE id = $1", newsColumns)
        n, err := scanNews(r.db.QueryRow(q, id))
        if err == sql.ErrNoRows {
                return nil, nil
        }
        return n, err
}

func (r *NewsRepository) FindBySlug(slug string) (*domain.News, error) {
        q := fmt.Sprintf("SELECT %s FROM news WHERE slug = $1 AND deleted_at IS NULL", newsColumns)
        n, err := scanNews(r.db.QueryRow(q, slug))
        if err == sql.ErrNoRows {
                return nil, nil
        }
        return n, err
}

func (r *NewsRepository) IncrementView(id string) error {
        _, err := r.db.Exec(`UPDATE news SET view_count=view_count+1 WHERE id=$1`, id)
        return err
}

type CreateNewsInput struct {
        Title           string
        CategoryID      *string
        Content         string
        Excerpt         *string
        URL             *string
        FeaturedImage   *string
        FeaturedCaption *string
        Status          domain.NewsStatus
        EventAt         *time.Time
        PublishedAt     *time.Time
        AuthorID        *string
}

func (r *NewsRepository) Create(input CreateNewsInput) (*domain.News, error) {
        id := uuid.New().String()
        s := slug.Generate(input.Title)
        now := time.Now()

        q := fmt.Sprintf(`INSERT INTO news
                (id, title, slug, category_id, content, excerpt, url, featured_image, featured_caption,
                 status, event_at, published_at, author_id, view_count, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,$14,$15)
                RETURNING %s`, newsColumns)

        return scanNews(r.db.QueryRow(q,
                id, input.Title, s, input.CategoryID, input.Content, input.Excerpt, input.URL,
                input.FeaturedImage, input.FeaturedCaption, input.Status, input.EventAt,
                input.PublishedAt, input.AuthorID, now, now,
        ))
}

type UpdateNewsInput struct {
        Title           string
        CategoryID      *string
        Content         string
        Excerpt         *string
        URL             *string
        FeaturedImage   *string
        FeaturedCaption *string
        Status          domain.NewsStatus
        EventAt         *time.Time
        PublishedAt     *time.Time
}

func (r *NewsRepository) Update(id string, input UpdateNewsInput) (*domain.News, error) {
        q := fmt.Sprintf(`UPDATE news SET
                title=$2, category_id=$3, content=$4, excerpt=$5, url=$6,
                featured_image=$7, featured_caption=$8, status=$9,
                event_at=$10, published_at=$11, updated_at=$12
                WHERE id=$1 AND deleted_at IS NULL RETURNING %s`, newsColumns)

        n, err := scanNews(r.db.QueryRow(q, id,
                input.Title, input.CategoryID, input.Content, input.Excerpt, input.URL,
                input.FeaturedImage, input.FeaturedCaption, input.Status,
                input.EventAt, input.PublishedAt, time.Now(),
        ))
        if err == sql.ErrNoRows {
                return nil, nil
        }
        return n, err
}

func (r *NewsRepository) SoftDelete(id string) error {
        _, err := r.db.Exec(`UPDATE news SET deleted_at=$2 WHERE id=$1`, id, time.Now())
        return err
}

func (r *NewsRepository) Restore(id string) error {
        _, err := r.db.Exec(`UPDATE news SET deleted_at=NULL WHERE id=$1`, id)
        return err
}

func (r *NewsRepository) HardDelete(id string) error {
        _, err := r.db.Exec(`DELETE FROM news WHERE id=$1`, id)
        return err
}

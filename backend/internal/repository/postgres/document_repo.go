package postgres

import (
        "database/sql"
        "fmt"
        "strings"
        "time"

        "github.com/google/uuid"

        "github.com/bapperida/portal/internal/domain"
)

type DocumentRepository struct {
        db *sql.DB
}

func NewDocumentRepository(db *sql.DB) *DocumentRepository {
        return &DocumentRepository{db: db}
}

// ─── Document Masters ─────────────────────────────────────────────────────────

func (r *DocumentRepository) ListKinds() ([]domain.DocumentMaster, error) {
        rows, err := r.db.Query(`SELECT id, name, created_at FROM document_kinds WHERE deleted_at IS NULL ORDER BY name`)
        if err != nil { return nil, err }
        defer rows.Close()
        var items []domain.DocumentMaster
        for rows.Next() {
                m := domain.DocumentMaster{}
                if err := rows.Scan(&m.ID, &m.Name, &m.CreatedAt); err != nil { return nil, err }
                items = append(items, m)
        }
        return items, nil
}

func (r *DocumentRepository) ListCategories() ([]domain.DocumentMaster, error) {
        rows, err := r.db.Query(`SELECT id, name, created_at FROM document_categories WHERE deleted_at IS NULL ORDER BY name`)
        if err != nil { return nil, err }
        defer rows.Close()
        var items []domain.DocumentMaster
        for rows.Next() {
                m := domain.DocumentMaster{}
                if err := rows.Scan(&m.ID, &m.Name, &m.CreatedAt); err != nil { return nil, err }
                items = append(items, m)
        }
        return items, nil
}

func (r *DocumentRepository) ListTypes() ([]domain.DocumentType, error) {
        rows, err := r.db.Query(`SELECT id, name, COALESCE(extension,''), created_at FROM document_types WHERE deleted_at IS NULL ORDER BY name`)
        if err != nil { return nil, err }
        defer rows.Close()
        var items []domain.DocumentType
        for rows.Next() {
                dt := domain.DocumentType{}
                if err := rows.Scan(&dt.ID, &dt.Name, &dt.Extension, &dt.CreatedAt); err != nil { return nil, err }
                items = append(items, dt)
        }
        return items, nil
}

func (r *DocumentRepository) CreateKind(name string) (*domain.DocumentMaster, error) {
        id := uuid.New().String()
        now := time.Now()
        m := &domain.DocumentMaster{}
        err := r.db.QueryRow(`INSERT INTO document_kinds (id, name, created_at) VALUES ($1,$2,$3) RETURNING id, name, created_at`,
                id, name, now).Scan(&m.ID, &m.Name, &m.CreatedAt)
        return m, err
}

func (r *DocumentRepository) CreateCategory(name string) (*domain.DocumentMaster, error) {
        id := uuid.New().String()
        now := time.Now()
        m := &domain.DocumentMaster{}
        err := r.db.QueryRow(`INSERT INTO document_categories (id, name, created_at) VALUES ($1,$2,$3) RETURNING id, name, created_at`,
                id, name, now).Scan(&m.ID, &m.Name, &m.CreatedAt)
        return m, err
}

func (r *DocumentRepository) CreateType(name, extension string) (*domain.DocumentType, error) {
        id := uuid.New().String()
        now := time.Now()
        dt := &domain.DocumentType{}
        err := r.db.QueryRow(`INSERT INTO document_types (id, name, extension, created_at) VALUES ($1,$2,$3,$4) RETURNING id, name, COALESCE(extension,''), created_at`,
                id, name, extension, now).Scan(&dt.ID, &dt.Name, &dt.Extension, &dt.CreatedAt)
        return dt, err
}

func (r *DocumentRepository) UpdateKind(id, name string) (*domain.DocumentMaster, error) {
        m := &domain.DocumentMaster{}
        err := r.db.QueryRow(`UPDATE document_kinds SET name=$1 WHERE id=$2 AND deleted_at IS NULL RETURNING id, name, created_at`, name, id).Scan(&m.ID, &m.Name, &m.CreatedAt)
        if err == sql.ErrNoRows { return nil, nil }
        return m, err
}
func (r *DocumentRepository) DeleteKind(id string) error {
        _, err := r.db.Exec(`UPDATE document_kinds SET deleted_at=NOW() WHERE id=$1`, id)
        return err
}
func (r *DocumentRepository) UpdateCategory(id, name string) (*domain.DocumentMaster, error) {
        m := &domain.DocumentMaster{}
        err := r.db.QueryRow(`UPDATE document_categories SET name=$1 WHERE id=$2 AND deleted_at IS NULL RETURNING id, name, created_at`, name, id).Scan(&m.ID, &m.Name, &m.CreatedAt)
        if err == sql.ErrNoRows { return nil, nil }
        return m, err
}
func (r *DocumentRepository) DeleteCategory(id string) error {
        _, err := r.db.Exec(`UPDATE document_categories SET deleted_at=NOW() WHERE id=$1`, id)
        return err
}
func (r *DocumentRepository) UpdateType(id, name, extension string) (*domain.DocumentType, error) {
        dt := &domain.DocumentType{}
        err := r.db.QueryRow(`UPDATE document_types SET name=$1, extension=$2 WHERE id=$3 AND deleted_at IS NULL RETURNING id, name, COALESCE(extension,''), created_at`, name, extension, id).Scan(&dt.ID, &dt.Name, &dt.Extension, &dt.CreatedAt)
        if err == sql.ErrNoRows { return nil, nil }
        return dt, err
}
func (r *DocumentRepository) DeleteType(id string) error {
        _, err := r.db.Exec(`UPDATE document_types SET deleted_at=NOW() WHERE id=$1`, id)
        return err
}

// ─── Documents ────────────────────────────────────────────────────────────────

const docCols = `
        d.id, d.title, d.doc_no, d.kind_id, d.category_id, d.type_id,
        d.publisher, d.content, d.file_url, d.file_path, d.access_level,
        d.published_at, d.status, d.deleted_at, d.created_at, d.updated_at,
        COALESCE(dk.name,'') as kind_name,
        COALESCE(dc.name,'') as category_name,
        COALESCE(dt.name,'') as type_name,
        COALESCE(dt.extension,'') as type_extension`

type DocumentFilter struct {
        Status      string
        AccessLevel string
        CategoryID  string
        TypeID      string
        KindID      string
        Search      string
        Trash       bool
        Page        int
        Limit       int
}

func (r *DocumentRepository) List(f DocumentFilter) ([]domain.Document, int, error) {
        if f.Page < 1 { f.Page = 1 }
        if f.Limit < 1 { f.Limit = 10 }

        conditions := []string{}
        args := []interface{}{}
        i := 1

        if f.Trash {
                conditions = append(conditions, "d.deleted_at IS NOT NULL")
        } else {
                conditions = append(conditions, "d.deleted_at IS NULL")
        }
        if f.Status != "" { conditions = append(conditions, fmt.Sprintf("d.status = $%d", i)); args = append(args, f.Status); i++ }
        if f.AccessLevel != "" { conditions = append(conditions, fmt.Sprintf("d.access_level = $%d", i)); args = append(args, f.AccessLevel); i++ }
        if f.CategoryID != "" { conditions = append(conditions, fmt.Sprintf("d.category_id = $%d", i)); args = append(args, f.CategoryID); i++ }
        if f.TypeID != "" { conditions = append(conditions, fmt.Sprintf("d.type_id = $%d", i)); args = append(args, f.TypeID); i++ }
        if f.KindID != "" { conditions = append(conditions, fmt.Sprintf("d.kind_id = $%d", i)); args = append(args, f.KindID); i++ }
        if f.Search != "" {
                conditions = append(conditions, fmt.Sprintf("(d.title ILIKE $%d OR d.doc_no ILIKE $%d)", i, i))
                args = append(args, "%"+f.Search+"%"); i++
        }

        where := "WHERE " + strings.Join(conditions, " AND ")

        joins := `LEFT JOIN document_kinds dk ON d.kind_id = dk.id
                LEFT JOIN document_categories dc ON d.category_id = dc.id
                LEFT JOIN document_types dt ON d.type_id = dt.id`

        var total int
        countQ := fmt.Sprintf("SELECT COUNT(*) FROM documents d %s %s", joins, where)
        if err := r.db.QueryRow(countQ, args...).Scan(&total); err != nil { return nil, 0, err }

        offset := (f.Page - 1) * f.Limit
        args = append(args, f.Limit, offset)
        q := fmt.Sprintf("SELECT %s FROM documents d %s %s ORDER BY d.created_at DESC LIMIT $%d OFFSET $%d",
                docCols, joins, where, i, i+1)

        rows, err := r.db.Query(q, args...)
        if err != nil { return nil, 0, err }
        defer rows.Close()

        var items []domain.Document
        for rows.Next() {
                doc := domain.Document{}
                if err := rows.Scan(
                        &doc.ID, &doc.Title, &doc.DocNo, &doc.KindID, &doc.CategoryID, &doc.TypeID,
                        &doc.Publisher, &doc.Content, &doc.FileURL, &doc.FilePath, &doc.AccessLevel,
                        &doc.PublishedAt, &doc.Status, &doc.DeletedAt, &doc.CreatedAt, &doc.UpdatedAt,
                        &doc.KindName, &doc.CategoryName, &doc.TypeName, &doc.TypeExtension,
                ); err != nil { return nil, 0, err }
                items = append(items, doc)
        }
        return items, total, nil
}

func (r *DocumentRepository) FindByID(id string) (*domain.Document, error) {
        joins := `LEFT JOIN document_kinds dk ON d.kind_id = dk.id
                LEFT JOIN document_categories dc ON d.category_id = dc.id
                LEFT JOIN document_types dt ON d.type_id = dt.id`
        q := fmt.Sprintf("SELECT %s FROM documents d %s WHERE d.id=$1", docCols, joins)

        doc := &domain.Document{}
        err := r.db.QueryRow(q, id).Scan(
                &doc.ID, &doc.Title, &doc.DocNo, &doc.KindID, &doc.CategoryID, &doc.TypeID,
                &doc.Publisher, &doc.Content, &doc.FileURL, &doc.FilePath, &doc.AccessLevel,
                &doc.PublishedAt, &doc.Status, &doc.DeletedAt, &doc.CreatedAt, &doc.UpdatedAt,
                &doc.KindName, &doc.CategoryName, &doc.TypeName, &doc.TypeExtension,
        )
        if err == sql.ErrNoRows { return nil, nil }
        return doc, err
}

type DocumentInput struct {
        Title       string
        DocNo       *string
        KindID      *string
        CategoryID  *string
        TypeID      *string
        Publisher   *string
        Content     *string
        FileURL     *string
        FilePath    *string
        AccessLevel domain.AccessLevel
        PublishedAt *time.Time
        Status      domain.NewsStatus
}

func (r *DocumentRepository) Create(input DocumentInput) (*domain.Document, error) {
        id := uuid.New().String()
        now := time.Now()
        q := `INSERT INTO documents
                (id, title, doc_no, kind_id, category_id, type_id, publisher, content, file_url, file_path,
                 access_level, published_at, status, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`
        var newID string
        err := r.db.QueryRow(q,
                id, input.Title, input.DocNo, input.KindID, input.CategoryID, input.TypeID,
                input.Publisher, input.Content, input.FileURL, input.FilePath,
                input.AccessLevel, input.PublishedAt, input.Status, now, now,
        ).Scan(&newID)
        if err != nil { return nil, err }
        return r.FindByID(newID)
}

func (r *DocumentRepository) Update(id string, input DocumentInput) (*domain.Document, error) {
        q := `UPDATE documents SET
                title=$2, doc_no=$3, kind_id=$4, category_id=$5, type_id=$6, publisher=$7, content=$8,
                file_url=$9, file_path=$10, access_level=$11, published_at=$12, status=$13, updated_at=$14
                WHERE id=$1 AND deleted_at IS NULL RETURNING id`
        var updatedID string
        err := r.db.QueryRow(q,
                id, input.Title, input.DocNo, input.KindID, input.CategoryID, input.TypeID,
                input.Publisher, input.Content, input.FileURL, input.FilePath,
                input.AccessLevel, input.PublishedAt, input.Status, time.Now(),
        ).Scan(&updatedID)
        if err == sql.ErrNoRows { return nil, nil }
        if err != nil { return nil, err }
        return r.FindByID(updatedID)
}

func (r *DocumentRepository) SoftDelete(id string) error {
        _, err := r.db.Exec(`UPDATE documents SET deleted_at=$2 WHERE id=$1`, id, time.Now())
        return err
}

func (r *DocumentRepository) Restore(id string) error {
        _, err := r.db.Exec(`UPDATE documents SET deleted_at=NULL WHERE id=$1`, id)
        return err
}

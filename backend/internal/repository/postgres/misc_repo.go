// Package postgres contains repositories for surveys, final reports, suggestions, letter templates, news categories.
package postgres

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/bapperida/portal/internal/domain"
)

// ─── News Categories ──────────────────────────────────────────────────────────

type NewsCategoryRepository struct {
	db *sql.DB
}

func NewNewsCategoryRepository(db *sql.DB) *NewsCategoryRepository {
	return &NewsCategoryRepository{db: db}
}

func (r *NewsCategoryRepository) List() ([]domain.NewsCategory, error) {
	rows, err := r.db.Query(`SELECT id, name, slug, description, deleted_at, created_at FROM news_categories WHERE deleted_at IS NULL ORDER BY name`)
	if err != nil { return nil, err }
	defer rows.Close()
	var items []domain.NewsCategory
	for rows.Next() {
		c := domain.NewsCategory{}
		if err := rows.Scan(&c.ID, &c.Name, &c.Slug, &c.Description, &c.DeletedAt, &c.CreatedAt); err != nil { return nil, err }
		items = append(items, c)
	}
	return items, nil
}

func (r *NewsCategoryRepository) Create(name, slug string, description *string) (*domain.NewsCategory, error) {
	id := uuid.New().String()
	now := time.Now()
	c := &domain.NewsCategory{}
	err := r.db.QueryRow(`INSERT INTO news_categories (id, name, slug, description, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, slug, description, deleted_at, created_at`,
		id, name, slug, description, now).Scan(&c.ID, &c.Name, &c.Slug, &c.Description, &c.DeletedAt, &c.CreatedAt)
	return c, err
}

func (r *NewsCategoryRepository) Update(id, name, slug string, description *string) (*domain.NewsCategory, error) {
	c := &domain.NewsCategory{}
	err := r.db.QueryRow(`UPDATE news_categories SET name=$2, slug=$3, description=$4 WHERE id=$1 RETURNING id, name, slug, description, deleted_at, created_at`,
		id, name, slug, description).Scan(&c.ID, &c.Name, &c.Slug, &c.Description, &c.DeletedAt, &c.CreatedAt)
	if err == sql.ErrNoRows { return nil, nil }
	return c, err
}

func (r *NewsCategoryRepository) Delete(id string) error {
	_, err := r.db.Exec(`UPDATE news_categories SET deleted_at=$2 WHERE id=$1`, id, time.Now())
	return err
}

// ─── Surveys ──────────────────────────────────────────────────────────────────

type SurveyRepository struct {
	db *sql.DB
}

func NewSurveyRepository(db *sql.DB) *SurveyRepository {
	return &SurveyRepository{db: db}
}

type SurveyFilter struct {
	Search string
	Page   int
	Limit  int
}

func (r *SurveyRepository) List(f SurveyFilter) ([]domain.Survey, int, error) {
	if f.Page < 1 { f.Page = 1 }
	if f.Limit < 1 { f.Limit = 10 }

	args := []interface{}{}
	i := 1
	where := ""
	if f.Search != "" {
		where = fmt.Sprintf("WHERE respondent_name ILIKE $%d", i)
		args = append(args, "%"+f.Search+"%"); i++
	}

	var total int
	r.db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM surveys %s", where), args...).Scan(&total)

	offset := (f.Page - 1) * f.Limit
	args = append(args, f.Limit, offset)
	q := fmt.Sprintf(`SELECT id, respondent_name, age, gender, education, occupation,
		q1,q2,q3,q4,q5,q6,q7,q8,q9, suggestion, created_at
		FROM surveys %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, i, i+1)

	rows, err := r.db.Query(q, args...)
	if err != nil { return nil, 0, err }
	defer rows.Close()

	var items []domain.Survey
	for rows.Next() {
		s := domain.Survey{}
		if err := rows.Scan(&s.ID, &s.RespondentName, &s.Age, &s.Gender, &s.Education, &s.Occupation,
			&s.Q1, &s.Q2, &s.Q3, &s.Q4, &s.Q5, &s.Q6, &s.Q7, &s.Q8, &s.Q9,
			&s.Suggestion, &s.CreatedAt); err != nil { return nil, 0, err }
		items = append(items, s)
	}
	return items, total, nil
}

func (r *SurveyRepository) Create(s domain.Survey) (*domain.Survey, error) {
	s.ID = uuid.New().String()
	s.CreatedAt = time.Now()
	err := r.db.QueryRow(`INSERT INTO surveys
		(id, respondent_name, age, gender, education, occupation, q1,q2,q3,q4,q5,q6,q7,q8,q9, suggestion, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
		RETURNING id, respondent_name, age, gender, education, occupation, q1,q2,q3,q4,q5,q6,q7,q8,q9, suggestion, created_at`,
		s.ID, s.RespondentName, s.Age, s.Gender, s.Education, s.Occupation,
		s.Q1, s.Q2, s.Q3, s.Q4, s.Q5, s.Q6, s.Q7, s.Q8, s.Q9, s.Suggestion, s.CreatedAt,
	).Scan(&s.ID, &s.RespondentName, &s.Age, &s.Gender, &s.Education, &s.Occupation,
		&s.Q1, &s.Q2, &s.Q3, &s.Q4, &s.Q5, &s.Q6, &s.Q7, &s.Q8, &s.Q9, &s.Suggestion, &s.CreatedAt)
	return &s, err
}

// ─── Final Reports ────────────────────────────────────────────────────────────

type FinalReportRepository struct {
	db *sql.DB
}

func NewFinalReportRepository(db *sql.DB) *FinalReportRepository {
	return &FinalReportRepository{db: db}
}

type FinalReportFilter struct {
	Search string
	Page   int
	Limit  int
}

func (r *FinalReportRepository) List(f FinalReportFilter) ([]domain.FinalReport, int, error) {
	if f.Page < 1 { f.Page = 1 }
	if f.Limit < 1 { f.Limit = 10 }

	args := []interface{}{}
	i := 1
	where := ""
	if f.Search != "" {
		where = fmt.Sprintf("WHERE name ILIKE $%d OR research_title ILIKE $%d", i, i)
		args = append(args, "%"+f.Search+"%"); i++
	}

	var total int
	r.db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM final_reports %s", where), args...).Scan(&total)

	offset := (f.Page - 1) * f.Limit
	args = append(args, f.Limit, offset)
	q := fmt.Sprintf(`SELECT id, name, email, research_title, permit_request_id, file_url, suggestion, created_at
		FROM final_reports %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, i, i+1)

	rows, err := r.db.Query(q, args...)
	if err != nil { return nil, 0, err }
	defer rows.Close()

	var items []domain.FinalReport
	for rows.Next() {
		fr := domain.FinalReport{}
		if err := rows.Scan(&fr.ID, &fr.Name, &fr.Email, &fr.ResearchTitle, &fr.PermitRequestID, &fr.FileURL, &fr.Suggestion, &fr.CreatedAt); err != nil { return nil, 0, err }
		items = append(items, fr)
	}
	return items, total, nil
}

func (r *FinalReportRepository) Create(fr domain.FinalReport) (*domain.FinalReport, error) {
	fr.ID = uuid.New().String()
	fr.CreatedAt = time.Now()
	err := r.db.QueryRow(`INSERT INTO final_reports (id, name, email, research_title, permit_request_id, file_url, suggestion, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, name, email, research_title, permit_request_id, file_url, suggestion, created_at`,
		fr.ID, fr.Name, fr.Email, fr.ResearchTitle, fr.PermitRequestID, fr.FileURL, fr.Suggestion, fr.CreatedAt,
	).Scan(&fr.ID, &fr.Name, &fr.Email, &fr.ResearchTitle, &fr.PermitRequestID, &fr.FileURL, &fr.Suggestion, &fr.CreatedAt)
	return &fr, err
}

// ─── Suggestion Box ───────────────────────────────────────────────────────────

type SuggestionRepository struct {
	db *sql.DB
}

func NewSuggestionRepository(db *sql.DB) *SuggestionRepository {
	return &SuggestionRepository{db: db}
}

type SuggestionFilter struct {
	Page  int
	Limit int
}

func (r *SuggestionRepository) List(f SuggestionFilter) ([]domain.Suggestion, int, error) {
	if f.Page < 1 { f.Page = 1 }
	if f.Limit < 1 { f.Limit = 10 }

	var total int
	r.db.QueryRow("SELECT COUNT(*) FROM suggestion_box").Scan(&total)

	offset := (f.Page - 1) * f.Limit
	rows, err := r.db.Query(`SELECT id, name, email, message, created_at FROM suggestion_box
		ORDER BY created_at DESC LIMIT $1 OFFSET $2`, f.Limit, offset)
	if err != nil { return nil, 0, err }
	defer rows.Close()

	var items []domain.Suggestion
	for rows.Next() {
		s := domain.Suggestion{}
		if err := rows.Scan(&s.ID, &s.Name, &s.Email, &s.Message, &s.CreatedAt); err != nil { return nil, 0, err }
		items = append(items, s)
	}
	return items, total, nil
}

func (r *SuggestionRepository) Create(name, email *string, message string) (*domain.Suggestion, error) {
	id := uuid.New().String()
	now := time.Now()
	s := &domain.Suggestion{}
	err := r.db.QueryRow(`INSERT INTO suggestion_box (id, name, email, message, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, message, created_at`,
		id, name, email, message, now).Scan(&s.ID, &s.Name, &s.Email, &s.Message, &s.CreatedAt)
	return s, err
}

// ─── Letter Templates ─────────────────────────────────────────────────────────

type LetterTemplateRepository struct {
	db *sql.DB
}

func NewLetterTemplateRepository(db *sql.DB) *LetterTemplateRepository {
	return &LetterTemplateRepository{db: db}
}

type LetterTemplateFilter struct {
	Search   string
	IsActive *bool
	Page     int
	Limit    int
}

func (r *LetterTemplateRepository) List(f LetterTemplateFilter) ([]domain.LetterTemplate, int, error) {
	if f.Page < 1 { f.Page = 1 }
	if f.Limit < 1 { f.Limit = 10 }

	conditions := []string{}
	args := []interface{}{}
	i := 1
	if f.IsActive != nil {
		conditions = append(conditions, fmt.Sprintf("is_active = $%d", i))
		args = append(args, *f.IsActive); i++
	}
	if f.Search != "" {
		conditions = append(conditions, fmt.Sprintf("name ILIKE $%d", i))
		args = append(args, "%"+f.Search+"%"); i++
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	r.db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM letter_templates %s", where), args...).Scan(&total)

	offset := (f.Page - 1) * f.Limit
	args = append(args, f.Limit, offset)
	q := fmt.Sprintf(`SELECT id, name, type, content, placeholders, is_active, created_by, updated_by, created_at, updated_at
		FROM letter_templates %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, i, i+1)

	rows, err := r.db.Query(q, args...)
	if err != nil { return nil, 0, err }
	defer rows.Close()

	var items []domain.LetterTemplate
	for rows.Next() {
		lt := domain.LetterTemplate{}
		if err := rows.Scan(&lt.ID, &lt.Name, &lt.Type, &lt.Content, &lt.Placeholders, &lt.IsActive, &lt.CreatedBy, &lt.UpdatedBy, &lt.CreatedAt, &lt.UpdatedAt); err != nil { return nil, 0, err }
		items = append(items, lt)
	}
	return items, total, nil
}

func (r *LetterTemplateRepository) FindByID(id string) (*domain.LetterTemplate, error) {
	lt := &domain.LetterTemplate{}
	err := r.db.QueryRow(`SELECT id, name, type, content, placeholders, is_active, created_by, updated_by, created_at, updated_at FROM letter_templates WHERE id=$1`, id).
		Scan(&lt.ID, &lt.Name, &lt.Type, &lt.Content, &lt.Placeholders, &lt.IsActive, &lt.CreatedBy, &lt.UpdatedBy, &lt.CreatedAt, &lt.UpdatedAt)
	if err == sql.ErrNoRows { return nil, nil }
	return lt, err
}

func (r *LetterTemplateRepository) Create(name, templateType, content string, placeholders *string, isActive bool, createdBy *string) (*domain.LetterTemplate, error) {
	id := uuid.New().String()
	now := time.Now()
	lt := &domain.LetterTemplate{}
	err := r.db.QueryRow(`INSERT INTO letter_templates (id, name, type, content, placeholders, is_active, created_by, updated_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9) RETURNING id, name, type, content, placeholders, is_active, created_by, updated_by, created_at, updated_at`,
		id, name, templateType, content, placeholders, isActive, createdBy, now, now).
		Scan(&lt.ID, &lt.Name, &lt.Type, &lt.Content, &lt.Placeholders, &lt.IsActive, &lt.CreatedBy, &lt.UpdatedBy, &lt.CreatedAt, &lt.UpdatedAt)
	return lt, err
}

func (r *LetterTemplateRepository) Update(id, name, templateType, content string, placeholders *string, isActive bool, updatedBy *string) (*domain.LetterTemplate, error) {
	lt := &domain.LetterTemplate{}
	err := r.db.QueryRow(`UPDATE letter_templates SET name=$2, type=$3, content=$4, placeholders=$5, is_active=$6, updated_by=$7, updated_at=$8
		WHERE id=$1 RETURNING id, name, type, content, placeholders, is_active, created_by, updated_by, created_at, updated_at`,
		id, name, templateType, content, placeholders, isActive, updatedBy, time.Now()).
		Scan(&lt.ID, &lt.Name, &lt.Type, &lt.Content, &lt.Placeholders, &lt.IsActive, &lt.CreatedBy, &lt.UpdatedBy, &lt.CreatedAt, &lt.UpdatedAt)
	if err == sql.ErrNoRows { return nil, nil }
	return lt, err
}

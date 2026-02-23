package postgres

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/bapperida/portal/internal/domain"
)

type PermitRepository struct {
	db *sql.DB
}

func NewPermitRepository(db *sql.DB) *PermitRepository {
	return &PermitRepository{db: db}
}

const permitCols = `
	id, request_number, email, full_name, nim_nik, birth_place, work_unit,
	institution, phone_wa, citizenship, research_location, research_duration,
	research_title, signer_position, intro_letter_number, intro_letter_date,
	file_identity, file_intro_letter, file_proposal, file_social_media, file_survey,
	agreement_final_report, status, review_note, processed_by, deleted_at, created_at, updated_at`

func scanPermit(row interface{ Scan(...any) error }) (*domain.ResearchPermit, error) {
	p := &domain.ResearchPermit{}
	return p, row.Scan(
		&p.ID, &p.RequestNumber, &p.Email, &p.FullName, &p.NimNik, &p.BirthPlace,
		&p.WorkUnit, &p.Institution, &p.PhoneWA, &p.Citizenship,
		&p.ResearchLocation, &p.ResearchDuration, &p.ResearchTitle,
		&p.SignerPosition, &p.IntroLetterNumber, &p.IntroLetterDate,
		&p.FileIdentity, &p.FileIntroLetter, &p.FileProposal,
		&p.FileSocialMedia, &p.FileSurvey,
		&p.AgreementFinalReport, &p.Status, &p.ReviewNote, &p.ProcessedBy,
		&p.DeletedAt, &p.CreatedAt, &p.UpdatedAt,
	)
}

type PermitFilter struct {
	Status string
	Search string
	Page   int
	Limit  int
}

func (r *PermitRepository) List(f PermitFilter) ([]domain.ResearchPermit, int, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 {
		f.Limit = 10
	}

	conditions := []string{"deleted_at IS NULL"}
	args := []interface{}{}
	i := 1

	if f.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", i))
		args = append(args, f.Status)
		i++
	}
	if f.Search != "" {
		conditions = append(conditions, fmt.Sprintf("(full_name ILIKE $%d OR request_number ILIKE $%d)", i, i))
		args = append(args, "%"+f.Search+"%")
		i++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")
	var total int
	if err := r.db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM research_permit_requests %s", where), args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (f.Page - 1) * f.Limit
	args = append(args, f.Limit, offset)
	q := fmt.Sprintf("SELECT %s FROM research_permit_requests %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		permitCols, where, i, i+1)

	rows, err := r.db.Query(q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var items []domain.ResearchPermit
	for rows.Next() {
		p, err := scanPermit(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, *p)
	}
	return items, total, nil
}

func (r *PermitRepository) FindByID(id string) (*domain.ResearchPermit, error) {
	q := fmt.Sprintf("SELECT %s FROM research_permit_requests WHERE id=$1", permitCols)
	p, err := scanPermit(r.db.QueryRow(q, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return p, err
}

type CreatePermitInput struct {
	Email                string
	FullName             string
	NimNik               string
	BirthPlace           string
	WorkUnit             string
	Institution          string
	PhoneWA              string
	Citizenship          string
	ResearchLocation     string
	ResearchDuration     string
	ResearchTitle        string
	SignerPosition        string
	IntroLetterNumber    string
	IntroLetterDate      time.Time
	AgreementFinalReport bool
}

// nextSequence atomically increments and returns the current year sequence.
func (r *PermitRepository) nextSequence(tx *sql.Tx, year int) (int, error) {
	var seq int
	err := tx.QueryRow(`
		INSERT INTO permit_sequences (year, current_seq)
		VALUES ($1, 1)
		ON CONFLICT (year) DO UPDATE SET current_seq = permit_sequences.current_seq + 1
		RETURNING current_seq`, year).Scan(&seq)
	return seq, err
}

func (r *PermitRepository) Create(input CreatePermitInput) (*domain.ResearchPermit, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	year := time.Now().Year()
	seq, err := r.nextSequence(tx, year)
	if err != nil {
		return nil, fmt.Errorf("sequence error: %w", err)
	}

	requestNum := fmt.Sprintf("BAPPERIDA-RID-%d-%06d", year, seq)
	id := uuid.New().String()
	now := time.Now()

	const q = `INSERT INTO research_permit_requests
		(id, request_number, email, full_name, nim_nik, birth_place, work_unit,
		 institution, phone_wa, citizenship, research_location, research_duration,
		 research_title, signer_position, intro_letter_number, intro_letter_date,
		 agreement_final_report, status, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'submitted',$18,$19)
		RETURNING id`

	var newID string
	err = tx.QueryRow(q,
		id, requestNum, input.Email, input.FullName, input.NimNik, input.BirthPlace,
		input.WorkUnit, input.Institution, input.PhoneWA, input.Citizenship,
		input.ResearchLocation, input.ResearchDuration, input.ResearchTitle,
		input.SignerPosition, input.IntroLetterNumber, input.IntroLetterDate,
		input.AgreementFinalReport, now, now,
	).Scan(&newID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return r.FindByID(newID)
}

func (r *PermitRepository) UpdateStatus(id string, status domain.PermitStatus, note *string, processedBy *string) error {
	// Record history first
	oldPermit, err := r.FindByID(id)
	if err != nil || oldPermit == nil {
		return fmt.Errorf("permit not found")
	}

	oldStatus := oldPermit.Status
	_, err = r.db.Exec(`
		INSERT INTO permit_status_histories (id, permit_id, from_status, to_status, note, changed_by, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		uuid.New().String(), id, oldStatus, status, note, processedBy, time.Now())
	if err != nil {
		return err
	}

	_, err = r.db.Exec(`
		UPDATE research_permit_requests SET status=$2, review_note=$3, processed_by=$4, updated_at=$5
		WHERE id=$1`, id, status, note, processedBy, time.Now())
	return err
}

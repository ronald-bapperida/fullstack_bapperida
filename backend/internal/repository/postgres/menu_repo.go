package postgres

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/bapperida/portal/internal/domain"
)

type MenuRepository struct {
	db *sql.DB
}

func NewMenuRepository(db *sql.DB) *MenuRepository {
	return &MenuRepository{db: db}
}

const menuCols = `id, name, location, is_active, deleted_at, created_at`

func (r *MenuRepository) List(location string, activeOnly bool) ([]domain.Menu, error) {
	conditions := []string{"deleted_at IS NULL"}
	args := []interface{}{}
	i := 1

	if location != "" {
		conditions = append(conditions, fmt.Sprintf("location = $%d", i))
		args = append(args, location); i++
	}
	if activeOnly {
		conditions = append(conditions, "is_active = true")
	}

	where := "WHERE " + conditions[0]
	for _, c := range conditions[1:] {
		where += " AND " + c
	}

	q := fmt.Sprintf("SELECT %s FROM menus %s ORDER BY created_at ASC", menuCols, where)
	rows, err := r.db.Query(q, args...)
	if err != nil { return nil, err }
	defer rows.Close()

	var menus []domain.Menu
	for rows.Next() {
		m := domain.Menu{}
		if err := rows.Scan(&m.ID, &m.Name, &m.Location, &m.IsActive, &m.DeletedAt, &m.CreatedAt); err != nil {
			return nil, err
		}
		menus = append(menus, m)
	}
	return menus, nil
}

func (r *MenuRepository) FindByID(id string) (*domain.Menu, error) {
	q := fmt.Sprintf("SELECT %s FROM menus WHERE id=$1", menuCols)
	m := &domain.Menu{}
	if err := r.db.QueryRow(q, id).Scan(&m.ID, &m.Name, &m.Location, &m.IsActive, &m.DeletedAt, &m.CreatedAt); err != nil {
		if err == sql.ErrNoRows { return nil, nil }
		return nil, err
	}
	// Load items
	items, err := r.ListItems(id)
	if err != nil { return nil, err }
	m.Items = items
	return m, nil
}

func (r *MenuRepository) Create(name string, location domain.MenuLocation, isActive bool) (*domain.Menu, error) {
	id := uuid.New().String()
	now := time.Now()
	q := fmt.Sprintf(`INSERT INTO menus (id, name, location, is_active, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING %s`, menuCols)
	m := &domain.Menu{}
	err := r.db.QueryRow(q, id, name, location, isActive, now).Scan(&m.ID, &m.Name, &m.Location, &m.IsActive, &m.DeletedAt, &m.CreatedAt)
	return m, err
}

func (r *MenuRepository) Update(id, name string, location domain.MenuLocation, isActive bool) (*domain.Menu, error) {
	q := fmt.Sprintf(`UPDATE menus SET name=$2, location=$3, is_active=$4 WHERE id=$1 AND deleted_at IS NULL RETURNING %s`, menuCols)
	m := &domain.Menu{}
	err := r.db.QueryRow(q, id, name, location, isActive).Scan(&m.ID, &m.Name, &m.Location, &m.IsActive, &m.DeletedAt, &m.CreatedAt)
	if err == sql.ErrNoRows { return nil, nil }
	return m, err
}

func (r *MenuRepository) SoftDelete(id string) error {
	_, err := r.db.Exec(`UPDATE menus SET deleted_at=$2 WHERE id=$1`, id, time.Now())
	return err
}

// ─── Menu Items ───────────────────────────────────────────────────────────────

const itemCols = `id, menu_id, parent_id, title, type, value, icon, target, requires_auth, sort_order, deleted_at, created_at`

func scanMenuItem(row interface{ Scan(...any) error }) (*domain.MenuItem, error) {
	m := &domain.MenuItem{}
	return m, row.Scan(
		&m.ID, &m.MenuID, &m.ParentID, &m.Title, &m.Type, &m.Value,
		&m.Icon, &m.Target, &m.RequiresAuth, &m.SortOrder, &m.DeletedAt, &m.CreatedAt,
	)
}

func (r *MenuRepository) ListItems(menuID string) ([]domain.MenuItem, error) {
	q := fmt.Sprintf("SELECT %s FROM menu_items WHERE menu_id=$1 AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC", itemCols)
	rows, err := r.db.Query(q, menuID)
	if err != nil { return nil, err }
	defer rows.Close()
	var items []domain.MenuItem
	for rows.Next() {
		m, err := scanMenuItem(rows)
		if err != nil { return nil, err }
		items = append(items, *m)
	}
	return items, nil
}

type MenuItemInput struct {
	MenuID      string
	ParentID    *string
	Title       string
	Type        domain.MenuItemType
	Value       *string
	Icon        *string
	Target      string
	RequiresAuth bool
	SortOrder   int
}

func (r *MenuRepository) CreateItem(input MenuItemInput) (*domain.MenuItem, error) {
	id := uuid.New().String()
	q := fmt.Sprintf(`INSERT INTO menu_items (id, menu_id, parent_id, title, type, value, icon, target, requires_auth, sort_order, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING %s`, itemCols)
	return scanMenuItem(r.db.QueryRow(q,
		id, input.MenuID, input.ParentID, input.Title, input.Type, input.Value,
		input.Icon, input.Target, input.RequiresAuth, input.SortOrder, time.Now(),
	))
}

func (r *MenuRepository) UpdateItem(id string, input MenuItemInput) (*domain.MenuItem, error) {
	q := fmt.Sprintf(`UPDATE menu_items SET parent_id=$2, title=$3, type=$4, value=$5, icon=$6, target=$7, requires_auth=$8, sort_order=$9
		WHERE id=$1 AND deleted_at IS NULL RETURNING %s`, itemCols)
	m, err := scanMenuItem(r.db.QueryRow(q,
		id, input.ParentID, input.Title, input.Type, input.Value,
		input.Icon, input.Target, input.RequiresAuth, input.SortOrder,
	))
	if err == sql.ErrNoRows { return nil, nil }
	return m, err
}

func (r *MenuRepository) DeleteItem(id string) error {
	_, err := r.db.Exec(`UPDATE menu_items SET deleted_at=$2 WHERE id=$1`, id, time.Now())
	return err
}

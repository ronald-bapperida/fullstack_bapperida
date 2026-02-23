package postgres

import (
        "database/sql"
        "fmt"
        "time"

        "github.com/google/uuid"
        "golang.org/x/crypto/bcrypt"

        "github.com/bapperida/portal/internal/domain"
)

type UserRepository struct {
        db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
        return &UserRepository{db: db}
}

func (r *UserRepository) FindByUsername(username string) (*domain.User, error) {
        const q = `
                SELECT id, username, email, password, full_name, role, is_active, created_at, updated_at
                FROM users WHERE username = $1 AND is_active = true`

        row := r.db.QueryRow(q, username)
        u := &domain.User{}
        if err := row.Scan(&u.ID, &u.Username, &u.Email, &u.Password,
                &u.FullName, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt); err != nil {
                if err == sql.ErrNoRows {
                        return nil, nil
                }
                return nil, err
        }
        return u, nil
}

func (r *UserRepository) FindByID(id string) (*domain.User, error) {
        const q = `
                SELECT id, username, email, password, full_name, role, is_active, created_at, updated_at
                FROM users WHERE id = $1`

        row := r.db.QueryRow(q, id)
        u := &domain.User{}
        if err := row.Scan(&u.ID, &u.Username, &u.Email, &u.Password,
                &u.FullName, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt); err != nil {
                if err == sql.ErrNoRows {
                        return nil, nil
                }
                return nil, err
        }
        return u, nil
}

func (r *UserRepository) List() ([]domain.User, error) {
        const q = `
                SELECT id, username, email, full_name, role, is_active, created_at, updated_at
                FROM users ORDER BY created_at DESC`

        rows, err := r.db.Query(q)
        if err != nil {
                return nil, err
        }
        defer rows.Close()

        var users []domain.User
        for rows.Next() {
                u := domain.User{}
                if err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.FullName,
                        &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt); err != nil {
                        return nil, err
                }
                users = append(users, u)
        }
        return users, nil
}

func (r *UserRepository) Create(username, email, fullName, password string, role domain.Role) (*domain.User, error) {
        hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
        if err != nil {
                return nil, fmt.Errorf("hash error: %w", err)
        }

        now := time.Now()
        id := uuid.New().String()
        const q = `
                INSERT INTO users (id, username, email, password, full_name, role, is_active, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8)
                RETURNING id, username, email, full_name, role, is_active, created_at, updated_at`

        u := &domain.User{}
        err = r.db.QueryRow(q, id, username, email, string(hash), fullName, role, now, now).
                Scan(&u.ID, &u.Username, &u.Email, &u.FullName, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
        return u, err
}

func (r *UserRepository) Update(id, fullName, email string, role domain.Role, isActive bool) (*domain.User, error) {
        const q = `
                UPDATE users SET full_name=$2, email=$3, role=$4, is_active=$5, updated_at=$6
                WHERE id=$1
                RETURNING id, username, email, full_name, role, is_active, created_at, updated_at`

        u := &domain.User{}
        err := r.db.QueryRow(q, id, fullName, email, role, isActive, time.Now()).
                Scan(&u.ID, &u.Username, &u.Email, &u.FullName, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
        if err == sql.ErrNoRows {
                return nil, nil
        }
        return u, err
}

func (r *UserRepository) ChangePassword(id, newPassword string) error {
        hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
        if err != nil {
                return err
        }
        _, err = r.db.Exec(`UPDATE users SET password=$2, updated_at=$3 WHERE id=$1`,
                id, string(hash), time.Now())
        return err
}

func (r *UserRepository) VerifyPassword(u *domain.User, plain string) bool {
        err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(plain))
        return err == nil
}

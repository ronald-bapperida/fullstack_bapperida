package storage

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

type FileStorage struct {
	BaseDir string
}

func New(baseDir string) *FileStorage {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		panic("cannot create storage dir: " + err.Error())
	}
	return &FileStorage{BaseDir: baseDir}
}

// Save stores a multipart file in the given subdirectory.
// Returns the relative URL path (e.g., "/uploads/news/uuid.jpg").
func (s *FileStorage) Save(subdir string, file multipart.File, header *multipart.FileHeader) (string, error) {
	dir := filepath.Join(s.BaseDir, subdir)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("mkdir error: %w", err)
	}

	ext := filepath.Ext(header.Filename)
	filename := uuid.New().String() + ext
	dst := filepath.Join(dir, filename)

	out, err := os.Create(dst)
	if err != nil {
		return "", fmt.Errorf("create file error: %w", err)
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		return "", fmt.Errorf("copy error: %w", err)
	}

	return "/uploads/" + subdir + "/" + filename, nil
}

// Delete removes a file at the given relative URL path.
func (s *FileStorage) Delete(urlPath string) error {
	rel := filepath.Join(s.BaseDir, "..", urlPath)
	return os.Remove(filepath.Clean(rel))
}

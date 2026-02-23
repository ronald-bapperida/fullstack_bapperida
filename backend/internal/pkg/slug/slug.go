package slug

import (
	"regexp"
	"strings"

	"github.com/google/uuid"
)

var nonAlphanumericRegex = regexp.MustCompile(`[^a-z0-9\s-]`)
var spaceRegex = regexp.MustCompile(`\s+`)
var dashRegex = regexp.MustCompile(`-+`)

// Generate creates a collision-safe slug from a title using UUID suffix.
// Example: "BAPPERIDA Kalteng" => "bapperida-kalteng-a1b2c3d4"
func Generate(title string) string {
	base := strings.ToLower(title)
	base = nonAlphanumericRegex.ReplaceAllString(base, "")
	base = strings.TrimSpace(base)
	base = spaceRegex.ReplaceAllString(base, "-")
	base = dashRegex.ReplaceAllString(base, "-")
	// UUID suffix ensures collision safety
	suffix := uuid.New().String()[:8]
	return base + "-" + suffix
}

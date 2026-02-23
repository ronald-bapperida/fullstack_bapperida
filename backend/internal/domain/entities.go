package domain

import "time"

// ─── Enums ────────────────────────────────────────────────────────────────────
type Role string

const (
	RoleSuperAdmin Role = "super_admin"
	RoleAdminBPP   Role = "admin_bpp"
	RoleAdminRIDA  Role = "admin_rida"
)

type NewsStatus string

const (
	NewsStatusDraft     NewsStatus = "draft"
	NewsStatusPublished NewsStatus = "published"
)

type PermitStatus string

const (
	PermitStatusSubmitted        PermitStatus = "submitted"
	PermitStatusInReview         PermitStatus = "in_review"
	PermitStatusRevisionRequired PermitStatus = "revision_requested"
	PermitStatusApproved         PermitStatus = "approved"
	PermitStatusGeneratedLetter  PermitStatus = "generated_letter"
	PermitStatusSent             PermitStatus = "sent"
	PermitStatusRejected         PermitStatus = "rejected"
)

type BannerLinkType string

const (
	BannerLinkExternal BannerLinkType = "external"
	BannerLinkPage     BannerLinkType = "page"
	BannerLinkNews     BannerLinkType = "news"
)

type MenuLocation string

const (
	MenuLocationHeader  MenuLocation = "header"
	MenuLocationFooter  MenuLocation = "footer"
	MenuLocationMobile  MenuLocation = "mobile"
)

type MenuItemType string

const (
	MenuItemTypeRoute MenuItemType = "route"
	MenuItemTypeURL   MenuItemType = "url"
	MenuItemTypePage  MenuItemType = "page"
	MenuItemTypeNews  MenuItemType = "news"
)

type AccessLevel string

const (
	AccessLevelTerbuka  AccessLevel = "terbuka"
	AccessLevelTerbatas AccessLevel = "terbatas"
	AccessLevelRahasia  AccessLevel = "rahasia"
)

// ─── User ─────────────────────────────────────────────────────────────────────
type User struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Password  string    `json:"-"`
	FullName  string    `json:"full_name"`
	Role      Role      `json:"role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ─── News Category ────────────────────────────────────────────────────────────
type NewsCategory struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Slug        string     `json:"slug"`
	Description *string    `json:"description"`
	DeletedAt   *time.Time `json:"deleted_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// ─── News ─────────────────────────────────────────────────────────────────────
type News struct {
	ID              string     `json:"id"`
	Title           string     `json:"title"`
	Slug            string     `json:"slug"`
	CategoryID      *string    `json:"category_id"`
	Content         string     `json:"content"`
	Excerpt         *string    `json:"excerpt"`
	URL             *string    `json:"url"`
	FeaturedImage   *string    `json:"featured_image"`
	FeaturedCaption *string    `json:"featured_caption"`
	Status          NewsStatus `json:"status"`
	EventAt         *time.Time `json:"event_at"`
	PublishedAt     *time.Time `json:"published_at"`
	AuthorID        *string    `json:"author_id"`
	ViewCount       int        `json:"view_count"`
	DeletedAt       *time.Time `json:"deleted_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// ─── Banner ───────────────────────────────────────────────────────────────────
type Banner struct {
	ID           string         `json:"id"`
	Title        string         `json:"title"`
	Placement    string         `json:"placement"`
	ImageDesktop *string        `json:"image_desktop"`
	ImageMobile  *string        `json:"image_mobile"`
	LinkType     BannerLinkType `json:"link_type"`
	LinkURL      *string        `json:"link_url"`
	StartAt      *time.Time     `json:"start_at"`
	EndAt        *time.Time     `json:"end_at"`
	IsActive     bool           `json:"is_active"`
	ViewCount    int            `json:"view_count"`
	ClickCount   int            `json:"click_count"`
	DeletedAt    *time.Time     `json:"deleted_at,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

// ─── Menu ─────────────────────────────────────────────────────────────────────
type Menu struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	Location  MenuLocation `json:"location"`
	IsActive  bool         `json:"is_active"`
	Items     []MenuItem   `json:"items,omitempty"`
	DeletedAt *time.Time   `json:"deleted_at,omitempty"`
	CreatedAt time.Time    `json:"created_at"`
}

type MenuItem struct {
	ID           string       `json:"id"`
	MenuID       string       `json:"menu_id"`
	ParentID     *string      `json:"parent_id"`
	Title        string       `json:"title"`
	Type         MenuItemType `json:"type"`
	Value        *string      `json:"value"`
	RequiresAuth bool         `json:"requires_auth"`
	SortOrder    int          `json:"sort_order"`
	DeletedAt    *time.Time   `json:"deleted_at,omitempty"`
	CreatedAt    time.Time    `json:"created_at"`
}

// ─── Document ─────────────────────────────────────────────────────────────────
type Document struct {
	ID          string      `json:"id"`
	Title       string      `json:"title"`
	KindID      *string     `json:"kind_id"`
	CategoryID  *string     `json:"category_id"`
	TypeID      *string     `json:"type_id"`
	FileURL     *string     `json:"file_url"`
	AccessLevel AccessLevel `json:"access_level"`
	PublishedAt *time.Time  `json:"published_at"`
	Status      NewsStatus  `json:"status"`
	DeletedAt   *time.Time  `json:"deleted_at,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

// ─── Research Permit ──────────────────────────────────────────────────────────
type ResearchPermit struct {
	ID                  string       `json:"id"`
	RequestNumber       string       `json:"request_number"`
	Email               string       `json:"email"`
	FullName            string       `json:"full_name"`
	NimNik              string       `json:"nim_nik"`
	BirthPlace          string       `json:"birth_place"`
	WorkUnit            string       `json:"work_unit"`
	Institution         string       `json:"institution"`
	PhoneWA             string       `json:"phone_wa"`
	Citizenship         string       `json:"citizenship"`
	ResearchLocation    string       `json:"research_location"`
	ResearchDuration    string       `json:"research_duration"`
	ResearchTitle       string       `json:"research_title"`
	SignerPosition      string       `json:"signer_position"`
	IntroLetterNumber   string       `json:"intro_letter_number"`
	IntroLetterDate     time.Time    `json:"intro_letter_date"`
	FileIdentity        *string      `json:"file_identity"`
	FileIntroLetter     *string      `json:"file_intro_letter"`
	FileProposal        *string      `json:"file_proposal"`
	FileSocialMedia     *string      `json:"file_social_media"`
	FileSurvey          *string      `json:"file_survey"`
	AgreementFinalReport bool        `json:"agreement_final_report"`
	Status              PermitStatus `json:"status"`
	ReviewNote          *string      `json:"review_note"`
	ProcessedBy         *string      `json:"processed_by"`
	DeletedAt           *time.Time   `json:"deleted_at,omitempty"`
	CreatedAt           time.Time    `json:"created_at"`
	UpdatedAt           time.Time    `json:"updated_at"`
}

type PermitStatusHistory struct {
	ID         string        `json:"id"`
	PermitID   string        `json:"permit_id"`
	FromStatus *PermitStatus `json:"from_status"`
	ToStatus   PermitStatus  `json:"to_status"`
	Note       *string       `json:"note"`
	ChangedBy  *string       `json:"changed_by"`
	CreatedAt  time.Time     `json:"created_at"`
}

// ─── Letter Template & Generated Letter ──────────────────────────────────────
type LetterTemplate struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Content   string    `json:"content"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type GeneratedLetter struct {
	ID         string     `json:"id"`
	PermitID   string     `json:"permit_id"`
	TemplateID *string    `json:"template_id"`
	FileURL    *string    `json:"file_url"`
	SentAt     *time.Time `json:"sent_at"`
	DeletedAt  *time.Time `json:"deleted_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// ─── Survey ───────────────────────────────────────────────────────────────────
type Survey struct {
	ID             string    `json:"id"`
	RespondentName string    `json:"respondent_name"`
	Age            int       `json:"age"`
	Gender         string    `json:"gender"`
	Education      string    `json:"education"`
	Occupation     string    `json:"occupation"`
	Q1             int       `json:"q1"`
	Q2             int       `json:"q2"`
	Q3             int       `json:"q3"`
	Q4             int       `json:"q4"`
	Q5             int       `json:"q5"`
	Q6             int       `json:"q6"`
	Q7             int       `json:"q7"`
	Q8             int       `json:"q8"`
	Q9             int       `json:"q9"`
	Suggestion     *string   `json:"suggestion"`
	CreatedAt      time.Time `json:"created_at"`
}

// ─── Final Report & Suggestion ───────────────────────────────────────────────
type FinalReport struct {
	ID              string     `json:"id"`
	Name            string     `json:"name"`
	Email           string     `json:"email"`
	ResearchTitle   string     `json:"research_title"`
	PermitRequestID *string    `json:"permit_request_id"`
	FileURL         *string    `json:"file_url"`
	Suggestion      string     `json:"suggestion"`
	CreatedAt       time.Time  `json:"created_at"`
}

type Suggestion struct {
	ID        string    `json:"id"`
	Name      *string   `json:"name"`
	Email     *string   `json:"email"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

// ─── Pagination ───────────────────────────────────────────────────────────────
type PaginatedResult[T any] struct {
	Items []T `json:"items"`
	Total int `json:"total"`
	Page  int `json:"page"`
	Limit int `json:"limit"`
}

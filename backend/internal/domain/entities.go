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

// ─── News ─────────────────────────────────────────────────────────────────────

type NewsCategory struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Slug        string     `json:"slug"`
	Description *string    `json:"description"`
	DeletedAt   *time.Time `json:"deleted_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

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
	// Relations
	CategoryName *string     `json:"category_name,omitempty"`
	Media        []NewsMedia `json:"media,omitempty"`
}

type NewsMedia struct {
	ID          string     `json:"id"`
	NewsID      string     `json:"news_id"`
	FileURL     string     `json:"file_url"`
	FileName    string     `json:"file_name"`
	FileSize    int        `json:"file_size"`
	MimeType    string     `json:"mime_type"`
	Caption     *string    `json:"caption"`
	IsMain      bool       `json:"is_main"`
	Type        string     `json:"type"`
	SortOrder   int        `json:"sort_order"`
	CreatedAt   time.Time  `json:"created_at"`
}

// ─── Banner ───────────────────────────────────────────────────────────────────

type Banner struct {
	ID           string         `json:"id"`
	Title        string         `json:"title"`
	Slug         *string        `json:"slug"`
	Placement    string         `json:"placement"`
	ImageDesktop *string        `json:"image_desktop"`
	ImageMobile  *string        `json:"image_mobile"`
	AltText      *string        `json:"alt_text"`
	LinkType     BannerLinkType `json:"link_type"`
	LinkURL      *string        `json:"link_url"`
	Target       string         `json:"target"`
	SortOrder    int            `json:"sort_order"`
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
	Icon         *string      `json:"icon"`
	Target       string       `json:"target"`
	RequiresAuth bool         `json:"requires_auth"`
	SortOrder    int          `json:"sort_order"`
	DeletedAt    *time.Time   `json:"deleted_at,omitempty"`
	CreatedAt    time.Time    `json:"created_at"`
}

// ─── Document ─────────────────────────────────────────────────────────────────

type DocumentMaster struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type DocumentType struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Extension string    `json:"extension"`
	CreatedAt time.Time `json:"created_at"`
}

type Document struct {
	ID          string      `json:"id"`
	Title       string      `json:"title"`
	DocNo       *string     `json:"doc_no"`
	KindID      *string     `json:"kind_id"`
	CategoryID  *string     `json:"category_id"`
	TypeID      *string     `json:"type_id"`
	Publisher   *string     `json:"publisher"`
	Content     *string     `json:"content"`
	FileURL     *string     `json:"file_url"`
	FilePath    *string     `json:"file_path,omitempty"`
	AccessLevel AccessLevel `json:"access_level"`
	PublishedAt *time.Time  `json:"published_at"`
	Status      NewsStatus  `json:"status"`
	DeletedAt   *time.Time  `json:"deleted_at,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
	// Joined fields
	KindName      string `json:"kind_name,omitempty"`
	CategoryName  string `json:"category_name,omitempty"`
	TypeName      string `json:"type_name,omitempty"`
	TypeExtension string `json:"type_extension,omitempty"`
}

// ─── Research Permit ──────────────────────────────────────────────────────────

type ResearchPermit struct {
	ID                   string       `json:"id"`
	RequestNumber        string       `json:"request_number"`
	Email                string       `json:"email"`
	FullName             string       `json:"full_name"`
	NimNik               string       `json:"nim_nik"`
	BirthPlace           string       `json:"birth_place"`
	WorkUnit             string       `json:"work_unit"`
	Institution          string       `json:"institution"`
	PhoneWA              string       `json:"phone_wa"`
	Citizenship          string       `json:"citizenship"`
	ResearchLocation     string       `json:"research_location"`
	ResearchDuration     string       `json:"research_duration"`
	ResearchTitle        string       `json:"research_title"`
	SignerPosition        string       `json:"signer_position"`
	IntroLetterNumber    string       `json:"intro_letter_number"`
	IntroLetterDate      time.Time    `json:"intro_letter_date"`
	FileIdentity         *string      `json:"file_identity"`
	FileIntroLetter      *string      `json:"file_intro_letter"`
	FileProposal         *string      `json:"file_proposal"`
	FileSocialMedia      *string      `json:"file_social_media"`
	FileSurvey           *string      `json:"file_survey"`
	AgreementFinalReport bool         `json:"agreement_final_report"`
	Status               PermitStatus `json:"status"`
	ReviewNote           *string      `json:"review_note"`
	ProcessedBy          *string      `json:"processed_by"`
	DeletedAt            *time.Time   `json:"deleted_at,omitempty"`
	CreatedAt            time.Time    `json:"created_at"`
	UpdatedAt            time.Time    `json:"updated_at"`
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

// ─── Letter Template ──────────────────────────────────────────────────────────

type LetterTemplate struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	Type         string     `json:"type"`
	Content      string     `json:"content"`
	Placeholders *string    `json:"placeholders"`
	IsActive     bool       `json:"is_active"`
	CreatedBy    *string    `json:"created_by"`
	UpdatedBy    *string    `json:"updated_by"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// ─── Survey & Reports ─────────────────────────────────────────────────────────

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
	ID        string     `json:"id"`
	Name      *string    `json:"name"`
	Email     *string    `json:"email"`
	Message   string     `json:"message"`
	CreatedAt time.Time  `json:"created_at"`
}

// ─── Pagination ───────────────────────────────────────────────────────────────

type PaginatedResult[T any] struct {
	Items []T `json:"items"`
	Total int `json:"total"`
	Page  int `json:"page"`
	Limit int `json:"limit"`
}

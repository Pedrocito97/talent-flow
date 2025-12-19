# Talent Flow CRM - Development Progress

## Current Status

**Current Milestone:** 12 - Advanced Search & Filters
**Started:** 2024-12-18
**Status:** COMPLETED

---

## Milestone 1: Project Setup - COMPLETED

See git history for details.

---

## Milestone 2: Database + Auth

### Completed

- [x] Setup Prisma with PostgreSQL
  - Prisma 5.22.0 (downgraded from 7.x for Next.js 16 compatibility)
  - Full schema with all 17 entities
  - Indexes for performance

- [x] Implement full database schema with all entities
  - User (with roles: OWNER, ADMIN, RECRUITER, VIEWER)
  - Pipeline, Stage, PipelineAssignment
  - Candidate, CandidateStageHistory
  - Attachment, ImportBatch, ImportItem
  - Note, Tag, CandidateTag
  - EmailTemplate, EmailLog
  - AuditLog, MergeLog

- [x] Create seed script
  - Default owner user (admin@talentflow.com / admin123)
  - Default pipeline "Sales Recruitment"
  - 6 default stages: Inbox, Screening, Interview, Offer, Hired, Rejected
  - 5 default tags

- [x] Implement NextAuth with credentials provider
  - JWT session strategy (stateless, Vercel-friendly)
  - Email/password authentication
  - Role stored in JWT token
  - 30-day session expiration

- [x] Document auth flow
  - `/docs/decisions/2024-12-18-auth-flow.md`

- [x] Implement invitation flow (create user, send email, set password)
  - API route to send invitations (`/api/users/invite`)
  - API route to accept invitations (`/api/users/accept-invite`)
  - Invite acceptance page (`/invite/[token]`)
  - Email templates using Resend

- [x] Create RBAC middleware for API routes
  - Permission-based access control
  - Role hierarchy (VIEWER < RECRUITER < ADMIN < OWNER)
  - Helper wrappers: `withAuth`, `withPermission`, `withRole`

### Files Created/Modified

```
/lib/
  auth.ts               - NextAuth configuration
  db.ts                 - Prisma client singleton
  auth/
    rbac.ts             - RBAC middleware and permissions
    index.ts            - Auth exports
  email/
    resend.ts           - Resend client (lazy-initialized)
    templates/
      invite.ts         - Invitation email templates

/prisma/
  schema.prisma         - Full database schema (17 entities)
  seed.ts               - Seed script

/app/
  api/
    auth/[...nextauth]/route.ts    - Auth route handler
    users/
      invite/route.ts              - Send invitation API
      accept-invite/route.ts       - Accept invitation API
  (auth)/
    login/page.tsx                 - Login page with Suspense
    invite/[token]/page.tsx        - Invitation acceptance page

/middleware.ts          - Auth middleware (edge-compatible)

/components/
  providers/
    session-provider.tsx - NextAuth SessionProvider
    index.ts

/docs/decisions/
  2024-12-18-auth-flow.md - Auth architecture decision
```

### Technical Decisions

1. **Prisma Version:** 5.22.0 (7.x has compatibility issues with Next.js 16 Turbopack)
2. **Session Strategy:** JWT (stateless, better for Vercel serverless)
3. **Middleware:** Lightweight cookie check (no database calls, edge-compatible)
4. **Password Hashing:** bcryptjs with 12 rounds

### Known Issues

- Prisma warning about `--no-engine` in production (safe to ignore for now)
- Next.js middleware deprecation warning (will migrate to proxy pattern later)

---

## Milestone 3: Pipeline Management - COMPLETED

### Completed

- [x] Create Pipeline CRUD API routes
  - GET `/api/pipelines` - List all pipelines (filtered by role)
  - POST `/api/pipelines` - Create pipeline with default stages
  - GET `/api/pipelines/[id]` - Get single pipeline with stages and assignments
  - PUT `/api/pipelines/[id]` - Update pipeline name/description/archive
  - DELETE `/api/pipelines/[id]` - Delete pipeline (only if no candidates)

- [x] Create Stage CRUD API routes
  - GET `/api/pipelines/[id]/stages` - List stages for pipeline
  - POST `/api/pipelines/[id]/stages` - Create new stage
  - GET `/api/pipelines/[id]/stages/[stageId]` - Get single stage
  - PUT `/api/pipelines/[id]/stages/[stageId]` - Update stage
  - DELETE `/api/pipelines/[id]/stages/[stageId]` - Delete stage
  - PUT `/api/pipelines/[id]/stages/reorder` - Reorder stages via drag-drop

- [x] Create pipeline list page (`/pipelines`)
  - Grid view of all pipelines
  - Create new pipeline dialog
  - Archive/delete actions
  - Stage badges with colors
  - Candidate count per pipeline

- [x] Create pipeline detail page (`/pipelines/[id]`)
  - Kanban board placeholder (columns per stage)
  - Candidate count per stage
  - Assigned recruiters display
  - Navigation to settings

- [x] Create pipeline settings page (`/pipelines/[id]/settings`)
  - Edit pipeline name and description
  - Drag-and-drop stage reordering (@dnd-kit)
  - Add/edit/delete stages with color picker
  - Set default stage
  - Archive and delete pipeline options

### Files Created/Modified

```
/app/
  api/
    pipelines/
      route.ts                      - List/create pipelines
      [id]/
        route.ts                    - Get/update/delete pipeline
        stages/
          route.ts                  - List/create stages
          [stageId]/route.ts        - Get/update/delete stage
          reorder/route.ts          - Reorder stages
  (dashboard)/
    pipelines/
      page.tsx                      - Pipeline list page
      [id]/
        page.tsx                    - Pipeline detail (kanban placeholder)
        settings/page.tsx           - Pipeline settings with stage management

/components/ui/
  skeleton.tsx                      - Added skeleton component
```

### Dependencies Added

- `@dnd-kit/core` - Drag and drop functionality
- `@dnd-kit/sortable` - Sortable lists
- `@dnd-kit/utilities` - DnD utilities

### Technical Notes

1. **Role-based pipeline access:** OWNER/ADMIN see all pipelines; RECRUITER/VIEWER only see assigned pipelines
2. **Default stages:** New pipelines created with 6 default stages (Inbox, Screening, Interview, Offer, Hired, Rejected)
3. **Stage constraints:** Cannot delete default stage or stages with candidates
4. **Audit logging:** All pipeline and stage operations are logged

---

## Milestone 4: Kanban Board - COMPLETED

### Completed

- [x] Create Candidate CRUD API routes
  - GET `/api/pipelines/[id]/candidates` - List candidates with filtering
  - POST `/api/pipelines/[id]/candidates` - Create candidate
  - GET `/api/candidates/[id]` - Get candidate with full details
  - PUT `/api/candidates/[id]` - Update candidate
  - DELETE `/api/candidates/[id]` - Soft delete candidate

- [x] Create candidate move API
  - PUT `/api/candidates/[id]/move` - Move candidate between stages
  - Creates stage history entry
  - Audit logging for moves

- [x] Build kanban board components
  - `KanbanBoard` - Main board with @dnd-kit drag-drop
  - `KanbanColumn` - Stage column with droppable area
  - `CandidateCard` - Draggable candidate card
  - Horizontal scrolling for many stages

- [x] Create candidate quick view panel
  - Slide-in Sheet component
  - Contact info, tags, stage badge
  - Tabs for Notes, Files, History
  - Stage history timeline
  - Reject action

- [x] Add candidate creation modal
  - Create from toolbar or column
  - Full name, email, phone fields
  - Auto-assign to creating user

### Files Created/Modified

```
/app/
  api/
    candidates/
      [id]/
        route.ts              - Candidate CRUD
        move/route.ts         - Move candidate between stages
    pipelines/[id]/
      candidates/route.ts     - List/create candidates for pipeline
  (dashboard)/
    pipelines/[id]/
      page.tsx                - Updated with full kanban board

/components/
  kanban/
    index.ts                  - Exports
    kanban-board.tsx          - Main board with DnD context
    kanban-column.tsx         - Stage column
    candidate-card.tsx        - Draggable candidate card
    candidate-panel.tsx       - Slide-in detail panel
```

### Features

- **Drag and drop:** Move candidates between stages with visual feedback
- **Optimistic updates:** UI updates immediately, reverts on error
- **Search:** Filter candidates by name or email
- **Quick view:** Click candidate to see details in side panel
- **Stage history:** Track all candidate movements
- **Add candidate:** Create from toolbar or column "+" button

### Technical Notes

1. **@dnd-kit:** Used for drag-drop (same as stage reordering)
2. **Optimistic updates:** Immediate UI feedback with rollback on error
3. **Candidate grouping:** Server groups candidates by stage for efficient rendering
4. **Stage history:** Automatic entry when candidate moves

---

## Milestone 5: Table View - COMPLETED

### Completed

- [x] Enhance candidates API with pagination and sorting
  - Server-side pagination with `page` and `pageSize` params (max 100)
  - Server-side sorting with `sortField` and `sortOrder` params
  - Valid sort fields: fullName, email, createdAt, updatedAt, stage
  - View mode parameter to switch between kanban/table responses

- [x] Install and configure TanStack Table
  - @tanstack/react-table for data table functionality
  - Full TypeScript support with column definitions

- [x] Build candidates data table component
  - Columns: select, fullName, email, phone, stage, assignedTo, tags, createdAt, actions
  - Row selection with checkboxes
  - Sortable column headers
  - Stage badge with colors
  - Tag badges
  - Action dropdown per row

- [x] Add column visibility toggle
  - Dropdown to show/hide columns
  - Persists visibility state during session

- [x] Implement bulk actions
  - Select multiple candidates
  - Bulk move to stage (with stage picker)
  - Bulk reject
  - Bulk restore (unreject)
  - Bulk delete (soft delete)
  - Bulk assign/unassign
  - POST `/api/candidates/bulk` - Handles all bulk operations

- [x] Add table/kanban view toggle
  - Tabs to switch between Board and Table views
  - URL persistence via query parameter (`?view=table`)
  - Stage filter dropdown (works in both views)
  - View-specific data fetching

### Files Created/Modified

```
/app/
  api/
    candidates/
      bulk/route.ts           - Bulk actions API (move, reject, unreject, delete, assign)
    pipelines/[id]/
      candidates/route.ts     - Enhanced with pagination, sorting, view mode
  (dashboard)/
    pipelines/[id]/
      page.tsx                - Updated with view toggle, table view integration

/components/
  table/
    index.ts                  - Exports
    candidates-table.tsx      - Main data table component with TanStack Table
```

### Dependencies Added

- `@tanstack/react-table` - Data table functionality

### Features

- **Server-side pagination:** Handles 10,000+ candidates efficiently
- **Column sorting:** Click headers to sort (with server-side sorting)
- **Row selection:** Checkbox selection for bulk actions
- **Bulk actions bar:** Appears when rows selected with action buttons
- **Column visibility:** Toggle columns on/off via dropdown
- **View toggle:** Switch between kanban board and table views
- **Stage filter:** Filter by stage in both views

### Technical Notes

1. **TanStack Table:** Used for flexible, headless table with full TypeScript support
2. **Server-side operations:** Pagination and sorting handled by API for performance
3. **Dual view architecture:** Same API endpoint serves both kanban and table views
4. **Bulk action validation:** Ensures all candidates are in same pipeline before action
5. **Audit logging:** All bulk operations logged

---

## Milestone 6: Candidate Detail - COMPLETED

### Completed

- [x] Create Notes API (CRUD)
  - GET `/api/candidates/[id]/notes` - List notes for candidate
  - POST `/api/candidates/[id]/notes` - Create a note
  - GET `/api/candidates/[id]/notes/[noteId]` - Get single note
  - PUT `/api/candidates/[id]/notes/[noteId]` - Update note (owner or admin only)
  - DELETE `/api/candidates/[id]/notes/[noteId]` - Delete note (owner or admin only)

- [x] Create Tags API (CRUD + assign/remove)
  - GET `/api/tags` - List all tags
  - POST `/api/tags` - Create a new tag
  - GET `/api/candidates/[id]/tags` - List tags for candidate
  - POST `/api/candidates/[id]/tags` - Add tag to candidate
  - PUT `/api/candidates/[id]/tags` - Replace all tags (bulk update)
  - DELETE `/api/candidates/[id]/tags?tagId=...` - Remove tag from candidate

- [x] Create Attachments API with R2 upload
  - GET `/api/candidates/[id]/attachments` - List attachments with download URLs
  - POST `/api/candidates/[id]/attachments` - Upload file (multipart form)
  - DELETE `/api/candidates/[id]/attachments?attachmentId=...` - Delete attachment
  - R2 utility library for S3-compatible storage
  - File validation (10MB max, allowed MIME types)

- [x] Build full candidate detail page
  - `/candidates/[id]` - Dedicated candidate profile page
  - Header with name, email, phone, reject/restore/delete actions
  - Breadcrumb navigation back to pipeline

- [x] Build notes component with add/edit/delete
  - Notes list with author avatars
  - Add note form with textarea
  - Inline editing for notes
  - Delete confirmation dialog
  - Ownership-based permissions

- [x] Build attachments component with upload
  - File upload via input[type=file]
  - File type icons (PDF, image, Word, generic)
  - File size display
  - Download links
  - Delete with confirmation

- [x] Build tags management component
  - Tag badges with colors
  - Add tag popover with search
  - Create new tag inline
  - Remove tag button

- [x] Stage history timeline component
  - Timeline visualization
  - From/to stage badges with colors
  - User and timestamp for each move

### Files Created/Modified

```
/app/
  api/
    candidates/[id]/
      route.ts              - Enhanced with notes, attachments, stageHistory, _count
      notes/
        route.ts            - List/create notes
        [noteId]/route.ts   - Get/update/delete note
      tags/route.ts         - List/add/replace/remove tags
      attachments/route.ts  - List/upload/delete attachments
    tags/route.ts           - List/create tags
  (dashboard)/
    candidates/[id]/
      page.tsx              - Full candidate detail page

/components/
  candidates/
    index.ts                - Exports
    notes-section.tsx       - Notes list and form
    attachments-section.tsx - File upload and list
    tags-section.tsx        - Tag management popover
    stage-history.tsx       - Timeline component

/lib/
  r2.ts                     - Cloudflare R2 utilities
```

### Dependencies Added

- `@aws-sdk/client-s3` - S3-compatible client for R2
- `@aws-sdk/s3-request-presigner` - Pre-signed URLs
- `date-fns` - Date formatting utilities

### Features

- **Full candidate profile:** Dedicated page with all candidate information
- **Notes system:** Add, edit, delete notes with ownership permissions
- **File attachments:** Upload files to Cloudflare R2 with download links
- **Tag management:** Add/remove tags, create new tags inline
- **Stage history:** Visual timeline of candidate movements
- **Ownership permissions:** Users can only edit/delete their own content (admins can edit all)

### Technical Notes

1. **R2 integration:** Lazy-initialized S3 client with Cloudflare R2 endpoint
2. **File validation:** Server-side validation for file size and MIME type
3. **Pre-signed URLs:** For secure file downloads
4. **Optimistic updates:** UI updates immediately, reverts on error
5. **Audit logging:** All operations logged for compliance

---

## Milestone 7: CV Import - COMPLETED

### Completed

- [x] Create Import Batch API
  - GET `/api/imports` - List import batches
  - POST `/api/imports` - Create new import batch
  - GET `/api/imports/[batchId]` - Get batch details with items
  - DELETE `/api/imports/[batchId]` - Delete batch

- [x] Create file upload endpoint
  - POST `/api/imports/[batchId]/upload` - Upload multiple files
  - Files stored in Cloudflare R2
  - Validation: 10MB max, PDF/Word/TXT only

- [x] Create CV parsing utility
  - PDF text extraction using pdf-parse
  - Basic Word document text extraction
  - Name extraction (heuristic-based)
  - Email extraction (regex pattern)
  - Phone extraction (international formats)
  - Confidence scoring

- [x] Create batch processing endpoint
  - POST `/api/imports/[batchId]/process` - Process all files
  - Downloads files from R2
  - Parses CV content
  - Creates or updates candidates
  - Duplicate detection by email
  - Phone normalization to E.164 format

- [x] Build import page with file upload
  - `/import` - Import management page
  - Pipeline selector
  - Drag-and-drop or click to upload
  - Multiple file upload support
  - Upload progress display

- [x] Build import progress component
  - Real-time progress bar
  - Processing status updates
  - File-by-file status display
  - Success/failure counts

- [x] Add import history list
  - List of all import batches
  - Status badges (pending, processing, completed, failed)
  - View batch details
  - Delete old batches

### Files Created/Modified

```
/app/
  api/
    imports/
      route.ts              - List/create batches
      [batchId]/
        route.ts            - Get/delete batch
        upload/route.ts     - Upload files
        process/route.ts    - Process files
  (dashboard)/
    import/
      page.tsx              - Import management page

/lib/
  parsing/
    index.ts                - Exports
    cv-parser.ts            - CV parsing utilities
```

### Dependencies Added

- `pdf-parse` - PDF text extraction

### Features

- **Bulk file upload:** Upload multiple CVs at once
- **CV parsing:** Extract name, email, phone from PDFs and documents
- **Duplicate detection:** Matches by email to avoid duplicates
- **Progress tracking:** Real-time status updates during processing
- **Import history:** View and manage past imports
- **R2 storage:** Files stored in Cloudflare R2

### Technical Notes

1. **pdf-parse:** Dynamic import for ESM/CJS compatibility
2. **Heuristic parsing:** Basic name/email/phone extraction (production would use AI)
3. **E.164 normalization:** Phone numbers normalized with country code
4. **Confidence scoring:** 0-100 based on extracted data quality
5. **Batch processing:** Synchronous processing with progress updates

---

## Milestone 8: Email Templates - COMPLETED

### Completed

- [x] Create Email Templates CRUD API
  - GET `/api/templates` - List all templates with usage counts
  - POST `/api/templates` - Create new template with variable extraction
  - GET `/api/templates/[id]` - Get single template
  - PUT `/api/templates/[id]` - Update template
  - DELETE `/api/templates/[id]` - Soft delete template

- [x] Create Send Email API with Resend integration
  - GET `/api/candidates/[id]/emails` - List emails sent to candidate
  - POST `/api/candidates/[id]/emails` - Send email with template variables
  - Variable replacement: {{fullName}}, {{firstName}}, {{lastName}}, {{email}}, {{pipelineName}}, {{stageName}}
  - Email status tracking (PENDING, SENT, DELIVERED, OPENED, FAILED)
  - Error handling with status updates

- [x] Build Email Templates management page
  - `/templates` - Templates management page
  - Create/edit/delete templates
  - Template preview dialog
  - Variable insertion buttons
  - Search templates
  - Usage count display

- [x] Add email sending from candidate detail
  - Emails tab in candidate detail page
  - Compose email dialog with template selection
  - Email history with status badges
  - View sent email details

### Files Created/Modified

```
/app/
  api/
    templates/
      route.ts              - List/create templates
      [id]/route.ts         - Get/update/delete template
    candidates/[id]/
      emails/route.ts       - List/send emails
  (dashboard)/
    templates/
      page.tsx              - Templates management page
    candidates/[id]/
      page.tsx              - Added Emails tab

/components/
  candidates/
    emails-section.tsx      - Email compose and history component
    index.ts                - Added EmailsSection export
```

### Features

- **Template management:** Create, edit, delete email templates
- **Variable placeholders:** Use {{variable}} syntax for personalization
- **Email sending:** Send emails via Resend integration
- **Status tracking:** Track email delivery status
- **Email history:** View all emails sent to a candidate
- **Template preview:** Preview templates before editing

### Technical Notes

1. **Resend integration:** Uses existing Resend client with lazy initialization
2. **Variable extraction:** Automatically extracts {{variable}} patterns from templates
3. **Soft delete:** Templates are soft-deleted to preserve email log references
4. **HTML conversion:** Email body newlines converted to `<br>` tags
5. **Audit logging:** All email operations logged

---

## Milestone 9: Settings & User Management - COMPLETED

### Completed

- [x] Create Users API
  - GET `/api/users` - List all users with stats
  - GET `/api/users/[id]` - Get single user with details
  - PUT `/api/users/[id]` - Update user name/role
  - DELETE `/api/users/[id]` - Soft delete user
  - Role management with OWNER protection
  - Self-modification prevention

- [x] Create Audit Logs API
  - GET `/api/audit-logs` - List logs with filtering
  - Pagination support (page, pageSize)
  - Filter by action type, entity type, date range
  - Returns available filter options

- [x] Build Settings page
  - `/settings` - Settings page with tabs
  - Team tab for user management
  - Audit Log tab for activity viewing

- [x] Build Team Management section
  - User list with roles and status
  - Stats cards (total, active, pending)
  - Invite new users dialog
  - Change user role dialog
  - Remove user confirmation
  - Resend invitation action

- [x] Build Audit Log viewer
  - Paginated log table
  - Filter by action type
  - Filter by entity type
  - User attribution
  - Relative timestamps

### Files Created/Modified

```
/app/
  api/
    users/
      route.ts              - List users
      [id]/route.ts         - User CRUD
    audit-logs/
      route.ts              - List audit logs
  (dashboard)/
    settings/
      page.tsx              - Settings page with Team + Audit tabs
```

### Features

- **User management:** Invite, edit roles, remove team members
- **Role protection:** Cannot demote last owner, cannot change own role
- **Activity logging:** View all system changes with filtering
- **Pending invitations:** Track and resend invitations
- **User stats:** Dashboard of team composition

### Technical Notes

1. **Role hierarchy:** OWNER > ADMIN > RECRUITER > VIEWER
2. **Owner protection:** Last owner cannot be demoted or deleted
3. **Self-protection:** Users cannot change their own role or delete themselves
4. **Soft delete:** Users are soft-deleted to preserve audit trail
5. **Pagination:** Audit logs paginated with 20 per page

---

## Milestone 10: Candidate Merging - COMPLETED

### Completed

- [x] Create Duplicate Detection API
  - GET `/api/candidates/duplicates` - Find duplicate candidates
  - Groups by email (case-insensitive) and phone (E.164)
  - Filter by pipeline
  - Excludes already merged candidates
  - Returns stats (group count, total duplicates)

- [x] Create Candidate Merge API
  - POST `/api/candidates/merge` - Merge multiple candidates
  - Zod validation for request body
  - Moves notes, attachments, email logs to target
  - Transfers tags (avoiding duplicates)
  - Consolidates stage history
  - Fills missing fields from source candidates
  - Creates MergeLog entries for audit
  - Marks source candidates with `mergedIntoId`

- [x] Build Duplicates Management page
  - `/duplicates` - Dedicated page for duplicate management
  - Pipeline filter dropdown
  - Stats cards (duplicate groups, total duplicates)
  - Expandable duplicate groups
  - Email and phone duplicate indicators
  - Candidate details with notes/attachments count

- [x] Build Merge Dialog
  - Select primary record to keep
  - Radio button selection for target
  - "Oldest" and "Recommended" badges
  - Clear explanation of merge actions
  - Loading state during merge
  - Auto-refresh after successful merge

- [x] Add navigation to sidebar
  - Added "Duplicates" link with GitMerge icon
  - Placed between Candidates and Import

### Files Created/Modified

```
/app/
  api/
    candidates/
      duplicates/route.ts   - Duplicate detection API
      merge/route.ts        - Candidate merge API
  (dashboard)/
    duplicates/
      page.tsx              - Duplicates management page

/components/
  layout/
    sidebar.tsx             - Added Duplicates navigation item
  ui/
    radio-group.tsx         - Added RadioGroup component (shadcn)
```

### Features

- **Duplicate detection:** Find candidates with same email or phone
- **Smart grouping:** Groups by email first, then phone (avoiding duplicates)
- **Merge candidates:** Consolidate duplicate records into one
- **Data preservation:** All notes, files, emails, tags are transferred
- **Audit trail:** MergeLog tracks all merge operations
- **Pipeline filtering:** Focus on duplicates within a specific pipeline

### Technical Notes

1. **Email matching:** Case-insensitive email comparison
2. **Phone matching:** E.164 normalized phone comparison
3. **Merge transaction:** All operations wrapped in Prisma transaction
4. **Field filling:** Target candidate gets missing fields from sources
5. **Soft merge:** Source candidates marked as merged, not deleted
6. **RBAC protection:** Requires CANDIDATE_MERGE permission

---

## Milestone 11: Dashboard & Analytics - COMPLETED

### Completed

- [x] Create Analytics API endpoint
  - GET `/api/analytics` - Comprehensive analytics data
  - KPI metrics (total candidates, growth, hired, rejected, emails)
  - Pipeline funnel data (candidates per stage)
  - Time series data (candidates over time)
  - Source breakdown (where candidates come from)
  - Top recruiters (most active team members)
  - Recent activity feed
  - Filter by pipeline and date range (7/30/90 days)

- [x] Build Dashboard page with KPI cards
  - Total candidates with growth percentage
  - Active pipelines count
  - Hired vs rejected metrics
  - Emails sent with conversion rate
  - Period-over-period comparison

- [x] Add interactive charts
  - Area chart: Candidates over time
  - Pie chart: Candidate sources breakdown
  - Bar chart: Pipeline funnel visualization
  - Color-coded stage representation

- [x] Build Top Recruiters leaderboard
  - Ranked list of most active team members
  - Avatar and candidate count display
  - Period-based filtering

- [x] Build Recent Activity feed
  - Latest system actions
  - User attribution
  - Entity type badges
  - Relative timestamps

- [x] Add Dashboard to sidebar navigation
  - Dashboard link at the top of navigation
  - BarChart3 icon
  - Proper active state handling for root path

### Files Created/Modified

```
/app/
  api/
    analytics/route.ts      - Analytics API endpoint
  (dashboard)/
    page.tsx                - Full dashboard page with charts

/components/
  layout/
    sidebar.tsx             - Added Dashboard navigation item
```

### Dependencies Added

- `recharts` - React charting library for data visualization

### Features

- **KPI Dashboard:** At-a-glance view of key recruiting metrics
- **Trend Analysis:** Candidates over time with visual chart
- **Source Tracking:** Pie chart showing candidate origins
- **Pipeline Funnel:** Visual representation of stage distribution
- **Team Leaderboard:** Top recruiters by candidate volume
- **Activity Feed:** Recent system actions
- **Flexible Filtering:** Filter by pipeline and date range

### Technical Notes

1. **Recharts:** Used for responsive, customizable charts
2. **Date range:** Supports 7, 30, and 90-day periods
3. **Role-based filtering:** Respects pipeline access permissions
4. **Growth calculation:** Compares current vs previous period
5. **Conversion rate:** Based on candidates with stage movements
6. **Optimized queries:** Parallel database calls for performance

---

## Milestone 12: Advanced Search & Filters - COMPLETED

### Completed

- [x] Create Global Search API endpoint
  - GET `/api/search` - Comprehensive candidate search
  - Text search across name, email, phone, notes
  - Filter by pipeline, stage, tags, source
  - Filter by assigned recruiter
  - Filter by status (active, rejected, all)
  - Date range filters (createdAt)
  - Property filters (hasEmail, hasPhone, hasNotes, hasAttachments)
  - Server-side pagination and sorting
  - Role-based pipeline access control
  - Returns filter options for UI dropdowns

- [x] Create Saved Searches API
  - GET `/api/saved-searches` - List user's saved searches
  - POST `/api/saved-searches` - Create new saved search
  - GET `/api/saved-searches/[id]` - Get single saved search
  - PUT `/api/saved-searches/[id]` - Update saved search
  - DELETE `/api/saved-searches/[id]` - Delete saved search
  - Support for default search
  - Prisma SavedSearch model added

- [x] Build Advanced Search page
  - `/search` - Dedicated search page
  - Full-text search input
  - Collapsible filter panel
  - Pipeline and stage dropdowns
  - Status filter (active/rejected/all)
  - Source filter with counts
  - Assigned recruiter filter
  - Date range pickers
  - Checkbox filters (has email, phone, notes, files)
  - Tag multi-select with color badges
  - Active filter count badge
  - Clear all filters button
  - Paginated results with candidate cards

- [x] Add Saved Searches functionality
  - Save current filter as named search
  - Saved searches dropdown in header
  - Apply saved search with one click
  - Delete saved searches
  - Default search support

- [x] Add Search to sidebar navigation
  - Search link with Search icon
  - Placed after Candidates

### Files Created/Modified

```
/prisma/
  schema.prisma             - Added SavedSearch model

/app/
  api/
    search/route.ts         - Global search API
    saved-searches/
      route.ts              - List/create saved searches
      [id]/route.ts         - Get/update/delete saved search
  (dashboard)/
    search/
      page.tsx              - Advanced search page

/components/
  layout/
    sidebar.tsx             - Added Search navigation item
```

### Features

- **Global search:** Search across all accessible pipelines
- **Multi-filter:** Combine multiple filters for precise results
- **Saved searches:** Save and reuse complex filter combinations
- **Tag filtering:** Filter by multiple tags at once
- **Date ranges:** Find candidates created within a period
- **Property filters:** Filter by presence of email, phone, notes, files
- **Pagination:** Handle large result sets efficiently
- **Role-based access:** Respects pipeline permissions

### Technical Notes

1. **Prisma full-text:** Uses `contains` with `mode: insensitive` for search
2. **Tag filter:** Uses `some` relation filter for multi-tag matching
3. **Suspense boundary:** Search page uses Suspense for useSearchParams
4. **Filter serialization:** Filters stored as JSON in SavedSearch model
5. **Optimistic UI:** Filters update instantly, search on button click
6. **URL sync:** Search params reflected in URL for shareability

---

## How to Test Current Progress

```bash
cd talent-flow

# Install dependencies
pnpm install

# Generate Prisma client
npx prisma generate

# Setup database (requires PostgreSQL running)
# 1. Create database: createdb talent_flow
# 2. Update .env with DATABASE_URL
# 3. Push schema and seed:
npx prisma db push
pnpm db:seed

# Run development server
pnpm dev

# Test authentication:
# 1. Visit http://localhost:3000 (redirects to /login)
# 2. Login with admin@talentflow.com / admin123
# 3. Should redirect to dashboard

# Test pipelines:
# 1. Visit http://localhost:3000/pipelines
# 2. View the seeded "Sales Recruitment" pipeline
# 3. Create a new pipeline via "New Pipeline" button
# 4. Click on a pipeline to view details
# 5. Click "Settings" to manage stages
# 6. Drag stages to reorder them
# 7. Add/edit/delete stages

# Test kanban board:
# 1. Click on a pipeline to view the kanban board
# 2. Click "Add Candidate" to create a candidate
# 3. Drag candidates between stages
# 4. Click a candidate card to open the detail panel
# 5. Use search bar to filter candidates
# 6. Click "Reject" in panel to reject a candidate

# Test table view:
# 1. Click on a pipeline to view it
# 2. Click "Table" tab to switch to table view
# 3. Click column headers to sort
# 4. Use checkboxes to select multiple candidates
# 5. Use bulk action buttons (Move, Reject, Delete)
# 6. Click "Columns" to toggle column visibility
# 7. Use pagination controls at bottom
# 8. Use stage filter dropdown

# Test candidate detail:
# 1. Click a candidate card or row to open detail panel
# 2. Click "View in Pipeline" or navigate to /candidates/[id]
# 3. Add a note using "Add Note" button
# 4. Edit or delete your notes
# 5. Upload a file (PDF, image, Word doc)
# 6. Download or delete files
# 7. Add/remove tags using the "+" button
# 8. Create a new tag inline
# 9. View stage history timeline

# Test CV import:
# 1. Navigate to /import
# 2. Select a pipeline from the dropdown
# 3. Click "Select Files" and choose CV files (PDF, Word, TXT)
# 4. Click "Process" to start parsing
# 5. Watch progress bar and file statuses
# 6. View created candidates in the pipeline
# 7. Check import history for past imports

# Test email templates:
# 1. Navigate to /templates
# 2. Click "New Template" to create a template
# 3. Use variable buttons to insert {{fullName}}, {{pipelineName}}, etc.
# 4. Save the template
# 5. Click the preview icon to view the template
# 6. Edit or delete templates as needed
# 7. Navigate to a candidate detail page
# 8. Click the "Emails" tab
# 9. Click "Send Email" to compose
# 10. Select a template or write from scratch
# 11. Send the email (requires RESEND_API_KEY in .env)
# 12. View sent emails in the history

# Test settings & user management:
# 1. Navigate to /settings
# 2. View team stats (total, active, pending users)
# 3. Click "Invite User" to send an invitation
# 4. Fill in email, name, and select a role
# 5. Click the menu on a user to change their role
# 6. Try to remove a user (with confirmation)
# 7. Switch to the "Audit Log" tab
# 8. View system activity with timestamps
# 9. Use filters to narrow down by action or entity type
# 10. Use pagination to browse older entries

# Test candidate merging:
# 1. Navigate to /duplicates
# 2. View stats cards (duplicate groups, total duplicates)
# 3. Filter by pipeline using the dropdown
# 4. Click on a duplicate group to expand it
# 5. View candidate details (pipeline, stage, notes, attachments)
# 6. Click "Merge" button on a group
# 7. Select which candidate to keep as primary
# 8. Review what will happen during merge
# 9. Click "Merge Candidates" to confirm
# 10. Verify the duplicates are merged and removed from the list

# Test dashboard & analytics:
# 1. Navigate to / (Dashboard is the home page)
# 2. View KPI cards (total candidates, pipelines, hired, emails)
# 3. Check the growth percentage indicator
# 4. View the "Candidates Over Time" area chart
# 5. View the "Candidate Sources" pie chart
# 6. View the "Pipeline Funnel" bar chart
# 7. Check the "Top Recruiters" leaderboard
# 8. Check the "Recent Activity" feed
# 9. Use the pipeline filter dropdown to filter by pipeline
# 10. Use the date range dropdown (7/30/90 days)
# 11. Click "View Pipeline" to navigate to a specific pipeline

# Test advanced search & filters:
# 1. Navigate to /search
# 2. Enter a search term in the search bar
# 3. Click "Search" or press Enter
# 4. Click "Filters" to expand the filter panel
# 5. Select a pipeline from the dropdown
# 6. Select a stage (available after selecting pipeline)
# 7. Filter by status (Active, Rejected, All)
# 8. Select a source from the dropdown
# 9. Filter by assigned recruiter
# 10. Set date range with "Created After" and "Created Before"
# 11. Check "Has Email", "Has Phone", "Has Notes", "Has Files"
# 12. Click on tags to filter by multiple tags
# 13. Click "Clear All" to reset filters
# 14. Click "Save Search" to save current filters
# 15. Enter a name and click "Save"
# 16. Click "Saved Searches" to view saved searches
# 17. Click a saved search to apply it
# 18. Click candidate name to view details
# 19. Use pagination to browse results
```

## Environment Setup Required

Create `.env` file:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/talent_flow"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# For email sending (optional - emails will fail without this)
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxx"
RESEND_FROM_EMAIL="noreply@yourdomain.com"
```

Generate NEXTAUTH_SECRET: `openssl rand -base64 32`

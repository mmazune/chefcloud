# M18 – Document & Receipt Management Design

**Milestone**: M18 – Document & Receipt Management Hardening  
**Step**: 1 – Target Architecture & Design  
**Status**: Complete  
**Date**: 2025-11-22

---

## 1. Executive Summary

ChefCloud now requires a first-class document subsystem that matches the rigor of prior milestones (M7–M17). This design document converts the Step 0 inventory findings into an actionable blueprint covering schema, service layers, storage abstractions, RBAC, APIs, integrations, and testing. The goal is to ship a production-ready system that lets finance, operations, HR, and events staff upload, organize, and retrieve invoices, delivery notes, contracts, payslips, and other critical artifacts while maintaining strict tenant isolation and auditability.

Key tenets:

1. **Single Source of Truth** – A normalized `Document` model scoped by `orgId`, linking to core records (ServiceProvider, PurchaseOrder, StockBatch, PayRun, PaySlip, Reservation, EventBooking, BankStatement, Employee, FiscalInvoice).
2. **Pluggable Storage** – Abstract file persistence behind `IStorageProvider`; ship Local disk in V1, leave S3/GCS ready.
3. **Enterprise RBAC** – Category-level access guardrails layered atop existing RolesGuard + platform access, plus audit logging for uploads/views/deletes.
4. **Rich Search & UX Hooks** – Filter/sort by category, entity, uploader, date, tags; helper endpoints per entity to simplify UI integration.
5. **Backwards-Compatible Integrations** – No schema mutations to existing entities beyond nullable FKs; optional linking flows to avoid breaking procurement, HR, accounting, or bookings.

---

## 2. Requirements Traceability

| Requirement                     | Source                  | Design Element                                       |
| ------------------------------- | ----------------------- | ---------------------------------------------------- |
| Structured document storage     | Step 0 gaps             | `Document` model + indexes                           |
| Strong entity linking           | User brief              | FK fields + linking helper endpoints                 |
| Secure access & audit           | User brief / AuditEvent | RBAC matrix + `AuditEvent` hooks                     |
| Searchable/filterable           | User brief              | `/documents` filters, pagination, sorting            |
| Upload/view/download            | User brief              | DocumentsController endpoints + storage provider     |
| Non-breaking migrations         | Constraint              | Nullable FK additions only, no existing column edits |
| Non-interactive Prisma workflow | Constraint              | Step 2 instructions captured in migration plan       |

---

## 3. Data Model

### 3.1 Prisma Entities

```prisma
enum DocumentCategory {
  INVOICE
  STOCK_RECEIPT
  CONTRACT
  HR_DOC
  BANK_STATEMENT
  PAYSLIP
  RESERVATION_DOC
  OTHER
}

enum StorageProvider {
  LOCAL
  S3
  GCS
}

model Document {
  id              String            @id @default(cuid())
  orgId           String
  branchId        String?
  category        DocumentCategory
  fileName        String
  mimeType        String
  sizeBytes       Int
  storageProvider StorageProvider   @default(LOCAL)
  storageKey      String            @unique
  checksum        String?
  uploadedById    String
  uploadedAt      DateTime          @default(now())
  tags            String[]          @default([])
  notes           String?
  deletedAt       DateTime?

  // Entity links (all optional to avoid breaking legacy flows)
  serviceProviderId String?
  purchaseOrderId   String?
  goodsReceiptId    String?
  stockBatchId      String?
  payRunId          String?
  paySlipId         String?
  reservationId     String?
  eventBookingId    String?
  bankStatementId   String?
  employeeId        String?
  fiscalInvoiceId   String?

  // Relations
  org             Org              @relation(fields: [orgId], references: [id], onDelete: Cascade)
  branch          Branch?          @relation(fields: [branchId], references: [id], onDelete: SetNull)
  uploader        User             @relation("DocumentUploader", fields: [uploadedById], references: [id], onDelete: Restrict)
  serviceProvider ServiceProvider? @relation(fields: [serviceProviderId], references: [id], onDelete: SetNull)
  purchaseOrder   PurchaseOrder?   @relation(fields: [purchaseOrderId], references: [id], onDelete: SetNull)
  goodsReceipt    GoodsReceipt?    @relation(fields: [goodsReceiptId], references: [id], onDelete: SetNull)
  stockBatch      StockBatch?      @relation(fields: [stockBatchId], references: [id], onDelete: SetNull)
  payRun          PayRun?          @relation(fields: [payRunId], references: [id], onDelete: SetNull)
  paySlip         PaySlip?         @relation(fields: [paySlipId], references: [id], onDelete: SetNull)
  reservation     Reservation?     @relation(fields: [reservationId], references: [id], onDelete: SetNull)
  eventBooking    EventBooking?    @relation(fields: [eventBookingId], references: [id], onDelete: SetNull)
  bankStatement   BankStatement?   @relation(fields: [bankStatementId], references: [id], onDelete: SetNull)
  employee        Employee?        @relation(fields: [employeeId], references: [id], onDelete: SetNull)
  fiscalInvoice   FiscalInvoice?   @relation(fields: [fiscalInvoiceId], references: [id], onDelete: SetNull)

  // Indexes
  @@index([orgId])
  @@index([orgId, category])
  @@index([orgId, uploadedAt])
  @@index([branchId])
  @@index([serviceProviderId])
  @@index([purchaseOrderId])
  @@index([goodsReceiptId])
  @@index([stockBatchId])
  @@index([payRunId])
  @@index([paySlipId])
  @@index([reservationId])
  @@index([eventBookingId])
  @@index([bankStatementId])
  @@index([employeeId])
  @@index([fiscalInvoiceId])
  @@index([deletedAt])
  @@map("documents")
}
```

**Reverse Relations** (added to existing models):

```prisma
model Org {
  // ... existing fields
  documents Document[]
}

model Branch {
  // ... existing fields
  documents Document[]
}

model User {
  // ... existing fields
  uploadedDocuments Document[] @relation("DocumentUploader")
}

model ServiceProvider {
  // ... existing fields
  documents Document[]
}

model PurchaseOrder {
  // ... existing fields
  documents Document[]
}

model GoodsReceipt {
  // ... existing fields
  documents Document[]
}

model StockBatch {
  // ... existing fields
  documents Document[]
}

model PayRun {
  // ... existing fields
  documents Document[]
}

model PaySlip {
  // ... existing fields
  documents Document[]
}

model Reservation {
  // ... existing fields
  documents Document[]
}

model EventBooking {
  // ... existing fields
  documents Document[]
}

model BankStatement {
  // ... existing fields
  documents Document[]
}

model Employee {
  // ... existing fields
  documents Document[]
}

model FiscalInvoice {
  // ... existing fields
  documents Document[]
}
```

### 3.2 ERD (ASCII)

```
            ┌──────────────┐          ┌────────────┐
            │ ServiceProv. │◄─────────┤ Document   │────────► PurchaseOrder
            └──────────────┘          │            │────────► GoodsReceipt
                                      │ category   │────────► StockBatch
┌──────────────┐                      │ storageKey │────────► PaySlip
│ Reservation  │◄─────────────────────┤ ...        │────────► EventBooking
└──────────────┘                      └────────────┘────────► BankStatement
                                                     └──────► Employee
                                                     └──────► FiscalInvoice
```

### 3.3 Derived Metadata

- `checksum` (optional SHA-256) enables future duplicate detection
- `tags` stores lightweight keywords (e.g., `["Q4-2025", "NSSF"]`)
- `notes` allows human comments (e.g., "Awaiting supplier confirmation")
- `deletedAt` enables soft delete (not physically removed)

---

## 4. Storage Architecture

### 4.1 Interfaces

```typescript
export interface SaveOptions {
  orgId: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
}

export interface SignedUrlOptions {
  expiresInSeconds?: number; // default 3600
}

export interface SaveResult {
  storageKey: string;
  checksum?: string;
}

export interface IStorageProvider {
  save(buffer: Buffer, options: SaveOptions): Promise<SaveResult>;
  getSignedUrl(storageKey: string, options?: SignedUrlOptions): Promise<string>;
  delete(storageKey: string): Promise<void>;
}

export const DOCUMENTS_STORAGE_TOKEN = 'DOCUMENTS_STORAGE_TOKEN';
```

### 4.2 Providers

| Provider                              | Use Case                        | Implementation Notes                                                                                                        |
| ------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **LocalStorageProvider** (V1 default) | Dev/codespaces, SMB deployments | Saves to `/data/documents/{orgId}/{category}/{uuid}-{fileName}`; generates `file://` URLs guarded by API download endpoint. |
| **S3StorageProvider** (V2)            | Production cloud tenants        | Uses `@aws-sdk/client-s3`; bucket + prefix per org; signed URL expiry 1h.                                                   |
| **GCSStorageProvider** (future)       | GCP tenants                     | Mirrors S3 provider using `@google-cloud/storage`.                                                                          |

**Environment Variables**:

```bash
STORAGE_PROVIDER=local|s3|gcs                    # defaults to local
DOCUMENTS_BASE_PATH=/data/documents              # local disk root
DOCUMENTS_MAX_SIZE_BYTES=26214400                # 25 MB default
DOCUMENTS_REMOVE_ON_DELETE=false                 # physical delete on soft delete
DOCUMENTS_S3_BUCKET=chefcloud-docs               # when S3 enabled
DOCUMENTS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### 4.3 Security Controls

- **File Size**: Max 25 MB (configurable via `DOCUMENTS_MAX_SIZE_BYTES`)
- **MIME Validation**: Accept common types (PDF, PNG, JPG, CSV, XLSX, DOCX)
- **Signed URLs**: Time-limited (1 hour default) for download access
- **Virus Scanning**: Out of scope for V1 (future enhancement)
- **Magic Bytes**: Basic MIME sniffing to prevent spoofing (future enhancement)

---

## 5. API Design

### 5.1 Routes Overview

| Method | Route                                    | Description                    | RBAC                                   |
| ------ | ---------------------------------------- | ------------------------------ | -------------------------------------- |
| POST   | `/documents`                             | Multipart upload + metadata    | Category-based (see matrix below)      |
| GET    | `/documents`                             | List/search documents          | L3+ with category permission           |
| GET    | `/documents/:id`                         | Fetch metadata + download URL  | Category permission + org/branch scope |
| DELETE | `/documents/:id`                         | Soft delete (sets `deletedAt`) | L4+ or category-specific               |
| GET    | `/documents/links/service-providers/:id` | Filter by service provider     | L3+                                    |
| GET    | `/documents/links/purchase-orders/:id`   | Filter by PO                   | L3+                                    |
| GET    | `/documents/links/stock-batches/:id`     | Filter by stock batch          | L3+                                    |
| GET    | `/documents/links/pay-slips/:id`         | Filter by payslip              | L2+ (employee self) or HR              |
| GET    | `/documents/links/event-bookings/:id`    | Filter by event booking        | L3+                                    |
| GET    | `/documents/links/employees/:id`         | Filter by employee             | L4+ (HR)                               |

### 5.2 DTOs

```typescript
export class CreateDocumentDto {
  @IsEnum(DocumentCategory)
  category: DocumentCategory;

  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() serviceProviderId?: string;
  @IsOptional() @IsString() purchaseOrderId?: string;
  @IsOptional() @IsString() goodsReceiptId?: string;
  @IsOptional() @IsString() stockBatchId?: string;
  @IsOptional() @IsString() payRunId?: string;
  @IsOptional() @IsString() paySlipId?: string;
  @IsOptional() @IsString() reservationId?: string;
  @IsOptional() @IsString() eventBookingId?: string;
  @IsOptional() @IsString() bankStatementId?: string;
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsString() fiscalInvoiceId?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() notes?: string;
}

export class ListDocumentsDto {
  @IsOptional() @IsEnum(DocumentCategory) category?: DocumentCategory;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() uploadedById?: string;
  @IsOptional() @IsString() serviceProviderId?: string;
  @IsOptional() @IsString() purchaseOrderId?: string;
  // ... other link filters
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() cursor?: string; // documentId for pagination
  @IsOptional() @IsIn(['uploadedAt', 'fileName', 'category']) sortBy?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sortDir?: string;
}
```

### 5.3 Example Payloads

**POST /documents (multipart)**

```http
POST /documents HTTP/1.1
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="category"

INVOICE
------WebKitFormBoundary
Content-Disposition: form-data; name="purchaseOrderId"

po_clhxjkm0000001
------WebKitFormBoundary
Content-Disposition: form-data; name="tags"

oct-2025,cogs
------WebKitFormBoundary
Content-Disposition: form-data; name="notes"

Pending approval from finance
------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="invoice-123.pdf"
Content-Type: application/pdf

<binary data>
------WebKitFormBoundary--
```

**Response**:

```json
{
  "id": "doc_clhxjkm0000002",
  "orgId": "org_abc123",
  "branchId": null,
  "category": "INVOICE",
  "fileName": "invoice-123.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 1048576,
  "storageProvider": "LOCAL",
  "storageKey": "org_abc123/invoice/1700000000000-uuid-invoice-123.pdf",
  "checksum": "sha256:abcd1234...",
  "uploadedById": "user_123",
  "uploadedAt": "2025-11-22T09:15:00Z",
  "tags": ["oct-2025", "cogs"],
  "notes": "Pending approval from finance",
  "purchaseOrderId": "po_clhxjkm0000001"
}
```

**GET /documents?category=INVOICE&from=2025-11-01&limit=20**

```json
{
  "data": [
    {
      "id": "doc_123",
      "category": "INVOICE",
      "fileName": "invoice-123.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 1048576,
      "uploadedAt": "2025-11-22T09:15:00Z",
      "uploadedBy": { "id": "user_1", "name": "Jane Accountant" },
      "tags": ["oct-2025"],
      "notes": "Pending approval"
    }
  ],
  "nextCursor": null
}
```

**GET /documents/:id**

```json
{
  "document": {
    "id": "doc_123",
    "category": "INVOICE",
    "fileName": "invoice-123.pdf",
    "...": "..."
  },
  "downloadUrl": "file:///data/documents/org_abc/invoice/..."
}
```

---

## 6. RBAC & Compliance

### 6.1 Category Matrix

| Category            | Upload                           | View                        | Delete  | Notes                                   |
| ------------------- | -------------------------------- | --------------------------- | ------- | --------------------------------------- |
| **INVOICE**         | L4+ (ACCOUNTANT, MANAGER, OWNER) | L4+                         | L5 only | Financial docs require senior approval  |
| **STOCK_RECEIPT**   | L3+ (STOCK, PROCUREMENT, CHEF)   | L3+                         | L4+     | Procurement can upload, managers delete |
| **CONTRACT**        | L4+                              | L4+                         | L5 only | Contracts are sensitive                 |
| **HR_DOC**          | L4+ (HR, OWNER)                  | L4+ (HR, OWNER)             | L5 only | Contains PII                            |
| **BANK_STATEMENT**  | L4+ (ACCOUNTANT, OWNER)          | L4+                         | L5 only | Financial compliance                    |
| **PAYSLIP**         | L4+ (HR, OWNER)                  | Employee (self) or L4+ (HR) | L5 only | Employees can view their own            |
| **RESERVATION_DOC** | L3+ (Events, Manager)            | L3+                         | L4+     | Event contracts/deposits                |
| **OTHER**           | L4+                              | L4+                         | L5 only | Catch-all for misc docs                 |

**Special Cases**:

- **Payslip Self-Access**: Employees (any level) can view payslips where `paySlip.userId === user.id`
- **Branch Scoping**: Users L3 and below can only access documents from their assigned branch unless document has no branch or user is L4+

**Enforcement**:

- Controller-level `@Roles()` decorator gates coarse actions
- `DocumentsService` runs fine-grained checks:
  - Category permission matrix
  - Payslip self-access logic
  - Branch isolation for L3 and below
- All actions log to `AuditEvent`:
  - `document.uploaded`
  - `document.viewed`
  - `document.deleted`

### 6.2 Tenant & Branch Isolation

```typescript
// Pseudo-code enforcement
function ensureAccess(user, document) {
  // 1. Org isolation (always)
  if (document.orgId !== user.orgId) throw Forbidden;

  // 2. Branch isolation (for L1-L3)
  if (user.roleLevel < 'L4' && document.branchId) {
    if (document.branchId !== user.branchId) throw Forbidden;
  }

  // 3. Category permission
  if (document.category === 'PAYSLIP') {
    // Special case: employee self-access
    const paySlip = await getPaySlip(document.paySlipId);
    if (paySlip.userId === user.id) return; // allowed
  }

  const required = CATEGORY_POLICY[document.category]['view'];
  if (user.roleLevel < required) throw Forbidden;
}
```

---

## 7. Service Layer Design

### 7.1 DocumentsService Responsibilities

```typescript
@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    @Inject(DOCUMENTS_STORAGE_TOKEN) private storage: IStorageProvider,
    private config: ConfigService,
  ) {}

  async createDocument(options: CreateDocumentOptions): Promise<Document> {
    // 1. RBAC check (category + user role)
    // 2. Validate file payload (size, type)
    // 3. Validate entity links (FK existence)
    // 4. Save file via storage provider
    // 5. Create DB record
    // 6. Log audit event
  }

  async getDocument(documentId: string, user: RequestUserContext) {
    // 1. Fetch from DB (with paySlip relation if applicable)
    // 2. RBAC check (category + self-access logic)
    // 3. Branch access check
    // 4. Generate signed URL
    // 5. Log audit event
    // 6. Return { document, downloadUrl }
  }

  async listDocuments(user: RequestUserContext, filters: ListDocumentsFilters) {
    // 1. Build Prisma where clause (org, branch, category, links, dates, tags)
    // 2. Apply RBAC (category permission if filtered, branch scope)
    // 3. Paginate (cursor-based)
    // 4. Return { data, nextCursor }
  }

  async deleteDocument(documentId: string, user: RequestUserContext) {
    // 1. Fetch existing
    // 2. RBAC check (delete permission)
    // 3. Soft delete (set deletedAt)
    // 4. Optional: physical delete via storage.delete()
    // 5. Log audit event
  }
}
```

### 7.2 StorageProviderFactory

```typescript
@Module({
  providers: [
    {
      provide: DOCUMENTS_STORAGE_TOKEN,
      useFactory: (config: ConfigService): IStorageProvider => {
        const provider = config.get('STORAGE_PROVIDER', 'local');
        if (provider === 's3') {
          return new S3StorageProvider(config); // Future
        }
        return new LocalStorageProvider(config.get('DOCUMENTS_BASE_PATH', '/data/documents'));
      },
      inject: [ConfigService],
    },
  ],
})
export class DocumentsModule {}
```

### 7.3 Validation Helpers

```typescript
private ensureCategoryPermission(
  action: 'upload' | 'view' | 'delete',
  category: DocumentCategory,
  userRole: RoleLevel,
  document?: Document,
  user?: RequestUserContext,
) {
  // L5 bypasses all
  if (userRole === 'L5') return;

  // Payslip self-access
  if (action === 'view' && category === 'PAYSLIP' && document) {
    if (document.paySlip?.userId === user.userId) return;
  }

  const required = CATEGORY_POLICY[category][action];
  if (getRoleRank(userRole) < getRoleRank(required)) {
    throw new ForbiddenException('Insufficient permission');
  }
}
```

---

## 8. Integration Plan

### 8.1 M7 Service Providers

**Endpoints**:

- `GET /documents/links/service-providers/:serviceProviderId`
- Filters documents by `serviceProviderId`

**Use Cases**:

- Upload utility bills
- Upload service contracts
- Link invoices to vendors

**Example**:

```bash
# Upload contract
curl -X POST /documents \
  -F "category=CONTRACT" \
  -F "serviceProviderId=sp_123" \
  -F "file=@contract.pdf"

# List contracts
curl /documents/links/service-providers/sp_123?category=CONTRACT
```

### 8.2 M3 Procurement & Inventory

**Endpoints**:

- `GET /documents/links/purchase-orders/:purchaseOrderId`
- `GET /documents/links/goods-receipts/:goodsReceiptId`
- `GET /documents/links/stock-batches/:stockBatchId`

**Use Cases**:

- Attach supplier invoices to POs
- Attach delivery notes to goods receipts
- Link quality certificates to stock batches

**Example**:

```bash
# Upload invoice to PO
curl -X POST /documents \
  -F "category=INVOICE" \
  -F "purchaseOrderId=po_456" \
  -F "file=@supplier-invoice.pdf"
```

### 8.3 M8 Accounting

**Endpoints**:

- `GET /documents/links/bank-statements/:bankStatementId`

**Use Cases**:

- Upload scanned bank statements
- Link to reconciliation records

**Example**:

```bash
# Upload bank statement
curl -X POST /documents \
  -F "category=BANK_STATEMENT" \
  -F "bankStatementId=stmt_789" \
  -F "file=@statement-nov-2025.pdf"
```

### 8.4 M9 Payroll & HR

**Endpoints**:

- `GET /documents/links/pay-runs/:payRunId`
- `GET /documents/links/pay-slips/:paySlipId`
- `GET /documents/links/employees/:employeeId`

**Use Cases**:

- Generate and store PDF payslips
- Store employee HR documents (contracts, certificates, IDs)
- Payroll summaries

**Example**:

```bash
# Upload payslip (auto-generated by system)
# Employee can view: GET /documents/links/pay-slips/{their-payslip-id}

# HR uploads employee contract
curl -X POST /documents \
  -F "category=HR_DOC" \
  -F "employeeId=emp_012" \
  -F "tags=contract,2025" \
  -F "file=@employee-contract.pdf"
```

### 8.5 M15 Bookings & Events

**Endpoints**:

- `GET /documents/links/reservations/:reservationId`
- `GET /documents/links/event-bookings/:eventBookingId`

**Use Cases**:

- Event contracts with performers
- Client agreements
- Deposit receipts

**Example**:

```bash
# Upload event contract
curl -X POST /documents \
  -F "category=RESERVATION_DOC" \
  -F "eventBookingId=evt_345" \
  -F "tags=performer-agreement" \
  -F "file=@dj-contract.pdf"
```

### 8.6 M17 Tax & Compliance

**Endpoints**:

- `GET /documents/links/fiscal-invoices/:fiscalInvoiceId`

**Use Cases**:

- Store EFRIS PDF receipts
- Link to fiscal invoice records

**Example**:

```bash
# System-generated EFRIS receipt
curl -X POST /documents \
  -F "category=INVOICE" \
  -F "fiscalInvoiceId=finv_678" \
  -F "file=@efris-receipt.pdf"
```

---

## 9. Search & UX Considerations

### 9.1 Filtering

**Supported Filters**:

- `category`: DocumentCategory enum
- `branchId`: Filter by branch
- `uploadedById`: Filter by uploader
- `serviceProviderId`, `purchaseOrderId`, `stockBatchId`, etc.: Filter by linked entity
- `from` / `to`: Date range (`uploadedAt`)
- `tags`: Array of tags (has-some match)

**Defaults**:

- Sort by `uploadedAt DESC`
- Limit 20 per page
- Cursor-based pagination (stable ordering)

### 9.2 Pagination

**Cursor Strategy**:

```typescript
// Request
GET /documents?limit=20&cursor=doc_123

// Response
{
  "data": [...],
  "nextCursor": "doc_145"  // null if no more results
}

// Next request
GET /documents?limit=20&cursor=doc_145
```

### 9.3 Response Format

**List Response**:

```json
{
  "data": [
    {
      "id": "doc_123",
      "category": "INVOICE",
      "fileName": "invoice.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 1048576,
      "uploadedAt": "2025-11-22T10:00:00Z",
      "uploadedBy": { "id": "user_1", "name": "Jane" },
      "tags": ["q4"],
      "notes": "Pending",
      "purchaseOrder": { "id": "po_1", "number": "PO-001" } // Optional linked entity
    }
  ],
  "nextCursor": "doc_124"
}
```

### 9.4 Convenience Endpoints

Pattern: `GET /documents/links/{entity-type}/:id`

These endpoints are syntactic sugar that internally call `listDocuments` with appropriate filters:

```typescript
@Get('documents/links/purchase-orders/:purchaseOrderId')
async listForPurchaseOrder(
  @User() user: any,
  @Param('purchaseOrderId') purchaseOrderId: string,
  @Query() query: ListDocumentsDto,
) {
  return this.documentsService.listDocuments(user, {
    ...query,
    purchaseOrderId,
  });
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

**DocumentsService**:

- `createDocument()`:
  - ✅ Creates document with valid category and links
  - ✅ Validates file size limits
  - ✅ Enforces RBAC (reject L2 uploading INVOICE)
  - ✅ Validates entity FK existence
  - ✅ Logs audit event
  - ❌ Rejects cross-org document creation

- `getDocument()`:
  - ✅ Returns document + signed URL
  - ✅ Enforces category permission
  - ✅ Allows payslip self-access
  - ❌ Rejects cross-org access
  - ❌ Rejects cross-branch access (L3 user)

- `listDocuments()`:
  - ✅ Filters by category, branch, dates
  - ✅ Paginates with cursor
  - ✅ Scopes to user's org
  - ✅ Restricts L3 to their branch

- `deleteDocument()`:
  - ✅ Soft deletes document
  - ✅ Enforces L5-only for INVOICE
  - ❌ Rejects delete by L3

**LocalStorageProvider**:

- ✅ Saves file to correct path
- ✅ Generates checksum
- ✅ Returns signed URL (file://)
- ✅ Deletes file
- ✅ Sanitizes file names

### 10.2 Integration Tests

**DocumentsController**:

- `POST /documents`:
  - ✅ Uploads file with metadata
  - ✅ Returns document record
  - ❌ Rejects oversized files
  - ❌ Rejects invalid category

- `GET /documents`:
  - ✅ Lists documents with filters
  - ✅ Paginates correctly
  - ✅ Scopes to user org

- `GET /documents/:id`:
  - ✅ Returns document + URL
  - ❌ 404 for non-existent
  - ❌ 403 for cross-org

- `DELETE /documents/:id`:
  - ✅ Soft deletes
  - ❌ 403 for insufficient role

### 10.3 E2E Tests (Selective)

**Scenario 1**: Attach invoice to PO

```typescript
it('should allow L4 to upload invoice and link to PO', async () => {
  const po = await createTestPO();
  const file = Buffer.from('fake pdf');

  const res = await request(app.getHttpServer())
    .post('/documents')
    .set('Authorization', `Bearer ${l4Token}`)
    .field('category', 'INVOICE')
    .field('purchaseOrderId', po.id)
    .attach('file', file, 'invoice.pdf')
    .expect(201);

  expect(res.body.purchaseOrderId).toBe(po.id);

  const list = await request(app.getHttpServer())
    .get(`/documents/links/purchase-orders/${po.id}`)
    .set('Authorization', `Bearer ${l4Token}`)
    .expect(200);

  expect(list.body.data).toHaveLength(1);
});
```

**Scenario 2**: Employee views own payslip

```typescript
it('should allow employee to view their own payslip document', async () => {
  const paySlip = await createTestPaySlip({ userId: employee.id });
  const doc = await uploadDocument({
    category: 'PAYSLIP',
    paySlipId: paySlip.id,
  });

  const res = await request(app.getHttpServer())
    .get(`/documents/${doc.id}`)
    .set('Authorization', `Bearer ${employeeToken}`)
    .expect(200);

  expect(res.body.document.id).toBe(doc.id);
  expect(res.body.downloadUrl).toBeDefined();
});
```

**Scenario 3**: Reject cross-org access

```typescript
it('should reject cross-org document access', async () => {
  const doc = await uploadDocument({ orgId: 'org-A' });

  await request(app.getHttpServer())
    .get(`/documents/${doc.id}`)
    .set('Authorization', `Bearer ${orgBUserToken}`)
    .expect(403);
});
```

### 10.4 Regression Tests

- Ensure existing endpoints unaffected:
  - Procurement flows still work
  - Payroll generation doesn't break
  - Bookings remain functional
- Use snapshot tests where available

---

## 11. Deployment & Migration Plan

### 11.1 Schema Migration

**Steps** (from `packages/db`):

```bash
# 1. Load DB URL
source .env

# 2. Create migration directory
MIG_NAME="$(date +%Y%m%d%H%M%S)_m18_documents"
mkdir -p prisma/migrations/$MIG_NAME

# 3. Generate migration SQL
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/$MIG_NAME/migration.sql

# 4. Apply migration
npx prisma migrate deploy

# 5. Regenerate Prisma client
npx prisma generate
```

### 11.2 Rollout Order

1. **Phase 1**: Schema + Service (No UI exposure)
   - Deploy Document model
   - Deploy DocumentsService + LocalStorageProvider
   - Wire into DocumentsModule
   - **No API routes enabled yet**

2. **Phase 2**: API Endpoints (Limited Beta)
   - Enable DocumentsController
   - Test with Postman/curl
   - Verify RBAC and storage
   - Monitor logs for errors

3. **Phase 3**: Integration (Selective)
   - Enable convenience endpoints
   - Integrate with one flow (e.g., PO invoices)
   - Gather feedback

4. **Phase 4**: General Availability
   - Document in DEV_GUIDE
   - Announce to users
   - Monitor usage and storage

### 11.3 Feature Flags

**Optional**: Use existing `FeatureFlag` model:

```typescript
await prisma.featureFlag.create({
  data: {
    key: 'documents_upload',
    description: 'Enable document upload system',
    active: false, // Enable after testing
    rolloutPct: 0,
  },
});
```

Check in controller:

```typescript
@Post('documents')
async uploadDocument(...) {
  const flag = await this.prisma.featureFlag.findUnique({
    where: { key: 'documents_upload' },
  });
  if (!flag?.active) throw new ServiceUnavailableException();
  // ... proceed
}
```

---

## 12. Known Limitations

### 12.1 V1 Scope

**Included**:

- ✅ Local storage provider
- ✅ Basic RBAC per category
- ✅ Entity linking (11 entity types)
- ✅ Soft delete
- ✅ Pagination and filtering
- ✅ Audit logging

**Excluded** (Future Enhancements):

- ❌ S3/GCS storage providers
- ❌ Virus scanning
- ❌ OCR / full-text search
- ❌ Document versioning
- ❌ Thumbnail generation
- ❌ Storage quotas per org
- ❌ Automated retention policies
- ❌ Bulk upload/download
- ❌ Document templates
- ❌ E-signature integration

### 12.2 Performance Considerations

**Current Limitations**:

- Single storage provider per deployment (no per-org override)
- No CDN for frequently accessed docs
- No lazy-loading of large file lists (mitigated by pagination)

**Mitigations**:

- Cursor-based pagination (handles large datasets)
- Indexes on frequently queried fields
- Signed URL caching (future)

### 12.3 Security Considerations

**Current Protections**:

- Org/branch isolation
- Role-based access control
- Audit logging
- Signed URLs (time-limited)

**Future Enhancements**:

- Magic byte validation (MIME spoofing prevention)
- Virus scanning integration
- DLP (Data Loss Prevention) policies
- Encryption at rest (S3 SSE, GCS CMEK)

---

## 13. Success Criteria

### 13.1 Functional Requirements

- ✅ Users can upload documents with category + entity links
- ✅ Users can list/filter documents by org, branch, category, entity, date
- ✅ Users can view/download documents (with signed URLs)
- ✅ Users can delete documents (soft delete)
- ✅ RBAC enforced per category
- ✅ Audit events logged for all operations

### 13.2 Non-Functional Requirements

- ✅ File uploads < 25 MB complete within 30s
- ✅ List queries return within 500ms (for 100 docs)
- ✅ Tenant isolation: Zero cross-org data leakage
- ✅ Storage path collision-free (UUID in storageKey)
- ✅ API builds without TypeScript errors
- ✅ Lint passes for new/modified files

### 13.3 Integration Requirements

- ✅ At least 3 entity types integrated (PO, PaySlip, EventBooking)
- ✅ Convenience endpoints functional
- ✅ Existing flows unaffected (no regressions)

---

## 14. Future Roadmap

### 14.1 V2 Enhancements

1. **S3/GCS Storage Providers**:
   - Multi-cloud support
   - Per-org storage configuration
   - CDN integration

2. **Advanced Search**:
   - Full-text search (ElasticSearch)
   - OCR for scanned PDFs
   - Metadata extraction

3. **Document Workflows**:
   - Approval chains (e.g., L4 approval required)
   - Status tracking (PENDING, APPROVED, REJECTED)
   - Notifications on upload

4. **Versioning**:
   - Track document versions
   - View history
   - Restore previous versions

5. **Compliance & Security**:
   - Virus scanning (ClamAV)
   - DLP policies
   - Encryption at rest
   - Retention policies (auto-delete after N days)

6. **UX Enhancements**:
   - Thumbnail generation (images, PDFs)
   - Inline preview (iframe)
   - Bulk operations (upload, download, delete)
   - Drag-and-drop upload

---

## 15. Appendices

### 15.1 Environment Variables Reference

```bash
# Storage
STORAGE_PROVIDER=local                           # local | s3 | gcs
DOCUMENTS_BASE_PATH=/data/documents              # Local storage root
DOCUMENTS_MAX_SIZE_BYTES=26214400                # 25 MB default
DOCUMENTS_REMOVE_ON_DELETE=false                 # Physical delete on soft delete

# S3 (when STORAGE_PROVIDER=s3)
DOCUMENTS_S3_BUCKET=chefcloud-docs
DOCUMENTS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# GCS (when STORAGE_PROVIDER=gcs)
DOCUMENTS_GCS_BUCKET=chefcloud-docs
DOCUMENTS_GCS_PROJECT_ID=chefcloud-prod
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### 15.2 Curl Examples

```bash
# Upload invoice linked to PO
curl -X POST http://localhost:3001/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "category=INVOICE" \
  -F "purchaseOrderId=po_123" \
  -F "tags=q4-2025,cogs" \
  -F "notes=Supplier ABC invoice" \
  -F "file=@/path/to/invoice.pdf"

# List invoices
curl -X GET "http://localhost:3001/documents?category=INVOICE&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# List documents for specific PO
curl -X GET "http://localhost:3001/documents/links/purchase-orders/po_123" \
  -H "Authorization: Bearer $TOKEN"

# Get document with download URL
curl -X GET "http://localhost:3001/documents/doc_456" \
  -H "Authorization: Bearer $TOKEN"

# Delete document
curl -X DELETE "http://localhost:3001/documents/doc_456" \
  -H "Authorization: Bearer $TOKEN"
```

### 15.3 RBAC Quick Reference

| Role                    | Can Upload                     | Can View        | Can Delete                     |
| ----------------------- | ------------------------------ | --------------- | ------------------------------ |
| L1 (Waiter)             | ❌                             | ❌              | ❌                             |
| L2 (Cashier)            | ❌                             | PAYSLIP (self)  | ❌                             |
| L3 (Chef/Stock)         | STOCK_RECEIPT, RESERVATION_DOC | Own branch only | ❌                             |
| L4 (Manager/Accountant) | All categories                 | All categories  | STOCK_RECEIPT, RESERVATION_DOC |
| L5 (Owner)              | All categories                 | All categories  | All categories                 |

---

**Status**: ✅ Step 1 Design Complete  
**Next**: Step 2 – Schema Implementation

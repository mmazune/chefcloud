# M18 Step 0 – Document & File System Inventory

**Date**: 2025-11-22  
**Milestone**: M18 – Document & Receipt Management Hardening  
**Purpose**: Read-only inventory of existing document/file concepts in ChefCloud

---

## 1. Existing File/Document-Related Functionality

### 1.1 PDF Generation (Reports & Tickets)

**Location**: `services/worker/src/` and `services/api/src/`

- **Owner Digests** (`owner.service.ts`):
  - Generates PDF reports using `pdfkit`
  - Includes sales charts, sparklines, payment breakdowns
  - Sends via email with CSV attachments
  - Files stored temporarily in `/tmp`

- **Shift-End Reports** (`worker/src/index.ts`, `pdf-helpers.ts`):
  - Comprehensive PDF reports for shift closing
  - CSV exports for machine-readable data
  - Email delivery with PDF/CSV attachments

- **Event Tickets** (`bookings.service.ts`, `checkin.controller.ts`):
  - PDF ticket generation with QR codes
  - Download endpoint: `GET /events/booking/:id/ticket`
  - Uses `pdfkit` and `qrcode` libraries
  - Returns Buffer, streamed to response

- **Period Digests** (`worker/src/index.ts`):
  - Weekly/monthly reports with PDF and CSV
  - Email delivery to subscribed recipients

**Storage**: All PDFs are generated in-memory or in `/tmp` - **no persistent storage**

### 1.2 Email Attachments

**SMTP Configuration** (`owner.service.ts`):

```typescript
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE
- Uses nodemailer for email delivery
- Attachments: PDF, CSV files
```

**Email Types**:

- Owner digests (PDF + 3 CSVs)
- Shift-end reports (PDF + CSV)
- Period reports (PDF + optional CSVs)

**Storage**: Attachments are ephemeral - generated, emailed, discarded

### 1.3 Swagger/OpenAPI Documentation

**Location**: `services/api/src/docs/swagger.ts`

- Exposes API documentation at `/docs`
- JSON spec at `/openapi.json`
- Not related to business document storage

---

## 2. Existing Prisma Schema - Document-Related

### 2.1 Models with Potential Document Links

```prisma
// Procurement & Inventory
model ServiceProvider { ... }
model PurchaseOrder { ... }
model GoodsReceipt { ... }
model StockBatch { ... }

// Accounting
model VendorBill { ... }    // Could link invoices
model BankStatement { ... }  // Could link statement PDFs
model BankTxn { ... }

// HR & Payroll
model PayRun { ... }         // Could link payroll summaries
model PaySlip { ... }        // Could link PDF payslips
model Employee { ... }
model EmployeeProfile { ... } // Contains employee data

// Events & Bookings
model Event { ... }
model EventBooking { ... }   // Could link contracts, tickets
model Reservation { ... }    // Could link contracts

// Tax & Compliance
model FiscalInvoice { ... }  // Could link EFRIS PDFs
```

### 2.2 Notable Fields

**No existing file/document storage fields found in schema**:

- No `documentUrl`, `attachmentUrl`, `fileUrl` fields
- No `storageKey`, `fileName`, `mimeType` fields
- No `Document` or `Attachment` model

**Audit Trail** (`AuditEvent`):

- Tracks actions but doesn't link to documents
- Could be enhanced to log document operations

### 2.3 Enums

Existing enums relevant to documents:

```prisma
enum AccountType { ... }
enum PaymentTerms { ... }
enum BillStatus { ... }
enum InvoiceStatus { ... }
enum ReminderType { VENDOR_BILL, UTILITY }
enum ReminderChannel { EMAIL, SLACK, SMS }
```

**No document category enum exists**

---

## 3. Gaps vs Requirements

### 3.1 Missing: Persistent Document Storage

**Current State**:

- PDFs generated transiently (in-memory or `/tmp`)
- No database records tracking documents
- No file persistence beyond email delivery

**Required**:

- Persistent storage (local disk or S3/GCS)
- Database model tracking document metadata
- Storage provider abstraction

### 3.2 Missing: Document Model & Relationships

**Current State**:

- No `Document` table
- No foreign keys linking documents to entities

**Required**:

```prisma
model Document {
  id              String
  orgId           String
  branchId        String?
  category        DocumentCategory enum
  fileName        String
  mimeType        String
  sizeBytes       Int
  storageProvider StorageProvider enum
  storageKey      String @unique
  checksum        String?
  uploadedById    String
  uploadedAt      DateTime
  tags            String[]
  notes           String?
  deletedAt       DateTime?

  // Entity links
  serviceProviderId?
  purchaseOrderId?
  goodsReceiptId?
  stockBatchId?
  payRunId?
  paySlipId?
  reservationId?
  eventBookingId?
  bankStatementId?
  employeeId?
  fiscalInvoiceId?
}
```

### 3.3 Missing: Document Categories

**Current State**: No categorization

**Required**:

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
```

### 3.4 Missing: Upload & Management APIs

**Current State**:

- No upload endpoints
- No document listing/search
- No download/view endpoints

**Required**:

- `POST /documents` - multipart upload
- `GET /documents` - list/search with filters
- `GET /documents/:id` - fetch metadata + signed URL
- `DELETE /documents/:id` - soft delete
- Convenience endpoints per entity (e.g., `/service-providers/:id/documents`)

### 3.5 Missing: RBAC for Documents

**Current State**:

- Existing role system (`RoleLevel`: L1-L5)
- Role guards on endpoints

**Required**:

- Category-based access control:
  - INVOICE: L4+ (ACCOUNTANT, MANAGER, OWNER)
  - STOCK_RECEIPT: L3+ (STOCK, PROCUREMENT, CHEF)
  - CONTRACT: L4+
  - HR_DOC: L4+ (HR, OWNER)
  - BANK_STATEMENT: L4+ (ACCOUNTANT, OWNER)
  - PAYSLIP: L4+ or employee self-access
  - RESERVATION_DOC: L3+
  - OTHER: L4+

### 3.6 Missing: Storage Abstraction

**Current State**:

- Direct file system writes in worker
- No abstraction layer

**Required**:

```typescript
interface IStorageProvider {
  save(buffer: Buffer, options: SaveOptions): Promise<SaveResult>;
  getSignedUrl(storageKey: string, options?: UrlOptions): Promise<string>;
  delete(storageKey: string): Promise<void>;
}

class LocalStorageProvider implements IStorageProvider { ... }
class S3StorageProvider implements IStorageProvider { ... }  // Future
```

### 3.7 Missing: Audit Logging for Documents

**Current State**:

- `AuditEvent` model exists
- Used for critical operations

**Required**:

- Log document uploads: `document.uploaded`
- Log document views: `document.viewed`
- Log document deletes: `document.deleted`
- Include metadata: category, fileName, linked entities

### 3.8 Missing: Integration Points

**Areas needing document support**:

1. **M7 Service Providers**:
   - Link contracts, utility bills, invoices
   - Endpoints: `POST /service-providers/:id/documents`

2. **M3 Procurement & Inventory**:
   - Attach supplier invoices to POs
   - Attach delivery notes to goods receipts
   - Link quality certs to stock batches

3. **M8 Accounting**:
   - Link scanned invoices to vendor bills
   - Attach bank statements to reconciliation

4. **M9 Payroll & HR**:
   - Generate and store PDF payslips
   - Store employee HR documents (contracts, certs)

5. **M15 Bookings & Events**:
   - Store event contracts
   - Store performer agreements
   - Store deposit receipts

6. **M17 Tax & Compliance**:
   - Store EFRIS PDF receipts
   - Link to FiscalInvoice records

---

## 4. Technology Stack Observations

### 4.1 Current Libraries

- **PDF Generation**: `pdfkit` (already in use)
- **QR Codes**: `qrcode` (already in use)
- **Email**: `nodemailer` (already configured)
- **File System**: Node.js `fs/promises`

### 4.2 Recommended Additions

For M18 implementation:

- **Multer**: Already available via `@nestjs/platform-express` for multipart uploads
- **File Validation**: Built-in (size limits, MIME type checks)
- **Storage SDKs**: Future S3/GCS support:
  - `@aws-sdk/client-s3` for S3
  - `@google-cloud/storage` for GCS

---

## 5. Non-Functional Observations

### 5.1 Security

**Current State**:

- RBAC enforced via guards
- Tenant isolation via `orgId` + `branchId`
- JWT authentication

**Document Requirements**:

- Tenant isolation (org + branch scoping)
- Access controls per category
- Audit trail for compliance
- Signed URLs with expiry

### 5.2 Performance

**Current Concerns**:

- Large file uploads (need size limits)
- Storage quota management (future)
- Signed URL caching (future)

**Mitigations**:

- Max file size: 25 MB (configurable)
- Lazy loading of document lists (pagination)
- Indexes on frequently queried fields

### 5.3 Scalability

**Future Considerations**:

- S3/GCS for production scale
- CDN for frequently accessed documents
- Thumbnail generation for images (out of scope for M18)

---

## 6. Summary

### 6.1 What Exists

✅ PDF generation infrastructure (pdfkit, QR codes)  
✅ Email delivery with attachments  
✅ RBAC and authentication system  
✅ Audit event logging framework  
✅ Tenant isolation patterns

### 6.2 What's Missing (M18 Scope)

❌ Persistent document storage  
❌ Document database model  
❌ Document category taxonomy  
❌ Upload/download APIs  
❌ Storage provider abstraction  
❌ Document-entity relationships  
❌ Search and filtering  
❌ Integration with procurement, accounting, HR, events

### 6.3 Implementation Strategy

1. **Step 1**: Design document model and relationships
2. **Step 2**: Implement Prisma schema and migration
3. **Step 3**: Build DocumentsService with storage abstraction
4. **Step 4**: Create upload/list/view APIs
5. **Step 5**: Integrate with existing modules (M7, M8, M9, M15)
6. **Step 6**: Add search and convenience endpoints
7. **Step 7**: Tests and documentation

---

## 7. Open Questions

1. **Virus Scanning**: Out of scope for V1?
   - **Decision**: Yes, defer to future enhancement

2. **File Versioning**: Support multiple versions of same document?
   - **Decision**: No, soft delete only for V1

3. **OCR/Full-Text Search**: Extract text from PDFs?
   - **Decision**: No, defer to V2

4. **Storage Quotas**: Per-org limits?
   - **Decision**: Not enforced in V1, monitoring only

5. **Retention Policies**: Auto-delete after N days?
   - **Decision**: Manual deletion only for V1

---

**Status**: ✅ Step 0 Complete  
**Next**: Step 1 – Design Document

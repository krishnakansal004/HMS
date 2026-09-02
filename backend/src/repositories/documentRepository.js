import { db } from '../config/db.js';

// Metadata only. This does NOT handle accepting a file upload or choosing
// where it's stored -- that's the still-open storage-backend decision
// (locked decision #1: real Cloudinary for invoices, everything else
// undecided). This module assumes a file already exists somewhere with a
// real URL, and just registers/tracks/lists that against whatever
// patient/invoice/prescription/etc. it belongs to. Wire actual upload
// handling in once the storage decision is made -- don't guess at a
// provider here.
export class DocumentRepository {

  static async create({ tenantId, entityType, entityId, uploadedBy, url, publicId, mimeType, sizeBytes }) {
    return db.document.create({
      data: {
        tenant_id: tenantId,
        entity_type: entityType,
        entity_id: entityId,
        uploaded_by: uploadedBy || null,
        url,
        public_id: publicId || null,
        mime_type: mimeType || null,
        size_bytes: sizeBytes || null
      }
    });
  }

  static async findByIdAndTenant(documentId, tenantId) {
    return db.document.findFirst({ where: { document_id: documentId, tenant_id: tenantId } });
  }

  static async findByEntity({ tenantId, entityType, entityId }) {
    return db.document.findMany({
      where: { tenant_id: tenantId, entity_type: entityType, entity_id: entityId },
      orderBy: { created_at: 'desc' }
    });
  }

  static async deleteByIdAndTenant(documentId, tenantId) {
    // Removes the metadata row only -- does not delete the underlying
    // file from wherever it's actually stored. Once a storage backend is
    // chosen, the service layer calling this needs to also call that
    // provider's delete API, or you'll accumulate orphaned files.
    return db.document.deleteMany({ where: { document_id: documentId, tenant_id: tenantId } });
  }
}

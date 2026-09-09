import { jest, describe, beforeEach, expect, it } from '@jest/globals'

const repository = {
  findByIdAndTenant: jest.fn(),
  deleteByIdAndTenant: jest.fn(),
}
const audit = { logAction: jest.fn() }

jest.unstable_mockModule('../src/repositories/documentRepository.js', () => ({
  DocumentRepository: repository,
}))
jest.unstable_mockModule('../src/services/auditService.js', () => ({
  AuditService: audit,
}))

const { DocumentService } = await import('../src/services/documentService.js')

describe('security regression: document object authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    repository.findByIdAndTenant.mockResolvedValue({
      document_id: 'document-a',
      tenant_id: 'tenant-a',
      uploaded_by: 'doctor-a',
      entity_type: 'PATIENT',
      entity_id: 'patient-a',
      url: 'https://example.test/document-a',
    })
    repository.deleteByIdAndTenant.mockResolvedValue({ count: 1 })
  })

  it('allows the uploader to delete their own document', async () => {
    await expect(DocumentService.deleteDocument({
      tenantId: 'tenant-a',
      userId: 'doctor-a',
      userRole: 'DOCTOR',
      documentId: 'document-a',
    })).resolves.toEqual({ success: true })

    expect(repository.deleteByIdAndTenant).toHaveBeenCalledWith('document-a', 'tenant-a')
  })

  it('rejects a doctor deleting another user\'s document', async () => {
    await expect(DocumentService.deleteDocument({
      tenantId: 'tenant-a',
      userId: 'doctor-b',
      userRole: 'DOCTOR',
      documentId: 'document-a',
    })).rejects.toMatchObject({ statusCode: 403 })

    expect(repository.deleteByIdAndTenant).not.toHaveBeenCalled()
  })

  it('allows a hospital admin to delete a tenant document', async () => {
    await expect(DocumentService.deleteDocument({
      tenantId: 'tenant-a',
      userId: 'admin-a',
      userRole: 'HOSPITAL_ADMIN',
      documentId: 'document-a',
    })).resolves.toEqual({ success: true })
  })
})

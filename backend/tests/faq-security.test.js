import { jest, describe, beforeEach, expect, it } from '@jest/globals'

const faq = { deleteMany: jest.fn() }

jest.unstable_mockModule('../src/config/db.js', () => ({ db: { faq } }))

const { FaqService } = await import('../src/services/faqService.js')

describe('security regression: FAQ tenant ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    faq.deleteMany.mockResolvedValue({ count: 1 })
  })

  it('deletes a hospital FAQ only within the authenticated tenant', async () => {
    await expect(FaqService.deleteFaq({
      tenantId: 'tenant-a',
      userRole: 'HOSPITAL_ADMIN',
      faqId: 'faq-a',
    })).resolves.toEqual({ success: true, deleted: 'faq-a' })

    expect(faq.deleteMany).toHaveBeenCalledWith({
      where: { faq_id: 'faq-a', tenant_id: 'tenant-a' },
    })
  })

  it('restricts global FAQ deletion to the System Owner path', async () => {
    await expect(FaqService.deleteFaq({
      tenantId: null,
      userRole: 'SYSTEM_OWNER',
      faqId: 'faq-global',
    })).resolves.toEqual({ success: true, deleted: 'faq-global' })

    expect(faq.deleteMany).toHaveBeenCalledWith({
      where: { faq_id: 'faq-global', tenant_id: null },
    })
  })
})

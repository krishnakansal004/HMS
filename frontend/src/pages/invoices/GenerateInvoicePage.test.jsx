import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import GenerateInvoicePage from './GenerateInvoicePage.jsx';
import { invoicesApi } from '../../api/invoices.js';

// Mock dependencies
vi.mock('../../api/patients.js', () => ({
  patientsApi: { list: vi.fn().mockResolvedValue({ data: [{ patient_id: '123', first_name: 'John', last_name: 'Doe' }] }) }
}));
vi.mock('../../api/invoices.js', () => ({
  invoicesApi: { create: vi.fn().mockResolvedValue({}) },
  INVOICE_ITEM_TYPES: ['CONSULTATION', 'MEDICINE']
}));

describe('GenerateInvoicePage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('restores draft state from sessionStorage', async () => {
    const mockDraft = {
      patientId: '123',
      discount: '50',
      items: [{ entityType: 'CONSULTATION', description: 'Checkup', quantity: 1, unitPrice: '500', gstRate: 0 }]
    };
    sessionStorage.setItem('invoice_draft', JSON.stringify(mockDraft));

    render(<MemoryRouter><GenerateInvoicePage /></MemoryRouter>);
    
    // Wait for patients to load
    await waitFor(() => expect(screen.queryByText(/Loading patients/i)).not.toBeInTheDocument());

    // Verify fields populated from draft
    expect(screen.getByDisplayValue('Checkup')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    expect(screen.getByDisplayValue('50')).toBeInTheDocument(); // Discount
  });

  it('clears draft and navigates on successful submission', async () => {
    render(<MemoryRouter><GenerateInvoicePage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText(/Loading patients/i)).not.toBeInTheDocument());

    // Fill form
    fireEvent.change(screen.getByRole('combobox', { name: /Choose a patient/i }), { target: { value: '123' } });
    fireEvent.change(screen.getByPlaceholderText('Description / Name'), { target: { value: 'New Test' } });
    fireEvent.change(screen.getByPlaceholderText('Price (₹)'), { target: { value: '100' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Generate & Save/i }));

    await waitFor(() => {
      expect(invoicesApi.create).toHaveBeenCalled();
      // Ensure storage was wiped
      expect(sessionStorage.getItem('invoice_draft')).toBeNull();
    });
  });
});
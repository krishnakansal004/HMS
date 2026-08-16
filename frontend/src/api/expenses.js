import { api } from './client.js';

// Maps to backend/src/routes/expenses.js + expenseValidator.js

export const expensesApi = {
  /** @param {{category?:string, startDate?:string, endDate?:string, page?:number, limit?:number}} query */
  list: (query) => api.get('/expenses', query),

  /** @param {{title:string, category:string, amount:number, expenseDate?:string}} data */
  create: (data) => api.post('/expenses', data),

  remove: (id) => api.delete(`/expenses/${id}`),
};

export const EXPENSE_CATEGORIES = [
  'SALARY', 'MAINTENANCE', 'UTILITIES', 'EQUIPMENT', 'MEDICINE_PURCHASE', 'MARKETING', 'RENT', 'MISCELLANEOUS',
];

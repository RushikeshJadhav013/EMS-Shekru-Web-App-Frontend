import { apiService } from '@/lib/api';

export interface VendorCreatePayload {
  vendor_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
}

export interface VendorResponse {
  vendor_id: number;
  company_id: number;
  vendor_name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface ExpenseDashboardCategory {
  category_name: string;
  expense_count: number;
  total_amount: number;
}

/**
 * Valid Expense Category Enum defined in Swagger openapi schema:
 * components.schemas.ExpenseCategoryEnum
 */
export const SWAGGER_EXPENSE_CATEGORIES = [
  'Travel & Conveyance',
  'Food & Refreshments',
  'Office Supplies',
  'Stationery',
  'Electricity',
  'Internet & Telephone',
  'Rent & Maintenance',
  'Software / Subscription',
  'Employee Welfare',
  'Client Meeting',
  'Marketing',
  'Courier',
  'Repairs & Maintenance',
  'Miscellaneous',
] as const;

export type SwaggerExpenseCategory = typeof SWAGGER_EXPENSE_CATEGORIES[number];

/**
 * Maps any frontend category value (label, slug, or normalized text)
 * to the exact backend ExpenseCategoryEnum required by Swagger.
 */
export const mapToExpenseCategoryEnum = (categoryInput?: string | null): SwaggerExpenseCategory | string => {
  if (!categoryInput) return 'Miscellaneous';
  const trimmed = categoryInput.trim();

  // 1. Direct exact case-insensitive match against Swagger ExpenseCategoryEnum
  const exactMatch = SWAGGER_EXPENSE_CATEGORIES.find(
    (c) => c.toLowerCase() === trimmed.toLowerCase()
  );
  if (exactMatch) return exactMatch;

  // 2. Alphanumeric normalized matching (handles 'travel_conveyance', 'travel___conveyance', 'travel & conveyance', etc.)
  const normInput = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  const fuzzyMatch = SWAGGER_EXPENSE_CATEGORIES.find(
    (c) => c.toLowerCase().replace(/[^a-z0-9]/g, '') === normInput
  );
  if (fuzzyMatch) return fuzzyMatch;

  // 3. Common partial/alias mappings
  if (normInput.includes('travel') || normInput.includes('conveyance')) return 'Travel & Conveyance';
  if (normInput.includes('food') || normInput.includes('refreshment')) return 'Food & Refreshments';
  if (normInput.includes('office') || normInput.includes('supplies')) return 'Office Supplies';
  if (normInput.includes('stationery') || normInput.includes('paper')) return 'Stationery';
  if (normInput.includes('electric') || normInput.includes('power')) return 'Electricity';
  if (normInput.includes('internet') || normInput.includes('tele') || normInput.includes('phone') || normInput.includes('mobile')) return 'Internet & Telephone';
  if (normInput.includes('rent')) return 'Rent & Maintenance';
  if (normInput.includes('software') || normInput.includes('subscription') || normInput.includes('saas')) return 'Software / Subscription';
  if (normInput.includes('welfare') || normInput.includes('medical') || normInput.includes('health')) return 'Employee Welfare';
  if (normInput.includes('meeting') || normInput.includes('client')) return 'Client Meeting';
  if (normInput.includes('market') || normInput.includes('ads')) return 'Marketing';
  if (normInput.includes('courier') || normInput.includes('shipping')) return 'Courier';
  if (normInput.includes('repair') || normInput.includes('hardware')) return 'Repairs & Maintenance';

  return trimmed;
};

export interface ExpenseCreatePayload {
  category: string;
  sub_category: string;
  expense_date: string; // ISO datetime e.g. 2026-09-01T10:00:00Z or date-time string
  amount: number | string;
  description?: string | null;
  vendor_id?: number | null;
  invoice_number?: string | null;
  invoice_date?: string | null; // YYYY-MM-DD
  gst_number?: string | null;
  gst_amount?: number | string | null;
  cost_center?: string | null;
  project_name?: string | null;
  client_name?: string | null;
}

export interface ExpenseUpdatePayload {
  category?: string | null;
  sub_category?: string | null;
  expense_date?: string | null;
  amount?: number | string | null;
  description?: string | null;
  vendor_id?: number | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  gst_number?: string | null;
  gst_amount?: number | string | null;
  cost_center?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  payment_mode?: string | null;
  payment_date?: string | null;
  transaction_reference?: string | null;
}

export interface ExpenseOut {
  expense_id: number;
  company_id: number;
  user_id: number;
  category: string;
  sub_category: string;
  expense_date: string;
  amount: number | string;
  description?: string | null;
  vendor_id?: number | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  gst_number?: string | null;
  gst_amount?: number | string | null;
  cost_center?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  status: string; // 'pending' | 'approved' | 'rejected' | 'closed'
  approved_amount?: number | string | null;
  approved_by?: number | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  payment_mode?: string | null;
  payment_date?: string | null;
  transaction_reference?: string | null;
  payment_status: string; // 'unpaid' | 'paid' etc.
  paid_by?: number | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
  employee_name?: string | null;
  user_name?: string | null;
}

export interface ExpenseListResponse {
  total?: number;
  page?: number;
  limit?: number;
  total_pages?: number;
  expenses: ExpenseOut[];
}

export interface ExpenseFilterParams {
  status?: string;
  category?: string;
  start_date?: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
  search?: string;
  page?: number;
  limit?: number;
}

export interface ExpenseApprovePayload {
  approved_amount?: number | string | null;
}

export interface ExpenseRejectPayload {
  rejection_reason: string;
}

export interface ExpensePaymentPayload {
  payment_mode: string;
  payment_date: string; // YYYY-MM-DD
  transaction_reference?: string | null;
}

export interface ExpenseDocumentResponse {
  document_id: number;
  expense_id: number;
  document_name: string;
  document_type?: string | null;
  uploaded_by?: number | null;
  uploaded_at: string;
}

export const expensesService = {
  /**
   * GET /{company_slug}/expenses/
   * List Expenses with pagination & filters
   */
  async getExpenses(filters?: ExpenseFilterParams): Promise<ExpenseListResponse> {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters?.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiService.request(`/expenses/${query}`, {
      method: 'GET',
    });

    // Support both direct array response: [ ... ] and object response: { expenses: [ ... ] }
    if (Array.isArray(res)) {
      return {
        total: res.length,
        page: filters?.page || 1,
        limit: filters?.limit || res.length,
        total_pages: 1,
        expenses: res,
      };
    }

    if (res && Array.isArray(res.expenses)) {
      return res;
    }

    if (res && Array.isArray(res.data)) {
      return {
        total: res.total || res.data.length,
        page: res.page || filters?.page || 1,
        limit: res.limit || filters?.limit || res.data.length,
        total_pages: res.total_pages || 1,
        expenses: res.data,
      };
    }

    return {
      total: 0,
      page: 1,
      limit: 10,
      total_pages: 0,
      expenses: [],
    };
  },

  /**
   * GET /{company_slug}/expenses/dashboard
   * Expense Dashboard stats
   */
  async getExpenseDashboard(): Promise<ExpenseDashboardCategory[]> {
    const res = await apiService.request('/expenses/dashboard', {
      method: 'GET',
    });
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    if (res && Array.isArray(res.categories)) return res.categories;
    return [];
  },

  /**
   * GET /{company_slug}/expenses/categories
   * Categories list
   */
  async getExpenseCategories(): Promise<string[]> {
    const res = await apiService.request('/expenses/categories', {
      method: 'GET',
    });
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.categories)) return res.categories;
    if (res && Array.isArray(res.data)) return res.data;
    return [];
  },

  /**
   * POST /{company_slug}/expenses/
   * Create Expense Record
   */
  async createExpense(payload: ExpenseCreatePayload): Promise<ExpenseOut> {
    return apiService.request('/expenses/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * GET /{company_slug}/vendors/
   * List Vendors
   */
  async getVendors(): Promise<VendorResponse[]> {
    const res = await apiService.request('/vendors/', {
      method: 'GET',
    });
    return Array.isArray(res) ? res : res?.vendors || res?.data || [];
  },

  /**
   * POST /{company_slug}/vendors/
   * Create Vendor
   */
  async createVendor(payload: VendorCreatePayload): Promise<VendorResponse> {
    return apiService.request('/vendors/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * GET /{company_slug}/expenses/{expense_id}
   * Get Expense Record
   */
  async getExpenseById(expenseId: number): Promise<ExpenseOut> {
    return apiService.request(`/expenses/${expenseId}`, {
      method: 'GET',
    });
  },

  /**
   * PUT /{company_slug}/expenses/{expense_id}
   * Update Expense Record
   */
  async updateExpense(expenseId: number, payload: ExpenseUpdatePayload): Promise<ExpenseOut> {
    const sanitizedPayload: ExpenseUpdatePayload = {};

    if (payload.category !== undefined) {
      sanitizedPayload.category = payload.category !== null ? mapToExpenseCategoryEnum(payload.category) : null;
    }
    if (payload.sub_category !== undefined) {
      sanitizedPayload.sub_category = payload.sub_category?.trim() || null;
    }
    if (payload.amount !== undefined) {
      sanitizedPayload.amount = payload.amount !== null && payload.amount !== '' ? Number(payload.amount) : null;
    }
    if (payload.description !== undefined) {
      sanitizedPayload.description = payload.description !== null ? payload.description.trim() : null;
    }
    if (payload.expense_date !== undefined) {
      sanitizedPayload.expense_date = payload.expense_date;
    }
    if (payload.vendor_id !== undefined) {
      sanitizedPayload.vendor_id = payload.vendor_id !== null ? Number(payload.vendor_id) : null;
    }
    if (payload.invoice_number !== undefined) {
      sanitizedPayload.invoice_number = payload.invoice_number;
    }
    if (payload.invoice_date !== undefined) {
      sanitizedPayload.invoice_date = payload.invoice_date;
    }
    if (payload.gst_number !== undefined) {
      sanitizedPayload.gst_number = payload.gst_number;
    }
    if (payload.gst_amount !== undefined) {
      sanitizedPayload.gst_amount = payload.gst_amount !== null && payload.gst_amount !== '' ? Number(payload.gst_amount) : null;
    }
    if (payload.cost_center !== undefined) {
      sanitizedPayload.cost_center = payload.cost_center;
    }
    if (payload.project_name !== undefined) {
      sanitizedPayload.project_name = payload.project_name;
    }
    if (payload.client_name !== undefined) {
      sanitizedPayload.client_name = payload.client_name;
    }
    if (payload.payment_mode !== undefined) {
      sanitizedPayload.payment_mode = payload.payment_mode;
    }
    if (payload.payment_date !== undefined) {
      sanitizedPayload.payment_date = payload.payment_date;
    }
    if (payload.transaction_reference !== undefined) {
      sanitizedPayload.transaction_reference = payload.transaction_reference;
    }

    return apiService.request(`/expenses/${Number(expenseId)}`, {
      method: 'PUT',
      body: JSON.stringify(sanitizedPayload),
    });
  },

  /**
   * DELETE /{company_slug}/expenses/{expense_id}
   * Delete Expense Record
   */
  async deleteExpense(expenseId: number): Promise<{ message: string }> {
    return apiService.request(`/expenses/${Number(expenseId)}`, {
      method: 'DELETE',
    });
  },

  /**
   * POST /{company_slug}/expenses/{expense_id}/approve
   * Approve Expense Record
   */
  async approveExpense(expenseId: number, payload?: ExpenseApprovePayload): Promise<ExpenseOut> {
    return apiService.request(`/expenses/${expenseId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  },

  /**
   * POST /{company_slug}/expenses/{expense_id}/reject
   * Reject Expense Record
   */
  async rejectExpense(expenseId: number, payload: ExpenseRejectPayload): Promise<ExpenseOut> {
    return apiService.request(`/expenses/${expenseId}/reject`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * POST /{company_slug}/expenses/{expense_id}/pay
   * Mark Expense as Paid
   */
  async payExpense(expenseId: number, payload: ExpensePaymentPayload): Promise<ExpenseOut> {
    return apiService.request(`/expenses/${expenseId}/pay`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * POST /{company_slug}/expenses/{expense_id}/documents/
   * Upload Expense Document (file: multipart/form-data)
   */
  async uploadExpenseDocument(expenseId: number, file: File): Promise<ExpenseDocumentResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return apiService.request(`/expenses/${expenseId}/documents/`, {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * GET /{company_slug}/expenses/{expense_id}/documents/
   * List Expense Documents
   */
  async getExpenseDocuments(expenseId: number): Promise<ExpenseDocumentResponse[]> {
    return apiService.request(`/expenses/${expenseId}/documents/`, {
      method: 'GET',
    });
  },

  /**
   * DELETE /{company_slug}/expenses/{expense_id}/documents/{document_id}
   * Remove Expense Document
   */
  async deleteExpenseDocument(expenseId: number, documentId: number): Promise<void> {
    return apiService.request(`/expenses/${expenseId}/documents/${documentId}`, {
      method: 'DELETE',
    });
  },
};


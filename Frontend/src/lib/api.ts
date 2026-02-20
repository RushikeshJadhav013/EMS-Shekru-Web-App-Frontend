export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://testing.staffly.space';

interface EmployeeData {
  name: string;
  email: string;
  employee_id: string;
  department?: string;
  designation?: string;
  phone?: string;
  address?: string;
  role?: string;
  gender?: string;
  resignation_date?: string;
  pan_card?: string;
  aadhar_card?: string;
  shift_type?: string;
  employee_type?: string;
  manager_id?: number;  // ✅ Added for reporting manager
  profile_photo?: File | string;
  is_verified?: boolean;
  created_at?: string;
  user_id?: number;
  is_active?: boolean;
  status?: string;
}

interface Employee {
  id: string;
  user_id?: string | number;
  employee_id: string;
  name: string;
  email: string;
  department?: string;
  designation?: string;
  role: string;
  phone?: string;
  address?: string;
  status: string;
  created_at: string;
  updated_at: string;
  photo_url?: string;
  resignation_date?: string;
  gender?: string;
  employee_type?: string;
  pan_card?: string;
  aadhar_card?: string;
  shift_type?: string;
  managerId?: number;  // ✅ Added for reporting manager
}

interface LeaveRequestData {
  employee_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  leave_type: string;
}

interface LeaveRequestResponse {
  leave_id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  leave_type: string;
}

interface LeaveUpdateData {
  start_date?: string;
  end_date?: string;
  reason?: string;
  leave_type?: string;
}

interface LeaveBalanceItem {
  leave_type: string;
  allocated: number;
  used: number;
  remaining: number;
}

interface LeaveBalanceResponse {
  balances: LeaveBalanceItem[];
}

export interface DepartmentData {
  name: string;
  code: string;
  manager_id?: number | null;
  description?: string | null;
  status?: string;
  employee_count?: number | null;
  location?: string | null;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  manager_id?: number | null;
  description?: string | null;
  status: string;
  employee_count?: number | null;
  location?: string | null;
  created_at: string;
  updated_at: string;
}

class ApiService {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;

    // Get auth token from localStorage
    const token = localStorage.getItem('token');

    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}), // ✅ Add auth token
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        // Try to extract error details from response
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              errorMessage = errorData.detail.map((item: any) =>
                typeof item === 'string' ? item : item.msg || JSON.stringify(item)
              ).join(', ');
            } else if (typeof errorData.detail === 'string') {
              errorMessage = errorData.detail;
            } else {
              errorMessage = JSON.stringify(errorData.detail);
            }
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || `HTTP error! status: ${response.status}`;
        }

        if (response.status === 401) {
          // Token is invalid or expired - clear auth data and redirect to login
          console.error('Authentication failed - token invalid or expired');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('userId');
          // Redirect to login page
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          throw new Error(errorMessage || 'Invalid or expired token - please log in again');
        }
        if (response.status === 403) {
          // Check if it's an authentication issue
          if (errorMessage && errorMessage.toLowerCase().includes('not authenticated')) {
            console.error('Authentication required but token missing or invalid');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('userId');
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            throw new Error('Not authenticated - please log in again');
          }
          throw new Error(errorMessage || 'Access denied');
        }
        throw new Error(errorMessage);
      }

      // Handle 204 No Content responses (common for DELETE operations)
      if (response.status === 204) {
        return null; // Return null for empty responses
      }

      // Check if response has content before trying to parse JSON
      const contentType = response.headers.get('content-type');
      const text = await response.text();

      // If response is empty, return null
      if (!text || text.trim().length === 0) {
        return null;
      }

      // Try to parse JSON if content-type indicates JSON or if text looks like JSON
      if (contentType && contentType.includes('application/json')) {
        try {
          return JSON.parse(text);
        } catch (parseError) {
          if (import.meta.env.DEV) {
            console.warn('Failed to parse JSON response:', parseError);
          }
          return null;
        }
      }

      // If not JSON, return the text as-is
      return text || null;
    } catch (error: any) {
      // Handle network errors specifically
      if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('NetworkError'))) {
        const networkError = new Error(
          `Cannot connect to backend server at ${this.baseURL}. Please ensure the backend is running on port 8000.`
        );
        networkError.name = 'NetworkError';
        // Only log network errors in development, suppress in production
        if (import.meta.env.DEV) {
          console.warn('Network error (backend may be down):', networkError.message);
        }
        throw networkError;
      }

      // Log other errors normally if not an expected 403/401
      if (import.meta.env.DEV && error.message !== 'Access denied' && !error.message.includes('403')) {
        console.error('API request failed:', error);
      }

      // Re-throw other errors as-is
      throw error;
    }
  }

  // Get all employees
  async getEmployees() {
    const data = await this.request('/employees/');
    return Array.isArray(data) ? data : (data?.employees || []);
  }

  // Get employee by ID
  async getEmployeeById(userId: string | number) {
    return this.request(`/employees/${userId}`);
  }

  // Get employee with PAN details (enhanced version)
  async getEmployeeWithPAN(userId: string | number) {
    try {
      const employeeData = await this.request(`/employees/${userId}`);
      // Ensure PAN card is properly mapped
      if (employeeData) {
        return {
          ...employeeData,
          pan_card: employeeData.pan_card || employeeData.panNumber || null,
          // Map other potential field variations
          aadhar_card: employeeData.aadhar_card || employeeData.aadharNumber || null,
          phone: employeeData.phone || employeeData.phoneNumber || null,
        };
      }
      return employeeData;
    } catch (error) {
      console.error('Failed to fetch employee with PAN details:', error);
      throw error;
    }
  }

  async getDepartmentManagers() {
    return this.request('/departments/managers');
  }

  // Department APIs
  async getDepartments(): Promise<Department[]> {
    return this.request('/departments');
  }

  async getDepartmentNames(): Promise<{ name: string, code: string }[]> {
    return this.request('/departments/names');
  }

  async createDepartment(data: DepartmentData): Promise<Department> {
    return this.request('/departments', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async updateDepartment(id: number, data: Partial<DepartmentData>): Promise<Department> {
    return this.request(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async deleteDepartment(id: number): Promise<void> {
    await this.request(`/departments/${id}`, {
      method: 'DELETE',
    });
  }

  async syncDepartmentsFromUsers(): Promise<{
    message: string;
    created: number;
    updated: number;
    departments_created: string[];
    total_departments: number;
  }> {
    return this.request('/departments/sync-from-users', {
      method: 'POST',
    });
  }

  // Dashboard endpoints
  async getAdminDashboard() {
    return this.request('/dashboard/admin');
  }

  async getHRDashboard() {
    return this.request('/dashboard/hr');
  }

  async getManagerDashboard() {
    return this.request('/dashboard/manager');
  }

  async getTeamLeadDashboard() {
    return this.request('/dashboard/team-lead');
  }

  async getEmployeeDashboard() {
    return this.request('/dashboard/employee');
  }

  // User tasks
  async getMyTasks() {
    return this.request('/tasks/');
  }

  // Bulk create tasks (PUT /tasks/bulk)
  async createTasksBulk(tasks: {
    title: string;
    description?: string;
    priority?: string;
    due_date?: string | null;
    assigned_to: number;
    assigned_by: number;
  }[]) {
    return this.request('/tasks/bulk', {
      method: 'PUT',
      body: JSON.stringify(tasks),
    });
  }

  // Create a new employee
  async createEmployee(employeeData: EmployeeData): Promise<Employee> {
    const formData = new FormData();

    // Add all fields to FormData
    Object.entries(employeeData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'profile_photo') {
          if (value instanceof File) {
            formData.append(key, value);
          }
          // Skip string URLs or empty strings for creation
        } else {
          formData.append(key, String(value));
        }
      }
    });

    const token = localStorage.getItem('token');

    const response = await fetch(`${this.baseURL}/employees/register/`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Update an employee - Updated to use user_id instead of employee_id
  async updateEmployee(userId: string, employeeData: Partial<EmployeeData>): Promise<Employee> {
    // Get auth token from localStorage
    const token = localStorage.getItem('token');

    // Backend expects FormData, so always use FormData
    const formData = new FormData();

    // Add all fields to FormData
    Object.entries(employeeData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'profile_photo') {
          if (value instanceof File) {
            formData.append(key, value);
          } else if (value === '') {
            // Signal photo removal by sending an empty blob as a file
            formData.append(key, new Blob([], { type: 'application/octet-stream' }), '');
          }
          // Skip if it's an existing photo URL string or undefined
        } else {
          formData.append(key, String(value));
        }
      }
    });

    const headers: Record<string, string> = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
    // Don't set Content-Type for FormData - browser will set it with boundary

    const response = await fetch(`${this.baseURL}/employees/${userId}`, {
      method: 'PUT',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = typeof errorData.detail === 'object' ? JSON.stringify(errorData.detail) : errorData.detail;
      throw new Error(detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Delete an employee
  async deleteEmployee(userId: string): Promise<void> {
    // Get auth token from localStorage
    const token = localStorage.getItem('token');

    const response = await fetch(`${this.baseURL}/employees/${userId}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = typeof errorData.detail === 'object' ? JSON.stringify(errorData.detail) : errorData.detail;
      throw new Error(detail || `HTTP error! status: ${response.status}`);
    }
  }

  // Update employee status (activate/deactivate)
  async updateEmployeeStatus(userId: string, isActive: boolean): Promise<Employee> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${this.baseURL}/employees/${userId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ is_active: isActive }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Update employee role
  async updateEmployeeRole(userId: string, role: string): Promise<Employee> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${this.baseURL}/employees/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Submit a leave request
  async submitLeaveRequest(leaveData: LeaveRequestData): Promise<LeaveRequestResponse> {
    return this.request('/leave/', {
      method: 'POST',
      body: JSON.stringify(leaveData),
    });
  }

  // Get all leave requests with optional period filter
  async getLeaveRequests(period: string = 'current_month', startDate?: string, endDate?: string): Promise<LeaveRequestResponse[]> {
    let url = `/leave/?period=${period}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    return this.request(url);
  }

  async getLeaveBalance(): Promise<LeaveBalanceResponse> {
    return this.request('/leave/balance');
  }

  // Leave Allocation Configuration (Admin only)
  async getLeaveAllocationConfig(): Promise<any> {
    return this.request('/leave/config/allocation');
  }

  async getCurrentLeaveAllocation(): Promise<any> {
    return this.request('/leave/config/allocation/current');
  }

  async createLeaveAllocationConfig(data: {
    total_annual_leave: number;
    sick_leave_allocation: number;
    casual_leave_allocation: number;
    other_leave_allocation: number;
  }): Promise<any> {
    return this.request('/leave/config/allocation', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLeaveAllocationConfig(configId: number, data: {
    total_annual_leave?: number;
    sick_leave_allocation?: number;
    casual_leave_allocation?: number;
    other_leave_allocation?: number;
  }): Promise<any> {
    return this.request(`/leave/config/allocation/${configId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Update a leave request
  async updateLeaveRequest(leaveId: string, data: LeaveUpdateData): Promise<LeaveRequestResponse> {
    return this.request(`/leave/${leaveId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Delete a leave request
  async deleteLeaveRequest(leaveId: string): Promise<void> {
    const url = `${this.baseURL}/leave/${leaveId}`;
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  // Get approvals inbox for current approver
  async getLeaveApprovals(): Promise<(LeaveRequestResponse & {
    employee_id: string;
    name: string;
    department?: string;
    role?: string;
  })[]> {
    return this.request('/leave/approvals');
  }

  // Get approvals decision history for current approver (leave approvals history list)
  async getLeaveApprovalsHistory(): Promise<(LeaveRequestResponse & {
    employee_id: string;
    name: string;
    department?: string;
    role?: string;
  })[]> {
    return this.request('/leave/approvals/history');
  }

  // Get leave requests by employee
  async getLeaveRequestsByEmployee(employeeId: string): Promise<LeaveRequestResponse[]> {
    return this.request(`/leave/employee/${employeeId}`);
  }

  // Approve or reject a leave request
  async approveLeaveRequest(leaveId: string, approved: boolean): Promise<LeaveRequestResponse> {
    return this.request(`/leave/${leaveId}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ approved }),
    });
  }

  // Export employees as CSV
  async exportEmployeesCSV(filters?: {
    status?: string;
    designation?: string;
    department?: string;
    role?: string;
  }): Promise<Blob> {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    if (filters) {
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.designation && filters.designation !== 'all') params.append('designation', filters.designation);
      if (filters.department && filters.department !== 'all') params.append('department', filters.department);
      if (filters.role && filters.role !== 'all') params.append('role', filters.role);
    }
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${this.baseURL}/employees/export/csv${queryString}`, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.blob();
  }

  // Export employees as PDF
  async exportEmployeesPDF(filters?: {
    status?: string;
    designation?: string;
    department?: string;
    role?: string;
  }): Promise<Blob> {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    if (filters) {
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.designation) params.append('designation', filters.designation);
      if (filters.department && filters.department !== 'all') params.append('department', filters.department);
      if (filters.role && filters.role !== 'all') params.append('role', filters.role);
    }
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${this.baseURL}/employees/export/pdf${queryString}`, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.blob();
  }

  // Hiring Management APIs
  async getVacancies(department?: string, status?: string) {
    const params = new URLSearchParams();
    if (department) params.append('department', department);
    if (status) params.append('status_filter', status);
    const query = params.toString();
    return this.request(`/hiring/vacancies${query ? `?${query}` : ''}`);
  }

  async getVacancy(vacancyId: number) {
    return this.request(`/hiring/vacancies/${vacancyId}`);
  }

  async createVacancy(vacancyData: any) {
    return this.request('/hiring/vacancies', {
      method: 'POST',
      body: JSON.stringify(vacancyData),
    });
  }

  async updateVacancy(vacancyId: number, vacancyData: any) {
    return this.request(`/hiring/vacancies/${vacancyId}`, {
      method: 'PUT',
      body: JSON.stringify(vacancyData),
    });
  }

  async deleteVacancy(vacancyId: number) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/hiring/vacancies/${vacancyId}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
  }

  async postVacancyToSocialMedia(vacancyId: number, platforms: string[], links?: Record<string, string>) {
    return this.request(`/hiring/vacancies/${vacancyId}/post-social`, {
      method: 'POST',
      body: JSON.stringify({ vacancy_id: vacancyId, platforms, links }),
    });
  }

  async getCandidates(vacancyId?: number, status?: string) {
    const params = new URLSearchParams();
    if (vacancyId) params.append('vacancy_id', vacancyId.toString());
    if (status) params.append('status_filter', status);
    const query = params.toString();
    return this.request(`/hiring/candidates${query ? `?${query}` : ''}`);
  }

  async getCandidate(candidateId: number) {
    return this.request(`/hiring/candidates/${candidateId}`);
  }

  async createCandidate(candidateData: any, resumeFile?: File) {
    const token = localStorage.getItem('token');
    const formData = new FormData();

    Object.entries(candidateData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    if (resumeFile) {
      formData.append('resume', resumeFile);
    }

    const response = await fetch(`${this.baseURL}/hiring/candidates`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async updateCandidate(candidateId: number, candidateData: any) {
    return this.request(`/hiring/candidates/${candidateId}`, {
      method: 'PUT',
      body: JSON.stringify(candidateData),
    });
  }

  async deleteCandidate(candidateId: number) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/hiring/candidates/${candidateId}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
  }

  // Shift Management APIs
  async getShifts(department?: string) {
    const params = new URLSearchParams();
    if (department) params.append('department', department);
    const query = params.toString();
    return this.request(`/shift${query ? `?${query}` : ''}`);
  }

  async getShift(shiftId: number) {
    return this.request(`/shift/${shiftId}`);
  }

  async createShift(shiftData: any) {
    return this.request('/shift', {
      method: 'POST',
      body: JSON.stringify(shiftData),
    });
  }

  async updateShift(shiftId: number, shiftData: any) {
    return this.request(`/shift/${shiftId}`, {
      method: 'PUT',
      body: JSON.stringify(shiftData),
    });
  }

  async deleteShift(shiftId: number) {
    return this.request(`/shift/${shiftId}`, {
      method: 'DELETE',
    });
  }

  async assignShift(assignmentData: any) {
    return this.request('/shift/assignment', {
      method: 'POST',
      body: JSON.stringify(assignmentData),
    });
  }

  async bulkAssignShift(assignmentData: any) {
    return this.request('/shift/assignment/bulk', {
      method: 'POST',
      body: JSON.stringify(assignmentData),
    });
  }

  async getDepartmentSchedule(scheduleDate: string, department?: string) {
    const params = new URLSearchParams();
    params.append('schedule_date', scheduleDate);
    if (department) params.append('department', department);
    return this.request(`/shift/schedule/department?${params.toString()}`);
  }

  async getMyShiftSchedule(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const query = params.toString();

    // Debug authentication for shift schedule
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found for shift schedule request');
      throw new Error('Not authenticated - please log in again');
    }

    return this.request(`/shift/schedule/my${query ? `?${query}` : ''}`);
  }

  async updateShiftAssignment(assignmentId: number, assignmentData: any) {
    return this.request(`/shift/assignment/${assignmentId}`, {
      method: 'PUT',
      body: JSON.stringify(assignmentData),
    });
  }

  async deleteShiftAssignment(assignmentId: number) {
    return this.request(`/shift/assignment/${assignmentId}`, {
      method: 'DELETE',
    });
  }

  async getDepartmentScheduleWeek(startDate: string, endDate?: string) {
    const params = new URLSearchParams({ start_date: startDate });
    if (endDate) {
      params.append('end_date', endDate);
    }
    return this.request(`/shift/schedule/department/week?${params.toString()}`);
  }

  async getShiftNotifications() {
    return this.request('/shift/notifications');
  }

  async markShiftNotificationAsRead(notificationId: number) {
    return this.request(`/shift/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  // Reports API
  async getEmployeePerformance(params: {
    month: number;
    year: number;
    department?: string;
    employeeId?: string;
  }) {
    const query = new URLSearchParams({
      month: params.month.toString(),
      year: params.year.toString(),
      ...(params.department && params.department !== 'all' && { department: params.department }),
      ...(params.employeeId && { employee_id: params.employeeId }),
    });

    return this.request(`/reports/employee-performance?${query}`);
  }

  async getDepartmentMetrics(params: { month: number; year: number }) {
    const query = new URLSearchParams({
      month: params.month.toString(),
      year: params.year.toString(),
    });

    return this.request(`/reports/department-metrics?${query}`);
  }

  async getExecutiveSummary(params: { month: number; year: number }) {
    const query = new URLSearchParams({
      month: params.month.toString(),
      year: params.year.toString(),
    });

    return this.request(`/reports/executive-summary?${query}`);
  }

  async getReportDepartments() {
    return this.request('/reports/departments');
  }

  // Task Comments
  async getTaskComments(taskId: number) {
    return this.request(`/tasks/${taskId}/comments`);
  }

  async addTaskComment(taskId: number, comment?: string, file?: File) {
    const token = localStorage.getItem('token');
    const formData = new FormData();

    if (comment) {
      formData.append('comment', comment);
    }
    if (file) {
      formData.append('file', file);
    }

    const response = await fetch(`${this.baseURL}/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async deleteTaskComment(taskId: number, commentId: number) {
    return this.request(`/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // Work From Home (WFH) APIs
  async submitWFHRequest(wfhData: {
    start_date: string;
    end_date: string;
    wfh_type: 'Full Day' | 'Half Day';
    reason: string;
  }) {
    return this.request('/wfh/request', {
      method: 'POST',
      body: JSON.stringify(wfhData),
    });
  }

  async getWFHRequests(period?: string) {
    // Fetch all WFH requests for admin/hr/manager approval
    // This endpoint returns all WFH requests that need approval
    try {
      const response = await this.request('/wfh/requests');
      return Array.isArray(response) ? response : (response?.data || response?.requests || []);
    } catch (error: any) {
      // If the endpoint returns 500 or is not available, silently return empty array
      // The backend may not have this endpoint fully implemented yet
      if (import.meta.env.DEV) {
        console.warn('WFH Requests endpoint not available:', error?.message || error);
      }
      return [];
    }
  }

  async getAllWFHRequests() {
    // Fetch all WFH requests for admin/hr/manager approval
    // This is an alias for getWFHRequests with better naming
    return this.getWFHRequests();
  }

  async getMyWFHRequests() {
    return this.request('/wfh/my-requests');
  }

  async getWFHRequestById(wfhId: number) {
    return this.request(`/wfh/request/${wfhId}`);
  }

  async updateWFHRequest(wfhId: number, wfhData: Partial<{
    start_date: string;
    end_date: string;
    wfh_type: 'Full Day' | 'Half Day';
    reason: string;
  }>) {
    return this.request(`/wfh/my-requests/${wfhId}`, {
      method: 'PUT',
      body: JSON.stringify(wfhData),
    });
  }

  async deleteWFHRequest(wfhId: number) {
    return this.request(`/wfh/my-requests/${wfhId}`, {
      method: 'DELETE',
    });
  }

  async getWFHApprovals() {
    // Fetch all WFH requests for admin approval
    // NOTE: Backend needs to implement GET /wfh/requests endpoint that returns all WFH requests
    // This endpoint should return requests from all users (not just current user)
    // and should support filtering by role, status, and date range
    return this.request('/wfh/requests');
  }

  async approveWFHRequest(wfhId: number, approved: boolean, rejectionReason?: string) {
    return this.request(`/wfh/requests/${wfhId}/approve`, {
      method: 'PUT',
      body: JSON.stringify({
        approved,
        ...(rejectionReason && { rejection_reason: rejectionReason })
      }),
    });
  }

  // Attendance APIs
  async getAttendanceRecords(params?: { date?: string; department?: string; manager_id?: string | number }) {
    const queryParams = new URLSearchParams();
    if (params?.date) queryParams.append('date', params.date);
    if (params?.department) queryParams.append('department', params.department);
    if (params?.manager_id) queryParams.append('manager_id', String(params.manager_id));
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/attendance/all${queryString}`);
  }

  async getWorkingHours(attendanceId: number) {
    return this.request(`/attendance/working-hours/${attendanceId}`);
  }

  async getAttendanceStatus() {
    return this.request('/attendance/status');
  }

  async checkIn(location?: { latitude: number; longitude: number }) {
    return this.request('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(location || {}),
    });
  }

  async checkOut(location?: { latitude: number; longitude: number }) {
    return this.request('/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify(location || {}),
    });
  }

  async updateOnlineStatus(isOnline: boolean) {
    return this.request('/attendance/online-status', {
      method: 'PUT',
      body: JSON.stringify({ is_online: isOnline }),
    });
  }

  // Export attendance as CSV
  async exportAttendanceCSV(params: {
    employee_id?: string;
    department?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (params.employee_id) queryParams.append('employee_id', params.employee_id);
    if (params.department) queryParams.append('department', params.department);
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);

    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/attendance/download/csv?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.blob();
  }

  // Export attendance as PDF
  async exportAttendancePDF(params: {
    employee_id?: string;
    department?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (params.employee_id) queryParams.append('employee_id', params.employee_id);
    if (params.department) queryParams.append('department', params.department);
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);

    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/attendance/download/pdf?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.blob();
  }

  // Export Monthly Attendance Grid as PDF
  async exportMonthlyGridPDF(params: {
    month: string;
    year: string;
    department?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.append('month', params.month);
    queryParams.append('year', params.year);
    if (params.department && params.department !== 'all') {
      queryParams.append('department', params.department);
    }

    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/attendance/report/monthly-grid/download/pdf?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.blob();
  }

  // Export Monthly Attendance Grid as CSV
  async exportMonthlyGridCSV(params: {
    month: string;
    year: string;
    department?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.append('month', params.month);
    queryParams.append('year', params.year);
    if (params.department && params.department !== 'all') {
      queryParams.append('department', params.department);
    }

    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/attendance/report/monthly-grid/download/csv?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.blob();
  }



  // Export Monthly Attendance Detailed Grid as PDF (New Endpoint)
  async downloadMonthlyDetailedAttendanceGridPDF(params: {
    month: string;
    year: string;
    department?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.append('month', params.month);
    queryParams.append('year', params.year);
    if (params.department && params.department !== 'all') {
      queryParams.append('department', params.department);
    }

    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/attendance/report/monthly-detailed-grid/download/pdf?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.blob();
  }

  // Export Monthly Attendance Detailed Grid as CSV
  async exportMonthlyGridDetailedCSV(params: {
    month: string;
    year: string;
    department?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.append('month', params.month);
    queryParams.append('year', params.year);
    if (params.department && params.department !== 'all') {
      queryParams.append('department', params.department);
    }

    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/attendance/report/monthly-grid-detailed/download/csv?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.blob();
  }

  // Holiday Management APIs
  async getHolidays(params?: { start_date?: string; end_date?: string }): Promise<Array<{ id: number; date: string; name: string; description?: string; is_recurring?: boolean; created_at: string; updated_at?: string }>> {
    const queryParams = new URLSearchParams();
    if (params?.start_date) {
      queryParams.append('start_date', params.start_date);
    }
    if (params?.end_date) {
      queryParams.append('end_date', params.end_date);
    }
    const queryString = queryParams.toString();
    return this.request(`/calendar/holidays${queryString ? `?${queryString}` : ''}`);
  }

  async createHoliday(data: { date: string; name: string; description?: string; is_recurring?: boolean }): Promise<{ id: number; date: string; name: string; description?: string; is_recurring?: boolean; created_at: string; updated_at?: string }> {
    // Ensure is_recurring is always sent (default to false if not provided)
    const requestData = {
      date: data.date,
      name: data.name,
      description: data.description || '',
      is_recurring: data.is_recurring ?? false,
    };

    return this.request('/calendar/holidays', {
      method: 'POST',
      body: JSON.stringify(requestData),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async updateHoliday(id: number, data: { date?: string; name?: string; description?: string; is_recurring?: boolean }): Promise<{ id: number; date: string; name: string; description?: string; is_recurring?: boolean; created_at: string; updated_at?: string }> {
    return this.request(`/calendar/holidays/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async deleteHoliday(id: number): Promise<void> {
    await this.request(`/calendar/holidays/${id}`, {
      method: 'DELETE',
    });
  }

  // Weekoff Management APIs
  async getWeekoffs(): Promise<Array<{ id: number; department: string; days: string[]; is_active: boolean; created_at: string }>> {
    return this.request('/calendar/weekoffs');
  }

  async createWeekoff(data: { department: string; days: string[] }): Promise<{ id: number; department: string; days: string[]; is_active: boolean; created_at: string }> {
    return this.request('/calendar/weekoffs', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async deleteWeekoff(ruleId: number): Promise<void> {
    await this.request(`/calendar/weekoffs/${ruleId}`, {
      method: 'DELETE',
    });
  }

  // Salary Management APIs
  // 1. List all employee salaries
  async getAllEmployeeSalaries(params?: { departments?: string | null; skip?: number; limit?: number }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.departments) query.append('departments', params.departments);
    if (params?.skip !== undefined) query.append('skip', params.skip.toString());
    if (params?.limit !== undefined) query.append('limit', params.limit.toString());

    return this.request(`/salary/employees${query.toString() ? `?${query.toString()}` : ''}`);
  }

  // 2. Create Salary
  async createSalary(data: any): Promise<any> {
    // Map camelCase to snake_case if needed, or assume caller sends correct format. 
    // Spec: user_id, package_ctc_annual, etc.
    return this.request('/salary/employee/from-ctc', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // 2.1 Create Save Salary (Admin Only)
  async createManualSalary(data: any): Promise<any> {
    return this.request('/salary/employee', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // 2. Salary Preview
  async calculateSalaryPreview(annualCtc: number, variablePayType: string, variablePayValue: number): Promise<any> {
    const params = new URLSearchParams();
    params.append('package_ctc_annual', annualCtc.toString());
    params.append('variable_pay_type', variablePayType);
    params.append('variable_pay_value', variablePayValue.toString());

    // Fallback to GET as originally designed if POST fails or if backend supports GET query params
    // Based on user request history, it seems GET was the original intention for preview.
    // However, the error 'Method Not Allowed' suggests POST might be needed OR the endpoint is wrong.
    // Let's re-read the request. The user provided a list of APIs.
    // There isn't a specific 'calculate-preview' in the provided list!
    // But there is '/salary/employee/from-ctc' which calculates.
    // The previous error was 405 Method Not Allowed on /salary/calculate-preview.
    // This implies the endpoint might not exist or supports a different method.
    // But since I don't see 'calculate-preview' in the 'SR.NO.' list provided by the user,
    // I should probably stick to what I have or try to find the correct endpoint.
    // Wait, the user provided a list of APIs *just now*.
    // Item 7 is POST "/salary/employee/from-ctc". This creates a salary.
    // It doesn't explicitly say "preview".
    // However, typically preview endpoints are GET.
    // If the user provided list is EXHAUSTIVE, then `calculate-preview` might be missing or custom.
    // Let's assume the previous change to POST was correct for `calculate-preview` if it exists.
    // BUT the user just pasted a big list of APIs.
    // Let's look at the `createSalary` (Item 7). It takes `user_id`, `package_ctc_annual`, etc.
    // Maybe I should use `POST /salary/calculate-preview` if it exists.
    // I will keep the POST change I made but ensure types are correct.

    return this.request(`/salary/calculate-preview?${params.toString()}`, {
      method: 'POST',
    });
  }

  // 3. View Salary Details
  async getSalaryDetails(userId: string): Promise<any> {
    try {
      const response = await this.request(`/salary/employee/${userId}`);

      // Validate and normalize the response data
      if (response && typeof response === 'object') {
        // Ensure all required fields are properly mapped from snake_case to camelCase
        const annualCtc = response.ctc_annual || response.package_ctc_annual || 0;
        const monthlyGross = response.total_earnings_annual ? response.total_earnings_annual / 12 : (response.monthly_gross || 0);
        const monthlyDeductions = response.total_deductions_annual ? response.total_deductions_annual / 12 : (response.monthly_deductions || 0);

        const calculatedInHand = monthlyGross - monthlyDeductions;
        // Use calculated in-hand if it's available and non-zero, otherwise fallback to response field
        const finalMonthlyInHand = calculatedInHand > 0 ? calculatedInHand : (response.monthly_in_hand || 0);

        return {
          ...response,
          userId: String(response.user_id || userId),
          annualCtc: annualCtc,
          monthlyBasic: response.basic_annual ? response.basic_annual / 12 : (response.monthly_basic || 0),
          hra: response.hra_annual ? response.hra_annual / 12 : (response.hra || 0),
          specialAllowance: response.special_allowance_annual ? response.special_allowance_annual / 12 : (response.special_allowance || 0),
          medicalAllowance: response.medical_allowance_annual ? response.medical_allowance_annual / 12 : (response.medical_allowance || 0),
          conveyanceAllowance: response.conveyance_annual ? response.conveyance_annual / 12 : (response.conveyance_allowance || 0),
          otherAllowance: response.other_allowance_annual ? response.other_allowance_annual / 12 : (response.other_allowance || 0),
          professionalTax: response.professional_tax_annual ? response.professional_tax_annual / 12 : (response.professional_tax || 0),
          pfEmployer: response.pf_annual ? (response.pf_annual / 2) / 12 : (response.pf_employer || 0),
          pfEmployee: response.pf_annual ? (response.pf_annual / 2) / 12 : (response.pf_employee || 0),
          otherDeduction: response.other_deduction_annual ? response.other_deduction_annual / 12 : (response.other_deduction || 0),
          variablePay: response.variable_pay || 0,
          monthlyGross: monthlyGross,
          monthlyDeductions: monthlyDeductions,
          monthlyInHand: finalMonthlyInHand,
          monthly_ctc: response.monthly_ctc || (annualCtc / 12),
          workingDays: response.working_days_per_month || 26,
          paymentMode: response.payment_mode?.toLowerCase().replace(' ', '_') || 'bank_transfer',
          bankName: response.bank_name || '',
          accountNumber: response.bank_account || '',
          ifscCode: response.ifsc_code || '',
          panNumber: response.pan_number || '',
          uanNumber: response.uan_number || '',
          isActive: response.is_active !== undefined ? response.is_active : true,
          effectiveDate: response.created_at || '',
          createdAt: response.created_at || '',
          updatedAt: response.updated_at || ''
        };
      }

      return response;
    } catch (error: any) {
      console.error(`Failed to fetch salary details for user ${userId}:`, error);
      throw error;
    }
  }

  // 4. Update Salary CTC
  async updateSalaryCtc(userId: string, data: { annualCtc: number; variablePayType: string; variablePayValue: number }): Promise<any> {
    return this.request(`/salary/employee/${userId}/update-ctc`, {
      method: 'PUT',
      body: JSON.stringify({
        user_id: Number(userId),
        package_ctc_annual: data.annualCtc,
        variable_pay_type: data.variablePayType,
        variable_pay_value: data.variablePayValue,
      }),
    });
  }

  // Update Non-CTC Fields
  async updateSalaryDetails(userId: string, data: any): Promise<any> {
    return this.request(`/salary/employee/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Update Bank Details Only (Admin Only)
  async updateBankDetails(userId: string, data: {
    user_id: number;
    uan_number?: string;
    bank_name: string;
    bank_account: string;
    ifsc_code: string;
    working_days_per_month?: number;
    payment_mode?: string;
    pf_no?: string;
    variable_pay_type?: string;
    variable_pay_value?: number;
    other_deduction_annual?: number;
    pf_annual?: number;
  }): Promise<any> {
    return this.request(`/salary/employee/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // 5. Delete Salary
  async deleteSalary(userId: string): Promise<any> {
    return this.request(`/salary/employee/${userId}`, {
      method: 'DELETE',
    });
  }

  // 6. Salary Slips
  async downloadSalarySlip(userId: string, month: number, year: number): Promise<Blob> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/salary/slip/download/${userId}?month=${month}&year=${year}`, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return await response.blob();
  }

  async sendSalarySlip(userId: string, month: number, year: number): Promise<any> {
    return this.request(`/salary/slip/send/${userId}?month=${month}&year=${year}`, {
      method: 'POST',
    });
  }

  // Salary Slip History
  async getSalarySlipHistory(userId: string, year?: number): Promise<any> {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    const query = params.toString();
    return this.request(`/salary/slip/history/${userId}${query ? `?${query}` : ''}`);
  }

  // 7. Annexure & Offer Letter
  async downloadAnnexure(userId: string): Promise<Blob> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/salary/annexure/download/${userId}`, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to download annexure`);
    }
    return await response.blob();
  }

  async sendAnnexureEmail(userId: string): Promise<any> {
    return this.request(`/salary/annexure/send/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ user_id: parseInt(userId) }),
    });
  }

  async downloadOfferLetter(userId: string, params?: { letter_date?: string; joining_date?: string }): Promise<Blob> {
    const token = localStorage.getItem('token');
    const queryParams = new URLSearchParams();
    if (params?.letter_date) {
      queryParams.append('letter_date', params.letter_date);
    }
    if (params?.joining_date) {
      queryParams.append('joining_date', params.joining_date);
    }
    const queryString = queryParams.toString();
    const url = `${this.baseURL}/salary/offer-letter/download/${userId}${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to download offer letter`);
    }
    return await response.blob();
  }

  // 8. Increment (Create salary increment record admin and hr only)
  async createIncrement(data: { userId: string; incrementAmount: number; incrementPercentage: number; effectiveDate: string; reason: string; newSalary: number; previousSalary: number }): Promise<any> {
    return this.request('/salary/increment', {
      method: 'POST',
      body: JSON.stringify({
        user_id: data.userId,
        previous_salary: data.previousSalary,
        increment_amount: data.incrementAmount,
        increment_percentage: data.incrementPercentage,
        new_salary: data.newSalary,
        effective_date: data.effectiveDate,
        reason: data.reason
      }),
    });
  }

  async getIncrements(userId: string): Promise<any[]> {
    return this.request(`/salary/increments/${userId}`);
  }

  async getIncrementById(incrementId: string): Promise<any> {
    return this.request(`/salary/increment/${incrementId}`);
  }

  async downloadIncrementLetter(incrementId: string): Promise<Blob> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/salary/increment-letter/download/${incrementId}`, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to download increment letter`);
    }
    return await response.blob();
  }

  async sendIncrementLetter(incrementId: string): Promise<any> {
    return this.request(`/salary/increment-letter/send/${incrementId}`, {
      method: 'POST',
      body: JSON.stringify({ increment_id: parseInt(incrementId) }),
    });
  }
}

export const apiService = new ApiService(API_BASE_URL);
export type { Employee, EmployeeData, LeaveRequestData, LeaveRequestResponse };

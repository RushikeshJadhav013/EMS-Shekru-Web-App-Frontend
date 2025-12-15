const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
}

interface Employee {
  id: string;
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
      
      // Log other errors normally
      if (import.meta.env.DEV) {
        console.error('API request failed:', error);
      }
      
      // Re-throw other errors as-is
      throw error;
    }
  }

  // Get all employees
  async getEmployees() {
    return this.request('/employees');
  }

  async getDepartmentManagers() {
    return this.request('/departments/managers');
  }

  // Department APIs
  async getDepartments(): Promise<Department[]> {
    return this.request('/departments');
  }

  async getDepartmentNames(): Promise<{name: string, code: string}[]> {
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
    return this.request('/tasks');
  }

  // Create a new employee
  async createEmployee(employeeData: EmployeeData): Promise<Employee> {
    const formData = new FormData();

    // Add all fields to FormData
    Object.entries(employeeData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'profile_photo' && value instanceof File) {
          formData.append(key, value);
        } else {
          formData.append(key, String(value));
        }
      }
    });

    const response = await fetch(`${this.baseURL}/employees/register`, {
      method: 'POST',
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
        if (key === 'profile_photo' && value instanceof File) {
          formData.append(key, value);
        } else if (key !== 'profile_photo') {
          // Skip profile_photo if it's not a File (e.g., existing URL)
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
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
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
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
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

  // Submit a leave request
  async submitLeaveRequest(leaveData: LeaveRequestData): Promise<LeaveRequestResponse> {
    return this.request('/leave/', {
      method: 'POST',
      body: JSON.stringify(leaveData),
    });
  }

  // Get all leave requests with optional period filter
  async getLeaveRequests(period: string = 'current_month'): Promise<LeaveRequestResponse[]> {
    return this.request(`/leave/?period=${period}`);
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

  // Get approvals decision history for current approver
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
  async exportEmployeesCSV(): Promise<Blob> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/employees/export/csv`, {
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
  async exportEmployeesPDF(): Promise<Blob> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/employees/export/pdf`, {
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
}

export const apiService = new ApiService(API_BASE_URL);
export type { Employee, EmployeeData, LeaveRequestData, LeaveRequestResponse };

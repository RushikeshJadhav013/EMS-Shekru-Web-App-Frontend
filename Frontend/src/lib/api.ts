export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://api-testing.staffly.space";

interface EmployeeData {
  name: string;
  email: string;
  employee_id: string;
  branch?: string;
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
  manager_id?: number; // ✅ Added for reporting manager
  profile_photo?: File | string;
  is_verified?: boolean;
  created_at?: string;
  user_id?: number;
  is_active?: boolean;
  status?: string;
  company?: string;
  branches?: string;
  company_id?: number;
  branch_id?: number;
  department?: string;
  joining_date?: string;
}

interface Employee {
  id: string;
  user_id?: string | number;
  employee_id: string;
  name: string;
  email: string;
  branch?: string;
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
  managerId?: number; // ✅ Added for reporting manager
  company?: string;
  branches?: string;
  company_id?: number;
  branch_id?: number;
  department?: string;
}

interface LeaveRequestData {
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  leave_type: string;
  company_slug?: string;
  "X-Branch-Id"?: string;
  "X-Company-Id"?: string;
  duration_days?: number;
  leave_session?: string | null;
}

interface LeaveRequestResponse {
  leave_id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  leave_type: string;
  duration_days?: number;
  leave_session?: string | null;
  company_id?: number;
}

interface LeaveUpdateData {
  start_date?: string;
  end_date?: string;
  reason?: string;
  leave_type?: string;
  duration_days?: number;
  leave_session?: string | null;
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

export interface LeaveAllocationConfig {
  id?: number;
  total_annual_leave: number;
  sick_leave_allocation: number;
  casual_leave_allocation: number;
  other_leave_allocation: number;
  is_configured?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string | null;
  updated_by?: number;
}

export interface LeaveAllocationConfig {
  id?: number;
  total_annual_leave: number;
  sick_leave_allocation: number;
  casual_leave_allocation: number;
  other_leave_allocation: number;
  is_configured?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string | null;
  updated_by?: number;
}

export interface BranchData {
  name: string;
  code: string;
  manager_id?: number | null;
  description?: string | null;
  status?: string;
  employee_count?: number | null;
  location?: string | null;
}

export interface Branch {
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

export interface WorkingHoursDaySummary {
  date: string;
  working_hours: number;
  working_seconds: number;
  offline_hours: number;
  offline_seconds: number;
}

export interface WorkingHoursAttendanceSummary {
  attendance_id: number;
  date: string;
  check_in: string;
  check_out: string | null;
  working_hours: number;
  working_seconds: number;
  offline_hours: number;
  offline_seconds: number;
  is_currently_online: boolean;
}

export interface WorkingHoursSummaryResponse {
  user_id: number;
  period: string;
  range_start: string;
  range_end: string;
  total_working_hours: number;
  total_working_seconds: number;
  total_offline_hours: number;
  total_offline_seconds: number;
  days: WorkingHoursDaySummary[];
  attendances: WorkingHoursAttendanceSummary[];
}

class ApiService {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private getAuthHeader() {
    let token = localStorage.getItem("token");
    if (token && !token.startsWith("Bearer ")) {
      token = `Bearer ${token}`;
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = token;
    }

    // Ensure branchId/companyId are synced from user object or token if available
    let branchId = localStorage.getItem("branchId");
    let companyId = localStorage.getItem("companyId");

    try {
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("token");

      let uBranchId = "";
      let uCompanyId = "";

      if (storedUser) {
        const user = JSON.parse(storedUser);
        uBranchId = String(user.branch_id || user.branchId || "");
        uCompanyId = String(user.company_id || user.companyId || "");
      }

      // If still missing, try decoding token
      if ((!uBranchId || !uCompanyId) && token) {
        try {
          const payloadPart = token.split('.')[1];
          if (payloadPart) {
            const decoded = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
            if (!uBranchId) uBranchId = String(decoded.branch_id || decoded.branchId || "");
            if (!uCompanyId) uCompanyId = String(decoded.company_id || decoded.companyId || "");
          }
        } catch (e) {
          // Ignore decode errors
        }
      }

      if (!branchId && uBranchId) {
        branchId = uBranchId;
        localStorage.setItem("branchId", uBranchId);
      }
      if (!companyId && uCompanyId) {
        companyId = uCompanyId;
        localStorage.setItem("companyId", uCompanyId);
      }
    } catch (e) {
      // Ignore
    }

    if (branchId && branchId !== "null" && branchId !== "undefined") {
      headers["X-Branch-Id"] = branchId;
    }
    if (companyId && companyId !== "null" && companyId !== "undefined") {
      headers["X-Company-Id"] = companyId;
    }

    if (headers["X-Branch-Id"] || headers["X-Company-Id"]) {
      console.debug("Scope Headers Sent:", { branchId: headers["X-Branch-Id"], companyId: headers["X-Company-Id"] });
    }

    return headers;
  }

  public async request(endpoint: string, options: RequestInit = {}) {
    let url = `${this.baseURL}${endpoint}`;

    // If company_slug is available and the endpoint doesn't already start with it,
    // inject it into the path (except for auth endpoints)
    const companySlug = localStorage.getItem("company_slug");
    if (companySlug &&
      !endpoint.startsWith("/auth/") &&
      !endpoint.startsWith(`/${companySlug}/`) &&
      endpoint !== "/auth/me" &&
      endpoint !== "/auth/me/companies" &&
      !endpoint.startsWith("/auth/me/switch-company/")) {
      url = `${this.baseURL}/${companySlug}${endpoint}`;
      console.debug(`Tenant URL path adjusted: ${url}`);
    }

    const headers: Record<string, string> = {
      ...this.getAuthHeader(),
      ...(options.headers as Record<string, string>),
    };

    // Only set Content-Type to application/json if it's not already set
    // and the body is NOT FormData
    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const config: RequestInit = {
      ...options,
      headers,
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
              errorMessage = errorData.detail
                .map((item: any) =>
                  typeof item === "string"
                    ? item
                    : item.msg || JSON.stringify(item),
                )
                .join(", ");
            } else if (typeof errorData.detail === "string") {
              errorMessage = errorData.detail;
            } else {
              errorMessage = JSON.stringify(errorData.detail);
            }
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          // If JSON parsing fails, use status text
          errorMessage =
            response.statusText || `HTTP error! status: ${response.status}`;
        }

        const error = new Error(errorMessage || `HTTP error! status: ${response.status}`);
        (error as any).status = response.status;

        // Handle common scope conflict error
        if (response.status === 409 || errorMessage.includes("Scope conflict") || errorMessage.includes("Multiple company")) {
          window.dispatchEvent(new CustomEvent('scope-conflict'));
        }

        throw error;
      }

      // Handle 204 No Content responses (common for DELETE operations)
      if (response.status === 204) {
        return null; // Return null for empty responses
      }

      // Check if response has content before trying to parse JSON
      const contentType = response.headers.get("content-type");
      const text = await response.text();

      // If response is empty, return null
      if (!text || text.trim().length === 0) {
        return null;
      }

      // Try to parse JSON if content-type indicates JSON or if text looks like JSON
      if (contentType && contentType.includes("application/json")) {
        try {
          return JSON.parse(text);
        } catch (parseError) {
          if (import.meta.env.DEV) {
            console.warn("Failed to parse JSON response:", parseError);
          }
          return null;
        }
      }

      // If not JSON, return the text as-is
      return text || null;
    } catch (error: any) {
      // Handle network errors specifically
      if (
        error instanceof TypeError &&
        (error.message.includes("fetch") ||
          error.message.includes("NetworkError"))
      ) {
        const networkError = new Error(
          `Cannot connect to backend server at ${this.baseURL}. Please ensure the backend is running on port 8000.`,
        );
        networkError.name = "NetworkError";
        // Only log network errors in development, suppress in production
        if (import.meta.env.DEV) {
          console.warn(
            "Network error (backend may be down):",
            networkError.message,
          );
        }
        throw networkError;
      }

      // Log other errors normally — suppress expected 401/403/409 to keep console clean
      if (
        import.meta.env.DEV &&
        error.message !== "Access denied" &&
        !error.message.includes("403") &&
        !error.message.includes("409") &&
        !error.message.includes("Scope conflict") &&
        !error.message.includes("Multiple company")
      ) {
        console.error("API request failed:", error);
      }

      // Re-throw other errors as-is
      throw error;
    }
  }

  private async download(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<Blob> {
    let url = `${this.baseURL}${endpoint}`;

    // If company_slug is available, inject it into the path
    const companySlug = localStorage.getItem("company_slug");
    if (companySlug && !endpoint.startsWith(`/${companySlug}/`)) {
      url = `${this.baseURL}/${companySlug}${endpoint}`;
      console.debug(`Tenant download path adjusted: ${url}`);
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getAuthHeader(),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return await response.blob();
    } catch (error: any) {
      if (
        error instanceof TypeError &&
        (error.message.includes("fetch") ||
          error.message.includes("NetworkError"))
      ) {
        throw new Error(`Cannot connect to backend server at ${this.baseURL}.`);
      }
      throw error;
    }
  }

  async getEmployees(params?: string | {
    branch?: string;
    search?: string;
    department?: string;
    role?: string;
    is_active?: boolean | string;
    branch_id?: number;
    company_id?: number;
  }) {
    const queryParams = new URLSearchParams();

    // Legacy support: if a string is passed, it acts as a department filter
    if (typeof params === 'string') {
      if (params && params !== "all") queryParams.append("department", params);
    } else if (params) {
      // New object-based parameters
      if (params.branch && params.branch !== "all") queryParams.append("department", params.branch);
      if (params.department && params.department !== "all") queryParams.append("department", params.department);
      if (params.search) queryParams.append("search", params.search);
      if (params.role) queryParams.append("role", params.role);
      if (params.is_active !== undefined) queryParams.append("is_active", String(params.is_active));
    }

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";

    try {
      // Prepare extra headers if explicit IDs are provided
      const extraHeaders: Record<string, string> = {};
      if (typeof params === 'object') {
        if (params.branch_id) extraHeaders['X-Branch-Id'] = String(params.branch_id);
        if (params.company_id) extraHeaders['X-Company-Id'] = String(params.company_id);
      }

      const data = await this.request(queryString ? `/employees/${queryString}` : `/employees/`, {
        headers: extraHeaders
      });
      return Array.isArray(data) ? data : data?.employees || [];
    } catch (error: any) {
      const isScopeConflict =
        error.status === 409 ||
        error.status === 403 ||
        error.message?.includes("409") ||
        error.message?.includes("403") ||
        error.message?.includes("Scope conflict") ||
        error.message?.includes("Multiple company");

      if (isScopeConflict) {
        console.warn("Scope conflict/forbidden detected. Attempting to sync branch/company assignment from user profile...");
        try {
          const storedUser = localStorage.getItem("user");
          if (storedUser) {
            const user = JSON.parse(storedUser);
            // If the user already has a branch_id in their profile, use it as fallback
            const fallbackBranchId = user.branch_id || user.branchId;
            const fallbackCompanyId = user.company_id || user.companyId;

            if (fallbackBranchId) {
              console.log(`Setting automatic scope fallback -> Branch: ${fallbackBranchId}, Company: ${fallbackCompanyId}`);
              localStorage.setItem("branchId", String(fallbackBranchId));
              if (fallbackCompanyId) {
                localStorage.setItem("companyId", String(fallbackCompanyId));
              }

              // Retry the request ONCE with the new stored IDs
              const retryData = await this.request(queryString ? `/employees/${queryString}` : `/employees/`, {
                headers: {
                  "X-Branch-Id": String(fallbackBranchId),
                  "X-Company-Id": fallbackCompanyId ? String(fallbackCompanyId) : ""
                }
              });
              return Array.isArray(retryData) ? retryData : retryData?.employees || [];
            }
          }
        } catch (retryError) {
          console.error("Automatic scope resolution failed:", retryError);
        }

        console.error("Employee Fetch Error: Scope/Branch Conflict detected. Status:", error.status);
        // Important: throw an error that explicitly mentions the need for a scope selector
        const conflictError = new Error("Scope conflict: Multiple company/branch assignments found. Please select a branch.");
        (conflictError as any).status = 409;
        (conflictError as any).type = 'SCOPE_CONFLICT';

        // Dispatch global event for the UI to show the scope selector
        window.dispatchEvent(new CustomEvent('scope-conflict'));

        throw conflictError;
      }

      throw error;
    }
  }


  // Export all employees to PDF
  async exportEmployeesPDF(params?: {
    department?: string;
    role?: string;
    designation?: string;
    status?: boolean | string;
    is_active?: boolean | string;
    branch_id?: number | string;
    company_id?: number | string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    const extraHeaders: Record<string, string> = {};

    if (params) {
      if (params.department && params.department !== "all") queryParams.append("department", params.department);
      if (params.role && params.role !== "all") queryParams.append("role", params.role);
      if (params.designation && params.designation !== "all") queryParams.append("designation", params.designation);

      const activeStatus = params.is_active !== undefined ? params.is_active : params.status;
      if (activeStatus !== undefined && activeStatus !== "all") {
        queryParams.append("is_active", String(activeStatus === 'active' ? 'true' : activeStatus === 'inactive' ? 'false' : activeStatus));
      }

      if (params.branch_id) extraHeaders['X-Branch-Id'] = String(params.branch_id);
      if (params.company_id) extraHeaders['X-Company-Id'] = String(params.company_id);
    }

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return this.download(`/employees/export/pdf${queryString}`, {
      headers: extraHeaders
    });
  }

  // Export all employees to CSV
  async exportEmployeesCSV(params?: {
    department?: string;
    role?: string;
    designation?: string;
    status?: boolean | string;
    is_active?: boolean | string;
    branch_id?: number | string;
    company_id?: number | string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    const extraHeaders: Record<string, string> = {};

    if (params) {
      if (params.department && params.department !== "all") queryParams.append("department", params.department);
      if (params.role && params.role !== "all") queryParams.append("role", params.role);
      if (params.designation && params.designation !== "all") queryParams.append("designation", params.designation);

      const activeStatus = params.is_active !== undefined ? params.is_active : params.status;
      if (activeStatus !== undefined && activeStatus !== "all") {
        queryParams.append("is_active", String(activeStatus === 'active' ? 'true' : activeStatus === 'inactive' ? 'false' : activeStatus));
      }

      if (params.branch_id) extraHeaders['X-Branch-Id'] = String(params.branch_id);
      if (params.company_id) extraHeaders['X-Company-Id'] = String(params.company_id);
    }

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return this.download(`/employees/export/csv${queryString}`, {
      headers: extraHeaders
    });
  }

  // Alias for getEmployees to satisfy various component imports
  async getAllEmployees() {
    return this.getEmployees();
  }

  // Backwards compatibility for exact branch filter
  async getEmployeesByBranch(branch: string) {
    return this.getEmployees(branch);
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
          aadhar_card:
            employeeData.aadhar_card || employeeData.aadharNumber || null,
          phone: employeeData.phone || employeeData.phoneNumber || null,
        };
      }
      return employeeData;
    } catch (error) {
      console.error("Failed to fetch employee with PAN details:", error);
      throw error;
    }
  }

  async getBranchManagers() {
    return this.request("/departments/managers");
  }

  // Branch APIs
  async getBranchs(): Promise<Branch[]> {
    return this.request("/departments");
  }

  async getBranchNames(): Promise<{ name: string; code: string }[]> {
    return this.request("/departments/names");
  }

  async createBranch(data: BranchData): Promise<Branch> {
    return this.request("/departments", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async updateBranch(id: number, data: Partial<BranchData>): Promise<Branch> {
    return this.request(`/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async deleteBranch(id: number): Promise<void> {
    await this.request(`/departments/${id}`, {
      method: "DELETE",
    });
  }

  async syncBranchsFromUsers(): Promise<{
    message: string;
    created: number;
    updated: number;
    departments_created: string[];
    total_departments: number;
  }> {
    return this.request("/departments/sync-from-users", {
      method: "POST",
    });
  }

  // --- Department Aliases for backward compatibility ---
  async getDepartments() {
    return this.getBranchs();
  }

  async getDepartmentNames() {
    return this.getBranchNames();
  }

  async createDepartment(data: BranchData) {
    return this.createBranch(data);
  }

  async updateDepartment(id: number, data: Partial<BranchData>) {
    return this.updateBranch(id, data);
  }

  async deleteDepartment(id: number) {
    return this.deleteBranch(id);
  }

  async syncDepartmentsFromUsers() {
    return this.syncBranchsFromUsers();
  }
  // ------------------------------------------------------

  // Dashboard endpoints
  async getAdminDashboard() {
    return this.request("/dashboard/admin");
  }

  async getHRDashboard() {
    return this.request("/dashboard/hr");
  }

  async getManagerDashboard() {
    return this.request("/dashboard/manager");
  }

  async getTeamLeadDashboard() {
    return this.request("/dashboard/team-lead");
  }

  async getEmployeeDashboard() {
    return this.request("/dashboard/employee");
  }

  // User tasks
  async getMyTasks() {
    return this.request("/tasks/");
  }

  async getTaskHistory(taskId: string | number) {
    return this.request(`/tasks/${taskId}/history`);
  }


  // Legacy/Compatibility Bulk create tasks (PUT /tasks/bulk)
  async createTasksBulk(
    tasks: {
      title: string;
      description?: string;
      priority?: string;
      due_date?: string | null;
      assigned_to: number;
      assigned_by: number;
    }[],
  ) {
    return this.request("/tasks/bulk", {
      method: "PUT",
      body: JSON.stringify(tasks),
    });
  }

  // Create a new employee
  async createEmployee(employeeData: EmployeeData): Promise<Employee> {
    const formData = new FormData();

    // Add all fields to FormData
    Object.entries(employeeData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === "profile_photo") {
          if (value instanceof File) {
            formData.append(key, value);
          }
          // Skip string URLs or empty strings for creation
        } else {
          formData.append(key, String(value));
        }
      }
    });

    const response = await this.request("/employees/register", {
      method: "POST",
      body: formData,
      // No standard 'Content-Type' header here, FormData handles it
    });

    return response;
  }

  // Update an employee - Updated to use user_id instead of employee_id
  async updateEmployee(
    userId: string,
    employeeData: Partial<EmployeeData>,
  ): Promise<Employee> {
    // Backend expects FormData, so always use FormData
    const formData = new FormData();

    // Add all fields to FormData
    Object.entries(employeeData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === "profile_photo") {
          if (value instanceof File) {
            formData.append(key, value);
          } else if (value === "") {
            // Signal photo removal by sending an empty blob as a file
            formData.append(
              key,
              new Blob([], { type: "application/octet-stream" }),
              "",
            );
          }
          // Skip if it's an existing photo URL string or undefined
        } else {
          formData.append(key, String(value));
        }
      }
    });

    const response = await this.request(`/employees/${userId}`, {
      method: "PUT",
      body: formData,
    });

    return response;
  }

  // Delete an employee
  async deleteEmployee(userId: string): Promise<void> {
    await this.request(`/employees/${userId}`, {
      method: "DELETE",
    });
  }

  // Update employee status (activate/deactivate)
  async updateEmployeeStatus(
    userId: string,
    isActive: boolean,
  ): Promise<Employee> {
    return this.request(`/employees/${userId}/status`, {
      method: "PUT",
      body: JSON.stringify({ is_active: isActive }),
    });
  }

  // Bulk update employees status (activate/deactivate multiple)
  async updateEmployeesBulkStatus(
    userIds: number[],
    isActive: boolean,
  ): Promise<Employee[]> {
    return this.request(`/employees/status`, {
      method: "PUT",
      body: JSON.stringify({ user_ids: userIds, is_active: isActive }),
    });
  }

  // Update employee role
  async updateEmployeeRole(userId: string, role: string): Promise<Employee> {
    return this.request(`/employees/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
  }

  // Submit a leave request (Matches SR.NO 4)
  async submitLeaveRequest(
    leaveData: LeaveRequestData,
  ): Promise<LeaveRequestResponse> {
    return this.request("/leave/", {
      method: "POST",
      body: JSON.stringify(leaveData),
    });
  }

  // Get all leave requests with optional period filter
  async getLeaveRequests(
    period: string = "",
    startDate?: string,
    endDate?: string,
  ): Promise<LeaveRequestResponse[]> {
    const companySlug = localStorage.getItem("company_slug") || "";
    const branchId = localStorage.getItem("branchId") || "";
    const companyId = localStorage.getItem("companyId") || "";

    let url = `/leave/?company_slug=${companySlug}`;
    if (period) url += `&period=${period}`;
    if (startDate) url += `&from_date=${startDate}`;
    if (endDate) url += `&to_date=${endDate}`;
    if (branchId) url += `&X-Branch-Id=${branchId}`;
    if (companyId) url += `&X-Company-Id=${companyId}`;

    return this.request(url);
  }

  async getLeaveBalance(): Promise<LeaveBalanceResponse> {
    return this.request("/leave/balance");
  }

  // Leave Allocation Configuration (Admin only)
  async getLeaveAllocationConfig(): Promise<LeaveAllocationConfig[]> {
    return this.request("/leave/config/allocation");
  }

  async getCurrentLeaveAllocation(): Promise<LeaveAllocationConfig> {
    return this.request("/leave/config/allocation");
  }

  async getCurrentLeaveAllocationConfig(): Promise<LeaveAllocationConfig> {
    return this.request("/leave/config/allocation/current");
  }

  async createLeaveAllocationConfig(data: {
    total_annual_leave?: number;
    sick_leave_allocation: number;
    casual_leave_allocation: number;
    other_leave_allocation: number;
  }): Promise<LeaveAllocationConfig> {
    return this.request("/leave/config/allocation", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateLeaveAllocationConfig(
    configId: number,
    data: {
      total_annual_leave?: number;
      sick_leave_allocation?: number;
      casual_leave_allocation?: number;
      other_leave_allocation?: number;
    },
  ): Promise<LeaveAllocationConfig> {
    return this.request(`/leave/config/allocation/${configId}`, {
      method: "PUT",
      body: JSON.stringify({
        config_id: configId,
        ...data,
      }),
    });
  }

  // Update a leave request (Matches SR.NO 5)
  async updateLeaveRequest(
    leaveId: string,
    data: LeaveUpdateData,
  ): Promise<LeaveRequestResponse> {
    const companySlug = localStorage.getItem("company_slug") || "";
    const branchId = localStorage.getItem("branchId") || "";
    const companyId = localStorage.getItem("companyId") || "";

    return this.request(`/leave/${leaveId}`, {
      method: "PUT",
      body: JSON.stringify({
        leave_id: Number(leaveId),
        company_slug: companySlug,
        "X-Branch-Id": branchId,
        "X-Company-Id": companyId,
        ...data,
      }),
    });
  }

  // Delete a leave request (Matches SR.NO 6)
  async deleteLeaveRequest(leaveId: string): Promise<void> {
    return this.request(`/leave/${leaveId}`, {
      method: "DELETE",
      body: JSON.stringify({ leave_id: Number(leaveId) }),
    });
  }

  // Get approvals inbox for current approver
  async getLeaveApprovals(): Promise<
    (LeaveRequestResponse & {
      employee_id: string;
      name: string;
      department?: string;
      role?: string;
    })[]
  > {
    const companySlug = localStorage.getItem("company_slug") || "";
    const branchId = localStorage.getItem("branchId") || "";
    const companyId = localStorage.getItem("companyId") || "";

    let url = `/leave/approvals?company_slug=${companySlug}`;
    if (branchId) url += `&X-Branch-Id=${branchId}`;
    if (companyId) url += `&X-Company-Id=${companyId}`;

    return this.request(url);
  }

  // Get approvals decision history for current approver (Matches SR.NO 7)
  async getLeaveApprovalsHistory(params?: {
    period?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<
    (LeaveRequestResponse & {
      employee_id: string;
      name: string;
      department?: string;
      role?: string;
    })[]
  > {
    const companySlug = localStorage.getItem("company_slug") || "";
    const branchId = localStorage.getItem("branchId") || "";
    const companyId = localStorage.getItem("companyId") || "";

    const query = new URLSearchParams();
    query.append("company_slug", companySlug);
    if (branchId) query.append("X-Branch-Id", branchId);
    if (companyId) query.append("X-Company-Id", companyId);

    if (params?.period) query.append("date_range", params.period);
    if (params?.start_date) query.append("start_date", params.start_date);
    if (params?.end_date) query.append("end_date", params.end_date);
    const queryString = query.toString() ? `?${query.toString()}` : "";

    return this.request(`/leave/approvals/history${queryString}`);
  }

  // Get leave requests by employee
  async getLeaveRequestsByEmployee(
    employeeId: string,
  ): Promise<LeaveRequestResponse[]> {
    return this.request(`/leave/employee/${employeeId}`);
  }

  // Approve or reject a leave request (Matches SR.NO 9)
  async approveLeaveRequest(
    leaveId: string,
    approved: boolean,
  ): Promise<LeaveRequestResponse> {
    const companySlug = localStorage.getItem("company_slug") || "";
    const branchId = localStorage.getItem("branchId") || "";
    const companyId = localStorage.getItem("companyId") || "";

    return this.request(`/leave/${leaveId}/approve`, {
      method: "PUT",
      body: JSON.stringify({
        leave_id: parseInt(leaveId),
        company_slug: companySlug,
        "X-Branch-Id": branchId,
        "X-Company-Id": companyId,
        approved
      }),
    });
  }

  // Mark Leave Notification As Read (Matches SR.NO 12)
  async markLeaveNotificationAsRead(notificationId: number) {
    return this.request(`/leave/notifications/${notificationId}/read`, {
      method: "PUT",
      body: JSON.stringify({ notification_id: notificationId }),
    });
  }


  // Hiring Management APIs (Matches SR.NO 1-6)
  async getVacancies(department?: string, status?: string) {
    const params = new URLSearchParams();
    if (department) params.append("department", department);
    if (status) params.append("status_filter", status);
    const query = params.toString();
    return this.request(`/hiring/vacancies${query ? `?${query}` : ""}`);
  }

  async getVacancy(vacancyId: number) {
    return this.request(`/hiring/vacancies/${vacancyId}`);
  }

  async createVacancy(vacancyData: any) {
    return this.request("/hiring/vacancies", {
      method: "POST",
      body: JSON.stringify(vacancyData),
    });
  }

  async updateVacancy(vacancyId: number, vacancyData: any) {
    return this.request(`/hiring/vacancies/${vacancyId}`, {
      method: "PUT",
      body: JSON.stringify({
        vacancy_id: vacancyId,
        ...vacancyData,
      }),
    });
  }

  async deleteVacancy(vacancyId: number) {
    return this.request(`/hiring/vacancies/${vacancyId}`, {
      method: "DELETE",
      body: JSON.stringify({ vacancy_id: vacancyId }),
    });
  }

  async postVacancyToSocialMedia(
    vacancyId: number,
    platforms: string[],
    links?: Record<string, string>,
  ) {
    return this.request(`/hiring/vacancies/${vacancyId}/post-social`, {
      method: "POST",
      body: JSON.stringify({ vacancy_id: vacancyId, platforms, links }),
    });
  }

  // Candidate Management APIs (Matches SR.NO 7-13)
  async getCandidates(vacancyId?: number, status?: string) {
    const params = new URLSearchParams();
    if (vacancyId) params.append("vacancy_id", vacancyId.toString());
    if (status) params.append("status_filter", status);
    const query = params.toString();
    return this.request(`/hiring/candidates${query ? `?${query}` : ""}`);
  }

  async getCandidate(candidateId: number) {
    return this.request(`/hiring/candidates/${candidateId}`);
  }

  async createCandidate(candidateData: any, resumeFile?: File) {
    const formData = new FormData();

    Object.entries(candidateData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    if (resumeFile) {
      formData.append("resume", resumeFile);
    }

    const response = await fetch(`${this.baseURL}/hiring/candidates`, {
      method: "POST",
      headers: {
        ...this.getAuthHeader(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `HTTP error! status: ${response.status}`,
      );
    }

    return await response.json();
  }

  async updateCandidate(candidateId: number, candidateData: any) {
    return this.request(`/hiring/candidates/${candidateId}`, {
      method: "PUT",
      body: JSON.stringify(candidateData),
    });
  }

  async updateCandidateStatus(candidateId: number, status: string) {
    return this.request(`/hiring/candidates/${candidateId}/status`, {
      method: "PUT",
      body: JSON.stringify({
        status: status,
      }),
    });
  }

  async shortlistCandidate(
    candidateId: number,
    interviewData: {
      interview_date: string;
      interview_time?: string;
      interview_mode: string;
      location_or_link: string;
      interviewer_name: string;
      panel_members?: number[];
      round_type?: string;
    },
  ) {
    return this.request(`/hiring/candidates/${candidateId}/shortlist`, {
      method: "PUT",
      body: JSON.stringify({
        candidate_id: candidateId,
        ...interviewData,
      }),
    });
  }

  async deleteCandidate(candidateId: number) {
    return this.request(`/hiring/candidates/${candidateId}`, {
      method: "DELETE",
      body: JSON.stringify({ candidate_id: candidateId }),
    });
  }

  async updateCandidateResume(
    candidateId: number,
    resumeFile?: File,
    resumeUrl?: string,
  ) {
    const formData = new FormData();

    formData.append("candidate_id", String(candidateId));
    if (resumeFile) {
      formData.append("resume", resumeFile);
    }
    if (resumeUrl) {
      formData.append("resume_external_url", resumeUrl);
    }

    const response = await fetch(
      `${this.baseURL}/hiring/candidates/${candidateId}/resume`,
      {
        method: "PUT",
        headers: {
          ...this.getAuthHeader(),
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `HTTP error! status: ${response.status}`,
      );
    }

    return await response.json();
  }

  async getCandidateResume(candidateId: number) {
    // Returns { resume_url: "..." } if it's an external link
    return this.request(`/hiring/candidates/${candidateId}/resume`);
  }

  async downloadCandidateResume(candidateId: number): Promise<Blob> {
    // Returns the file blob if it's a stored file
    return this.download(`/hiring/candidates/${candidateId}/resume`);
  }

  // Interview Management APIs
  async getInterviews(params?: {
    candidate_id?: number;
    vacancy_id?: number;
    panel_member_id?: number;
    status_filter?: string;
    from_date?: string;
    to_date?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.candidate_id)
      query.append("candidate_id", params.candidate_id.toString());
    if (params?.vacancy_id)
      query.append("vacancy_id", params.vacancy_id.toString());
    if (params?.panel_member_id)
      query.append("panel_member_id", params.panel_member_id.toString());
    if (params?.status_filter)
      query.append("status_filter", params.status_filter);
    if (params?.from_date) query.append("from_date", params.from_date);
    if (params?.to_date) query.append("to_date", params.to_date);

    const queryString = query.toString();
    return this.request(`/interviews/${queryString ? `?${queryString}` : ""}`);
  }

  async getCandidateInterviews(candidateId: number, statusFilter?: string) {
    const query = new URLSearchParams();
    if (statusFilter) query.append("status_filter", statusFilter);
    const queryString = query.toString();
    return this.request(
      `/interviews/candidates/${candidateId}/interviews${queryString ? `?${queryString}` : ""}`,
    );
  }

  async getVacancyInterviews(vacancyId: number, statusFilter?: string) {
    const query = new URLSearchParams();
    if (statusFilter) query.append("status_filter", statusFilter);
    const queryString = query.toString();
    return this.request(
      `/interviews/vacancies/${vacancyId}/interviews${queryString ? `?${queryString}` : ""}`,
    );
  }

  async getInterview(interviewId: number) {
    return this.request(`/interviews/${interviewId}`);
  }

  async createInterview(interviewData: any) {
    return this.request("/interviews/", {
      method: "POST",
      body: JSON.stringify(interviewData),
    });
  }

  async updateInterview(interviewId: number, interviewData: any) {
    return this.request(`/interviews/${interviewId}`, {
      method: "PUT",
      body: JSON.stringify({
        interview_id: interviewId,
        ...interviewData,
      }),
    });
  }

  async deleteInterview(interviewId: number) {
    return this.request(`/interviews/${interviewId}`, {
      method: "DELETE",
      body: JSON.stringify({ interview_id: interviewId }),
    });
  }

  async updateInterviewStatus(interviewId: number, status: string) {
    return this.request(`/interviews/${interviewId}/status`, {
      method: "PUT",
      body: JSON.stringify({
        interview_id: interviewId,
        status: status,
      }),
    });
  }

  // Interview Feedback APIs
  async getInterviewFeedback(interviewId: number) {
    return this.request(`/interviews/${interviewId}/feedback`);
  }

  async getSingleInterviewFeedback(interviewId: number, feedbackId: number) {
    return this.request(`/interviews/${interviewId}/feedback/${feedbackId}`);
  }

  async createInterviewFeedback(interviewId: number, feedbackData: any) {
    return this.request(`/interviews/${interviewId}/feedback`, {
      method: "POST",
      body: JSON.stringify({
        interview_id: interviewId,
        ...feedbackData,
      }),
    });
  }

  async updateInterviewFeedback(
    interviewId: number,
    feedbackId: number,
    feedbackData: any,
  ) {
    return this.request(`/interviews/${interviewId}/feedback/${feedbackId}`, {
      method: "PUT",
      body: JSON.stringify({
        interview_id: interviewId,
        feedback_id: feedbackId,
        ...feedbackData,
      }),
    });
  }

  async deleteInterviewFeedback(interviewId: number, feedbackId: number) {
    return this.request(`/interviews/${interviewId}/feedback/${feedbackId}`, {
      method: "DELETE",
      body: JSON.stringify({
        interview_id: interviewId,
        feedback_id: feedbackId,
      }),
    });
  }

  // Shift Management APIs
  async getShifts(department?: string) {
    const params = new URLSearchParams();
    if (department) params.append("department", department);
    const query = params.toString();
    return this.request(`/shift${query ? `?${query}` : ""}`);
  }

  async getShift(shiftId: number) {
    return this.request(`/shift/${shiftId}`);
  }

  async createShift(shiftData: any) {
    return this.request("/shift", {
      method: "POST",
      body: JSON.stringify(shiftData),
    });
  }

  async updateShift(shiftId: number, shiftData: any) {
    return this.request(`/shift/${shiftId}`, {
      method: "PUT",
      body: JSON.stringify(shiftData),
    });
  }

  async deleteShift(shiftId: number) {
    return this.request(`/shift/${shiftId}`, {
      method: "DELETE",
    });
  }

  async assignShift(assignmentData: any) {
    return this.request("/shift/assignment", {
      method: "POST",
      body: JSON.stringify(assignmentData),
    });
  }

  async bulkAssignShift(assignmentData: any) {
    return this.request("/shift/assignment/bulk", {
      method: "POST",
      body: JSON.stringify(assignmentData),
    });
  }

  async getDepartmentSchedule(scheduleDate: string, department?: string) {
    const params = new URLSearchParams();
    params.append("schedule_date", scheduleDate);
    if (department) params.append("department", department);
    return this.request(`/shift/schedule/department?${params.toString()}`);
  }

  async getMyShiftSchedule(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    const query = params.toString();

    return this.request(`/shift/schedule/my${query ? `?${query}` : ""}`);
  }

  async updateShiftAssignment(assignmentId: number, assignmentData: any) {
    return this.request(`/shift/assignment/${assignmentId}`, {
      method: "PUT",
      body: JSON.stringify(assignmentData),
    });
  }

  async deleteShiftAssignment(assignmentId: number) {
    return this.request(`/shift/assignment/${assignmentId}`, {
      method: "DELETE",
    });
  }

  async getDepartmentScheduleWeek(startDate: string, endDate?: string) {
    const params = new URLSearchParams({ start_date: startDate });
    if (endDate) {
      params.append("end_date", endDate);
    }
    return this.request(`/shift/schedule/department/week?${params.toString()}`);
  }

  async markShiftNotificationAsRead(notificationId: number) {
    return this.request(`/shift/notifications/${notificationId}/read`, {
      method: "PUT",
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
      ...(params.department &&
        params.department !== "all" && { department: params.department }),
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
    return this.request("/reports/departments");
  }

  async exportPerformanceReport(params: {
    format: "pdf" | "csv";
    start_date: string;
    end_date: string;
    employee_id?: string;
    department?: string;
  }) {
    const query = new URLSearchParams({
      format: params.format,
      start_date: params.start_date,
      end_date: params.end_date,
      ...(params.employee_id && { employee_id: params.employee_id }),
      ...(params.department &&
        params.department !== "all" && { department: params.department }),
    });

    return this.download(`/reports/export?${query.toString()}`);
  }

  async updateBulkEmployeeStatus(userIds: number[], isActive: boolean) {
    return this.request("/employees/status", {
      method: "PUT",
      body: JSON.stringify({
        user_ids: userIds,
        is_active: isActive,
      }),
    });
  }

  async exportLeaveReport(params: {
    format: "pdf" | "csv";
    start_date?: string;
    end_date?: string;
    department?: string;
  }) {
    const query = new URLSearchParams({
      format: params.format,
      ...(params.start_date && { start_date: params.start_date }),
      ...(params.end_date && { end_date: params.end_date }),
      ...(params.department &&
        params.department !== "all" && { department: params.department }),
    });

    return this.download(`/reports/leave?${query.toString()}`);
  }

  async exportTaskManagementReport(params: {
    department?: string;
    period_type?: string;
    month?: number;
    quarter?: number;
    year?: number;
    start_date?: string;
    end_date?: string;
    status?: string;
  }): Promise<Blob> {
    const query = new URLSearchParams();
    if (params.department && params.department !== "all")
      query.append("department", params.department);
    if (params.period_type) query.append("period_type", params.period_type);
    if (params.month) query.append("month", params.month.toString());
    if (params.quarter) query.append("quarter", params.quarter.toString());
    if (params.year) query.append("year", params.year.toString());
    if (params.start_date) query.append("start_date", params.start_date);
    if (params.end_date) query.append("end_date", params.end_date);
    if (params.status) query.append("status", params.status);

    return this.download(`/reports/task-management?${query.toString()}`);
  }

  // Task Comments
  async getTaskComments(taskId: number) {
    return this.request(`/tasks/${taskId}/comments`);
  }

  async addTaskComment(taskId: number, comment?: string, file?: File) {
    const formData = new FormData();

    if (comment) {
      formData.append("comment", comment);
    }
    if (file) {
      formData.append("file", file);
    }

    const response = await fetch(`${this.baseURL}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: {
        ...this.getAuthHeader(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `HTTP error! status: ${response.status}`,
      );
    }

    return await response.json();
  }

  async deleteTaskComment(taskId: number, commentId: number) {
    return this.request(`/tasks/${taskId}/comments/${commentId}`, {
      method: "DELETE",
    });
  }

  // Work From Home (WFH) APIs
  async submitWFHRequest(wfhData: {
    start_date: string;
    end_date: string;
    wfh_type: "Full Day" | "Half Day";
    reason: string;
  }) {
    return this.request("/wfh/request", {
      method: "POST",
      body: JSON.stringify(wfhData),
    });
  }

  async getWFHRequests(period?: string) {
    // Fetch all WFH requests for admin/hr/manager approval
    // This endpoint returns all WFH requests that need approval
    try {
      const response = await this.request("/wfh/requests");
      return Array.isArray(response)
        ? response
        : response?.data || response?.requests || [];
    } catch (error: any) {
      // If the endpoint returns 500 or is not available, silently return empty array
      // The backend may not have this endpoint fully implemented yet
      if (import.meta.env.DEV) {
        console.warn(
          "WFH Requests endpoint not available:",
          error?.message || error,
        );
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
    return this.request("/wfh/my-requests");
  }

  async getWFHRequestById(wfhId: number) {
    return this.request(`/wfh/request/${wfhId}`);
  }

  async updateWFHRequest(
    wfhId: number,
    wfhData: Partial<{
      start_date: string;
      end_date: string;
      wfh_type: "Full Day" | "Half Day";
      reason: string;
    }>,
  ) {
    return this.request(`/wfh/my-requests/${wfhId}`, {
      method: "PUT",
      body: JSON.stringify(wfhData),
    });
  }

  async deleteWFHRequest(wfhId: number) {
    return this.request(`/wfh/my-requests/${wfhId}`, {
      method: "DELETE",
    });
  }

  async getWFHApprovals() {
    return this.request("/wfh/requests");
  }

  async approveWFHRequest(
    wfhId: number,
    approved: boolean,
    rejectionReason?: string,
  ) {
    return this.request(`/wfh/requests/${wfhId}/approve`, {
      method: "PUT",
      body: JSON.stringify({
        approved,
        ...(rejectionReason && { rejection_reason: rejectionReason }),
      }),
    });
  }

  // Attendance APIs
  async getAttendanceRecords(params?: {
    date?: string;
    department?: string;
    manager_id?: string | number;
    team_lead_id?: string | number;
    employee_id?: string | number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.date) queryParams.append("date", params.date);
    if (params?.department) queryParams.append("department", params.department);
    if (params?.manager_id)
      queryParams.append("manager_id", String(params.manager_id));
    if (params?.team_lead_id)
      queryParams.append("team_lead_id", String(params.team_lead_id));
    if (params?.employee_id)
      queryParams.append("employee_id", String(params.employee_id));
    const queryString = queryParams.toString()
      ? `?${queryParams.toString()}`
      : "";
    return this.request(`/attendance/all${queryString}`);
  }

  async getMyAttendance(userId: string | number) {
    return this.request(`/attendance/my-attendance/${userId}`);
  }

  async getWorkingHours(attendanceId: number) {
    return this.request(`/attendance/working-hours/${attendanceId}`);
  }

  async getWorkingHoursSummary(params: {
    user_id: number;
    period?: "week" | "current_month" | "last_month" | "last_3_months" | "custom";
    start_date?: string; // yyyy-MM-dd, required when period = "custom"
    end_date?: string;   // yyyy-MM-dd, required when period = "custom"
  }): Promise<WorkingHoursSummaryResponse> {
    const query = new URLSearchParams();
    query.append("user_id", String(params.user_id));
    if (params.period) query.append("period", params.period);
    if (params.start_date) query.append("start_date", params.start_date);
    if (params.end_date) query.append("end_date", params.end_date);
    return this.request(`/attendance/working-hours/summary?${query.toString()}`);
  }

  async getAttendanceStatus() {
    return this.request("/attendance/status");
  }

  async getTodayAttendance() {
    return this.request("/attendance/today");
  }

  async getAttendanceSummary() {
    return this.request("/attendance/summary");
  }

  async checkIn(data: any) {
    if (data instanceof FormData) {
      return this.request("/attendance/check-in", {
        method: "POST",
        body: data,
      });
    }
    return this.request("/attendance/check-in/json", {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
  }

  async checkOut(data: any) {
    if (data instanceof FormData) {
      return this.request("/attendance/check-out", {
        method: "POST",
        body: data,
      });
    }
    return this.request("/attendance/check-out/json", {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
  }

  async getCurrentOnlineStatus() {
    return this.request("/attendance/current-online-status");
  }

  async getOnlineStatusHistory(attendanceId: number) {
    return this.request(`/attendance/online-status/${attendanceId}`);
  }

  async recordAttendanceLogin(userId: number, timestamp: string) {
    return this.request("/attendance/login-resume", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, login_timestamp: timestamp }),
    });
  }

  async recordAttendanceLogout(userId: number, timestamp: string) {
    return this.request("/attendance/logout", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, logout_timestamp: timestamp }),
    });
  }

  async updateOnlineStatus(isOnline: boolean, attendanceId?: number, reason?: string | null) {
    const body: any = { is_online: isOnline };
    if (attendanceId) body.attendance_id = attendanceId;
    if (reason) body.reason = reason;

    return this.request("/attendance/online-status", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async getUserOnlineStatus(userId: string | number) {
    return this.request(`/attendance/user-online-status/${userId}`);
  }

  // Export attendance as CSV
  async exportAttendanceCSV(params: {
    employee_id?: string;
    department?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (params.employee_id)
      queryParams.append("employee_id", params.employee_id);
    if (params.department) queryParams.append("department", params.department);
    if (params.start_date) queryParams.append("start_date", params.start_date);
    if (params.end_date) queryParams.append("end_date", params.end_date);

    return this.download(`/attendance/download/csv?${queryParams.toString()}`);
  }

  // Export attendance as PDF
  async exportAttendancePDF(params: {
    employee_id?: string;
    department?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (params.employee_id)
      queryParams.append("employee_id", params.employee_id);
    if (params.department) queryParams.append("department", params.department);
    if (params.start_date) queryParams.append("start_date", params.start_date);
    if (params.end_date) queryParams.append("end_date", params.end_date);

    return this.download(`/attendance/download/pdf?${queryParams.toString()}`);
  }

  // Export Monthly Attendance Grid as PDF
  async exportMonthlyGridPDF(params: {
    month: string;
    year: string;
    department?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.append("month", params.month);
    queryParams.append("year", params.year);
    if (params.department && params.department !== "all") {
      queryParams.append("department", params.department);
    }

    return this.download(
      `/attendance/report/monthly-grid/download/pdf?${queryParams.toString()}`,
    );
  }

  // Export Monthly Attendance Grid as CSV
  async exportMonthlyGridCSV(params: {
    month: string;
    year: string;
    department?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.append("month", params.month);
    queryParams.append("year", params.year);
    if (params.department && params.department !== "all") {
      queryParams.append("department", params.department);
    }

    return this.download(
      `/attendance/report/monthly-grid/download/csv?${queryParams.toString()}`,
    );
  }

  // Export Monthly Attendance Detailed Grid as PDF (New Endpoint)
  async downloadMonthlyDetailedAttendanceGridPDF(params: {
    month: string;
    year: string;
    department?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.append("month", params.month);
    queryParams.append("year", params.year);
    if (params.department && params.department !== "all") {
      queryParams.append("department", params.department);
    }

    return this.download(
      `/attendance/report/monthly-detailed-grid/download/pdf?${queryParams.toString()}`,
    );
  }

  // Export Monthly Attendance Detailed Grid as CSV
  async exportMonthlyGridDetailedCSV(params: {
    month: string;
    year: string;
    department?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.append("month", params.month);
    queryParams.append("year", params.year);
    if (params.department && params.department !== "all") {
      queryParams.append("department", params.department);
    }

    return this.download(
      `/attendance/report/monthly-grid-detailed/download/csv?${queryParams.toString()}`,
    );
  }

  // Office timings
  async getOfficeTimings() {
    return this.request("/attendance/office-hours");
  }

  async createOfficeTiming(data: any) {
    return this.request("/attendance/office-hours", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateOfficeTiming(data: any) {
    return this.request("/attendance/office-hours", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteOfficeTiming(timingId: number) {
    return this.request(`/attendance/office-hours/${timingId}`, {
      method: "DELETE",
    });
  }

  // Holiday Management APIs
  async getHolidays(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<
    Array<{
      id: number;
      date: string;
      name: string;
      description?: string;
      is_recurring?: boolean;
      created_at: string;
      updated_at?: string;
    }>
  > {
    const queryParams = new URLSearchParams();
    if (params?.start_date) {
      queryParams.append("start_date", params.start_date);
    }
    if (params?.end_date) {
      queryParams.append("end_date", params.end_date);
    }
    const queryString = queryParams.toString();
    return this.request(
      `/calendar/holidays${queryString ? `?${queryString}` : ""}`,
    );
  }

  async createHoliday(data: {
    date: string;
    name: string;
    description?: string;
    is_recurring?: boolean;
  }): Promise<{
    id: number;
    date: string;
    name: string;
    description?: string;
    is_recurring?: boolean;
    created_at: string;
    updated_at?: string;
  }> {
    // Ensure is_recurring is always sent (default to false if not provided)
    const requestData = {
      date: data.date,
      name: data.name,
      description: data.description || "",
      is_recurring: data.is_recurring ?? false,
    };

    return this.request("/calendar/holidays", {
      method: "POST",
      body: JSON.stringify(requestData),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async updateHoliday(
    id: number,
    data: {
      date?: string;
      name?: string;
      description?: string;
      is_recurring?: boolean;
    },
  ): Promise<{
    id: number;
    date: string;
    name: string;
    description?: string;
    is_recurring?: boolean;
    created_at: string;
    updated_at?: string;
  }> {
    return this.request(`/calendar/holidays/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async deleteHoliday(id: number): Promise<void> {
    await this.request(`/calendar/holidays/${id}`, {
      method: "DELETE",
    });
  }

  // Weekoff Management APIs
  async getWeekoffs(): Promise<
    Array<{
      id: number;
      department: string;
      days: string[];
      is_active: boolean;
      created_at: string;
    }>
  > {
    return this.request("/calendar/weekoffs");
  }

  async createWeekoff(data: { department: string; days: string[] }): Promise<{
    id: number;
    department: string;
    days: string[];
    is_active: boolean;
    created_at: string;
  }> {
    return this.request("/calendar/weekoffs", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async deleteWeekoff(ruleId: number): Promise<void> {
    await this.request(`/calendar/weekoffs/${ruleId}`, {
      method: "DELETE",
    });
  }

  // Salary Management APIs
  // 1. List all employee salaries
  async getAllEmployeeSalaries(params?: {
    departments?: string | null;
    skip?: number;
    limit?: number;
  }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.departments) query.append("departments", params.departments);
    if (params?.skip !== undefined)
      query.append("skip", params.skip.toString());
    if (params?.limit !== undefined)
      query.append("limit", params.limit.toString());

    return this.request(
      `/salary/employees${query.toString() ? `?${query.toString()}` : ""}`,
    );
  }

  // 2. Create Salary
  async createSalary(data: any): Promise<any> {
    // Map camelCase to snake_case if needed, or assume caller sends correct format.
    // Spec: user_id, package_ctc_annual, etc.
    return this.request("/salary/employee/from-ctc", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 2.1 Create Save Salary (Admin Only)
  async createManualSalary(data: any): Promise<any> {
    return this.request("/salary/employee", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 2. Salary Preview
  async calculateSalaryPreview(
    annualCtc: number,
    variablePayType: string,
    variablePayValue: number,
  ): Promise<any> {
    const params = new URLSearchParams();
    params.append("package_ctc_annual", annualCtc.toString());
    params.append("variable_pay_type", variablePayType);
    params.append("variable_pay_value", variablePayValue.toString());

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
      method: "POST",
    });
  }

  // 3. View Salary Details
  async getSalaryDetails(userId: string, month?: number, year?: number): Promise<any> {
    try {
      let endpoint = `/salary/employee/${userId}`;
      if (month && year) {
        endpoint += `?month=${month}&year=${year}`;
      }
      const response = await this.request(endpoint);

      // Validate and normalize the response data
      if (response && typeof response === "object") {
        // Ensure all required fields are properly mapped from snake_case to camelCase
        const annualCtc =
          response.ctc_annual || response.package_ctc_annual || 0;
        const monthlyGross = response.total_earnings_annual
          ? response.total_earnings_annual / 12
          : response.monthly_gross || 0;
        const monthlyDeductions = response.total_deductions_annual
          ? response.total_deductions_annual / 12
          : response.monthly_deductions || 0;

        // Use actual monthly_in_hand from backend if provided (crucial for month-specific queries like Feb)
        const calculatedInHand = monthlyGross - monthlyDeductions;
        const finalMonthlyInHand =
          response.monthly_in_hand !== undefined
            ? response.monthly_in_hand
            : calculatedInHand > 0
              ? calculatedInHand
              : 0;

        return {
          ...response,
          userId: String(response.user_id || userId),
          annualCtc: annualCtc,
          monthlyBasic: response.basic_annual
            ? response.basic_annual / 12
            : response.monthly_basic || 0,
          hra: response.hra_annual
            ? response.hra_annual / 12
            : response.hra || 0,
          specialAllowance: response.special_allowance_annual
            ? response.special_allowance_annual / 12
            : response.special_allowance || 0,
          medicalAllowance: response.medical_allowance_annual
            ? response.medical_allowance_annual / 12
            : response.medical_allowance || 0,
          conveyanceAllowance: response.conveyance_annual
            ? response.conveyance_annual / 12
            : response.conveyance_allowance || 0,
          otherAllowance: response.other_allowance_annual
            ? response.other_allowance_annual / 12
            : response.other_allowance || 0,
          professionalTax: response.monthly_professional_tax !== undefined
            ? response.monthly_professional_tax
            : response.professional_tax_annual
              ? response.professional_tax_annual / 12
              : response.professional_tax || 0,
          pfEmployer: response.pf_annual
            ? response.pf_annual / 2 / 12
            : response.pf_employer || 0,
          pfEmployee: response.pf_annual
            ? response.pf_annual / 2 / 12
            : response.pf_employee || 0,
          otherDeduction: response.other_deduction_annual
            ? response.other_deduction_annual / 12
            : response.other_deduction || 0,
          variablePay: response.variable_pay || 0,
          monthlyGross: monthlyGross,
          monthlyDeductions: monthlyDeductions,
          monthlyInHand: finalMonthlyInHand,
          monthly_ctc: response.monthly_ctc || annualCtc / 12,
          workingDays: response.working_days_per_month || 26,
          paymentMode:
            response.payment_mode?.toLowerCase().replace(" ", "_") ||
            "bank_transfer",
          bankName: response.bank_name || "",
          accountNumber: response.bank_account || "",
          ifscCode: response.ifsc_code || "",
          panNumber: response.pan_number || "",
          uanNumber: response.uan_number || "",
          is_active:
            response.is_active !== undefined ? response.is_active : true,
          effectiveDate: response.created_at || "",
          createdAt: response.created_at || "",
          updatedAt: response.updated_at || "",
        };
      }

      return response;
    } catch (error: any) {
      console.error(
        `Failed to fetch salary details for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  // 4. Update Salary CTC
  async updateSalaryCtc(
    userId: string,
    data: {
      annualCtc: number;
      variablePayType: string;
      variablePayValue: number;
      employer_pf_percentage?: number;
      pf_annual?: number;
    },
  ): Promise<any> {
    return this.request(`/salary/employee/${userId}/update-ctc`, {
      method: "PUT",
      body: JSON.stringify({
        user_id: Number(userId),
        package_ctc_annual: data.annualCtc,
        variable_pay_type: data.variablePayType,
        variable_pay_value: data.variablePayValue,
        employer_pf_percentage: data.employer_pf_percentage,
        pf_annual: data.pf_annual,
      }),
    });
  }

  // Update Non-CTC Fields (Bank Details, PF Details, Variable Pay)
  async updateSalaryDetails(userId: string, data: any): Promise<any> {
    return this.request(`/salary/employee/${userId}`, {
      method: "PUT",
      body: JSON.stringify({
        user_id: Number(userId),
        ...data,
      }),
    });
  }

  // Update Salary Record Manual (Full-edit without triggering automatic recomputation)
  async updateSalaryManualFullEdit(userId: string, data: any): Promise<any> {
    return this.request(`/salary/employee/${userId}/manual-full-edit`, {
      method: "PUT",
      body: JSON.stringify({
        user_id: Number(userId),
        ...data,
      }),
    });
  }

  // Toggle salary active/inactive
  async toggleSalaryStatus(userId: string, activate: boolean): Promise<any> {
    const payload = {
      user_id: Number(userId),
      is_active: activate,
    };

    return this.request(`/salary/employee/${userId}/status`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  // Update Bank Details Only (Admin Only)
  async updateBankDetails(
    userId: string,
    data: {
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
    },
  ): Promise<any> {
    return this.request(`/salary/employee/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // 5. Delete Salary
  async deleteSalary(userId: string): Promise<any> {
    return this.request(`/salary/employee/${userId}`, {
      method: "DELETE",
    });
  }

  // 6. Salary Slips
  async downloadSalarySlip(
    userId: string,
    month: number,
    year: number,
    options?: {
      optional_deduction_1_label?: string;
      optional_deduction_1_amount?: number;
      optional_deduction_2_label?: string;
      optional_deduction_2_amount?: number;
      optional_deduction_3_label?: string;
      optional_deduction_3_amount?: number;
      manual_leave_days?: number;
      inline?: boolean;
      preview?: boolean;
    }
  ): Promise<Blob> {
    const query = new URLSearchParams({
      month: String(month),
      year: String(year)
    });
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          query.append(key, String(value));
        }
      });
    }
    return this.download(`/salary/slip/download/${userId}?${query.toString()}`);
  }

  async sendSalarySlip(
    userId: string,
    month: number,
    year: number,
  ): Promise<any> {
    return this.request(
      `/salary/slip/send/${userId}?month=${month}&year=${year}`,
      {
        method: "POST",
      },
    );
  }

  // Salary Slip History
  async getSalarySlipHistory(userId: string, year?: number): Promise<any> {
    const params = new URLSearchParams();
    if (year) params.append("year", year.toString());
    const query = params.toString();
    return this.request(
      `/salary/slip/history/${userId}${query ? `?${query}` : ""}`,
    );
  }

  // 7. Annexure & Offer Letter
  async downloadAnnexure(userId: string): Promise<Blob> {
    return this.download(`/salary/annexure/download/${userId}`);
  }

  async sendAnnexureEmail(userId: string): Promise<any> {
    return this.request(`/salary/annexure/send/${userId}`, {
      method: "POST",
      body: JSON.stringify({ user_id: parseInt(userId) }),
    });
  }

  async downloadOfferLetter(
    userId: string,
    params?: { letter_date?: string; joining_date?: string },
  ): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (params?.letter_date) {
      queryParams.append("letter_date", params.letter_date);
    }
    if (params?.joining_date) {
      queryParams.append("joining_date", params.joining_date);
    }
    const queryString = queryParams.toString();
    return this.download(
      `/salary/offer-letter/download/${userId}${queryString ? `?${queryString}` : ""}`,
    );
  }

  // 8. Increment (Create salary increment record admin and hr only)
  async createIncrement(data: {
    userId: string;
    incrementAmount: number;
    incrementPercentage: number;
    effectiveDate: string;
    reason: string;
    newSalary: number;
    previousSalary: number;
  }): Promise<any> {
    return this.request("/salary/increment", {
      method: "POST",
      body: JSON.stringify({
        user_id: data.userId,
        previous_salary: data.previousSalary,
        increment_amount: data.incrementAmount,
        increment_percentage: data.incrementPercentage,
        new_salary: data.newSalary,
        effective_date: data.effectiveDate,
        reason: data.reason,
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
    return this.download(`/salary/increment-letter/download/${incrementId}`);
  }

  async sendIncrementLetter(incrementId: string): Promise<any> {
    return this.request(`/salary/increment-letter/send/${incrementId}`, {
      method: "POST",
      body: JSON.stringify({ increment_id: parseInt(incrementId) }),
    });
  }

  // ─────────────────────────────────────────────
  // Project Management APIs
  // ─────────────────────────────────────────────

  async getProjects(status?: string): Promise<any> {
    const params = new URLSearchParams();
    if (status) params.append("status_filter", status);
    const query = params.toString();
    return this.request(`/projects/${query ? `?${query}` : ""}`);
  }

  async getProject(projectId: number): Promise<any> {
    return this.request(`/projects/${projectId}`);
  }

  async getProjectById(projectId: number): Promise<any> {
    return this.getProject(projectId);
  }

  async createProject(projectData: any): Promise<any> {
    return this.request("/projects/", {
      method: "POST",
      body: JSON.stringify(projectData),
    });
  }

  async updateProject(projectId: number, projectData: any): Promise<any> {
    return this.request(`/projects/${projectId}`, {
      method: "PUT",
      body: JSON.stringify({ project_id: projectId, ...projectData }),
    });
  }

  async updateProjectStatus(
    projectId: number,
    isActive: boolean,
  ): Promise<any> {
    return this.request(`/projects/${projectId}/status`, {
      method: "PUT",
      body: JSON.stringify({ project_id: projectId, is_active: isActive }),
    });
  }

  // Patch only the status field of a project (avoids 'field required' errors)
  async patchProjectStatus(
    projectId: number,
    status: string,
  ): Promise<any> {
    return this.request(`/projects/${projectId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ project_id: projectId, status }),
    });
  }

  async deleteProject(projectId: number): Promise<any> {
    return this.request(`/projects/${projectId}`, {
      method: "DELETE",
      body: JSON.stringify({ project_id: projectId }),
    });
  }

  async addProjectMember(
    projectId: number,
    userId: number,
    role: string = "member",
  ): Promise<any> {
    return this.request(`/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, user_id: userId, role }),
    });
  }

  async addProjectMembersBulk(
    projectId: number,
    userIds: number[],
    role: string = "member",
  ): Promise<any> {
    return this.request(`/projects/${projectId}/members/bulk`, {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, user_ids: userIds, role }),
    });
  }

  async getProjectMembers(projectId: number): Promise<any> {
    return this.request(`/projects/${projectId}/members`);
  }

  async removeProjectMember(projectId: number, userId: number): Promise<any> {
    return this.request(`/projects/${projectId}/members/${userId}`, {
      method: "DELETE",
      body: JSON.stringify({ project_id: projectId, user_id: userId }),
    });
  }

  async createProjectTask(projectId: number, taskData: any): Promise<any> {
    return this.request(`/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, ...taskData }),
    });
  }

  async assignBulkTasks(payload: {
    title: string;
    description?: string;
    status?: string;
    due_date?: string | null;
    start_date?: string | null;
    priority?: string;
    assigned_to_ids: number[];
    project_id: number;
  }): Promise<any> {
    return this.request("/tasks/bulk", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getProjectTasks(projectId: number): Promise<any> {
    return this.request(`/tasks/projects/${projectId}`);
  }

  async updateTaskStatus(
    taskId: number | string,
    status: string
  ): Promise<any> {
    return this.request(`/tasks/${taskId}/status`, {
      method: "PUT",
      body: JSON.stringify({ task_id: Number(taskId), status }),
    });
  }

  async updateTask(taskId: number | string, taskData: any): Promise<any> {
    return this.request(`/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(taskData),
    });
  }

  async deleteTask(taskId: number | string): Promise<any> {
    return this.request(`/tasks/${taskId}`, {
      method: "DELETE",
    });
  }

  async passTask(taskId: number | string, payload: { new_assignee_id: number, note?: string }): Promise<any> {
    return this.request(`/tasks/${taskId}/pass`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Meeting Management APIs
  async getMeetings(params?: {
    type?: string;
    team_id?: number;
    project_id?: number;
    as_creator?: "all" | "true" | "false";
  }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.type) query.append("type", params.type);
    if (params?.team_id) query.append("team_id", params.team_id.toString());
    if (params?.project_id)
      query.append("project_id", params.project_id.toString());
    if (params?.as_creator) query.append("as_creator", params.as_creator);
    const queryString = query.toString() ? `?${query.toString()}` : "";

    return this.request(`/meetings/${queryString}`);
  }

  async getMeeting(meetingId: number): Promise<any> {
    return this.request(`/meetings/${meetingId}`);
  }

  async createMeeting(meetingData: {
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    meeting_url: string;
    type?: string;
    team_id?: number;
    project_id?: number;
    participant_ids?: number[];
  }): Promise<any> {
    return this.request("/meetings/", {
      method: "POST",
      body: JSON.stringify(meetingData),
    });
  }

  async createProjectMeeting(
    projectId: number,
    meetingData: any,
  ): Promise<any> {
    return this.request(`/projects/${projectId}/meetings/`, {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, ...meetingData }),
    });
  }

  async getProjectMeetings(projectId: number): Promise<any[]> {
    return this.request(`/projects/${projectId}/meetings/`);
  }

  async getProjectInvitedMeetings(projectId: number): Promise<any[]> {
    return this.request(`/projects/${projectId}/meetings/invited`);
  }

  async getProjectMeeting(projectId: number, meetingId: number): Promise<any> {
    return this.request(`/projects/${projectId}/meetings/${meetingId}`);
  }

  async updateProjectMeeting(
    projectId: number,
    meetingId: number,
    meetingData: any,
  ): Promise<any> {
    return this.request(`/projects/${projectId}/meetings/${meetingId}`, {
      method: "PUT",
      body: JSON.stringify({
        project_id: projectId,
        meeting_id: meetingId,
        ...meetingData,
      }),
    });
  }

  async getProjectMeetingParticipants(
    projectId: number,
    meetingId: number,
  ): Promise<any[]> {
    return this.request(
      `/projects/${projectId}/meetings/${meetingId}/participants`,
    );
  }

  async deleteProjectMeeting(
    projectId: number,
    meetingId: number,
  ): Promise<any> {
    return this.request(`/projects/${projectId}/meetings/${meetingId}`, {
      method: "DELETE",
      body: JSON.stringify({ project_id: projectId, meeting_id: meetingId }),
    });
  }

  async updateMeeting(
    meetingId: number,
    meetingData: {
      title: string;
      description?: string;
      start_time: string;
      end_time: string;
      meeting_url: string;
      type?: string;
      team_id?: number;
      project_id?: number;
      participant_ids?: number[];
    },
  ): Promise<any> {
    return this.request(`/meetings/${meetingId}`, {
      method: "PUT",
      body: JSON.stringify({
        meeting_id: meetingId,
        ...meetingData,
      }),
    });
  }

  async deleteMeeting(meetingId: number): Promise<any> {
    return this.request(`/meetings/${meetingId}`, {
      method: "DELETE",
    });
  }

  async addMeetingParticipants(
    meetingId: number,
    userIds: number[],
  ): Promise<any[]> {
    return this.request(`/meetings/${meetingId}/participants`, {
      method: "POST",
      body: JSON.stringify({ user_ids: userIds }),
    });
  }

  async removeMeetingParticipant(
    meetingId: number,
    userId: number,
  ): Promise<any> {
    return this.request(`/meetings/${meetingId}/participants/${userId}`, {
      method: "DELETE",
    });
  }
  async getTaskManagementReport(params: {
    department?: string;
    period_type?: string;
    month?: number;
    quarter?: number;
    year?: number;
    start_date?: string;
    end_date?: string;
    status?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryParams.append(key, String(value));
      }
    });

    const queryString = queryParams.toString();
    const endpoint = `/reports/task-management${queryString ? `?${queryString}` : ""}`;
    return this.download(endpoint);
  }

  async getAccessibleCompanies(): Promise<any[]> {
    return this.request("/auth/me/companies");
  }

  async getCurrentUser(): Promise<any> {
    return this.request("/auth/me");
  }

  async getTaskNotifications(slug?: string) {
    const endpoint = "/tasks/notifications";
    return this.request(slug ? `/${slug}${endpoint}` : endpoint);
  }

  async getLeaveNotifications(slug?: string) {
    const endpoint = "/leave/notifications";
    return this.request(slug ? `/${slug}${endpoint}` : endpoint);
  }

  async getShiftNotifications(slug?: string) {
    const endpoint = "/shift/notifications";
    return this.request(slug ? `/${slug}${endpoint}` : endpoint);
  }

  async getWFHNotifications(slug?: string) {
    const endpoint = "/wfh/notifications";
    return this.request(slug ? `/${slug}${endpoint}` : endpoint);
  }

  async getMeetingNotifications(slug?: string) {
    const endpoint = "/meetings/notifications";
    return this.request(slug ? `/${slug}${endpoint}` : endpoint);
  }

  async getSalaryNotifications(slug?: string) {
    const endpoint = "/salary/notifications";
    return this.request(slug ? `/${slug}${endpoint}` : endpoint);
  }

  async getProjectNotifications(slug?: string) {
    const endpoint = "/projects/notifications";
    return this.request(slug ? `/${slug}${endpoint}` : endpoint);
  }

  async getChatNotifications(slug?: string) {
    const endpoint = "/chats/notifications";
    return this.request(slug ? `/${slug}${endpoint}` : endpoint);
  }

  async getAttendanceNotifications(slug?: string) {
    const endpoint = "/attendance/notifications";
    return this.request(slug ? `/${slug}${endpoint}` : endpoint);
  }

  async getHiringNotifications(slug?: string) {
    const endpoint = "/hiring/notifications";
    return this.request(slug ? `/${slug}${endpoint}` : endpoint);
  }

  async markNotificationAsRead(type: string, notificationId: number) {
    let module = type;
    // Map internal types to backend modules if different
    if (type === 'meeting') module = 'meetings';
    if (type === 'chat') module = 'chats';
    if (type === 'project') module = 'projects';
    if (type === 'task') module = 'tasks';
    if (type === 'leave') module = 'leaves';
    if (type === 'shift') module = 'shifts';
    if (type === 'wfh') module = 'wfh';
    if (type === 'salary') module = 'salary';
    if (type === 'attendance') module = 'attendance';
    if (type === 'hiring') module = 'hiring';

    return this.request(`/${module}/notifications/${notificationId}/read`, {
      method: "PUT",
      body: JSON.stringify({ notification_id: notificationId }),
    });
  }

  async switchCompany(companySlug: string): Promise<any> {
    return this.request(`/auth/me/switch-company/${companySlug}`, {
      method: "POST"
    });
  }
}

export const apiService = new ApiService(API_BASE_URL);
export type { Employee, EmployeeData, LeaveRequestData, LeaveRequestResponse };

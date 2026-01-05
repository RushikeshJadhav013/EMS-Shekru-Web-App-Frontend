export type UserRole = 'admin' | 'hr' | 'manager' | 'team_lead' | 'employee';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  designation: string;
  joiningDate: string;
  profilePhoto?: string;
  phone?: string;
  address?: string;
  managerId?: string;
  teamLeadId?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  otp?: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  checkInTime: string;
  checkOutTime?: string;
  checkInLocation: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  checkOutLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  checkInSelfie: string;
  checkOutSelfie?: string;
  workHours?: number;
  workSummary?: string;
  workReport?: string;
  status: 'present' | 'absent' | 'late' | 'half-day' | 'holiday' | 'weekend';
  overtime?: number;
  remarks?: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  leaveType: 'sick' | 'casual' | 'earned' | 'maternity' | 'paternity' | 'unpaid';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string;
  approvedDate?: string;
  rejectionReason?: string;
  documents?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string[];
  assignedBy: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in-progress' | 'overdue' | 'completed' | 'cancelled';
  deadline: string;
  startDate: string;
  completedDate?: string;
  projectId?: string;
  tags: string[];
  attachments?: string[];
  comments?: TaskComment[];
  progress: number;
  estimatedHours?: number;
  actualHours?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  comment: string;
  createdAt: string;
}

export interface Department {
  id: number | string;
  name: string;
  code: string;
  managerId?: string;
  description?: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
  employeeCount?: number;
  budget?: number;
  location?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  onLeave: number;
  pendingTasks: number;
  completedTasks: number;
  pendingLeaveRequests: number;
  upcomingHolidays: number;
  totalDepartments: number;
}

// Chat Types
export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderAvatar?: string;
  content: string;
  messageType: 'text' | 'emoji' | 'file' | 'image';
  timestamp: string;
  isRead: boolean;
  replyTo?: string; // ID of message being replied to
  editedAt?: string;
  deletedAt?: string;
}

export interface Chat {
  id: string;
  name: string;
  type: 'individual' | 'group';
  participants: ChatParticipant[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: ChatMessage;
  unreadCount: number;
  isActive: boolean;
  groupAvatar?: string;
  description?: string;
}

export interface ChatParticipant {
  userId: string;
  userName: string;
  userRole: UserRole;
  department: string;
  joinedAt: string;
  isAdmin?: boolean; // For group chats
  lastSeen?: string;
  isOnline: boolean;
}

export interface CreateChatRequest {
  type: 'individual' | 'group';
  name?: string; // Required for group chats
  description?: string; // Optional for group chats
  participantIds: string[];
}

export interface ChatPermissions {
  canCreateGroups: boolean;
  canChatWith: UserRole[];
  canViewUsers: UserRole[];
}
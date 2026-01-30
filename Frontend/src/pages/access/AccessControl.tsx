import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Shield, 
  Users, 
  Calendar as CalendarIcon,
  Settings,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { formatIST, formatDateIST } from '@/utils/timezone';

interface TaskPermission {
  fromRole: string;
  toRoles: string[];
  enabled: boolean;
}

interface Holiday {
  id: string;
  date: Date;
  name: string;
  type: 'public' | 'company' | 'optional';
  recurring: boolean;
}

export default function AccessControl() {
  const { user } = useAuth();
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  
  const [taskPermissions, setTaskPermissions] = useState<TaskPermission[]>([
    {
      fromRole: 'admin',
      toRoles: ['hr', 'manager', 'team_lead', 'employee'],
      enabled: true
    },
    {
      fromRole: 'hr',
      toRoles: ['manager', 'team_lead', 'employee'],
      enabled: true
    },
    {
      fromRole: 'manager',
      toRoles: ['team_lead', 'employee'],
      enabled: true
    },
    {
      fromRole: 'team_lead',
      toRoles: ['employee'],
      enabled: true
    },
    {
      fromRole: 'employee',
      toRoles: [],
      enabled: false
    }
  ]);

  const [holidays, setHolidays] = useState<Holiday[]>([
    {
      id: '1',
      date: new Date(2024, 0, 1),
      name: "New Year's Day",
      type: 'public',
      recurring: true
    },
    {
      id: '2',
      date: new Date(2024, 0, 26),
      name: 'Republic Day',
      type: 'public',
      recurring: true
    },
    {
      id: '3',
      date: new Date(2024, 2, 29),
      name: 'Holi',
      type: 'public',
      recurring: false
    },
    {
      id: '4',
      date: new Date(2024, 7, 15),
      name: 'Independence Day',
      type: 'public',
      recurring: true
    },
    {
      id: '5',
      date: new Date(2024, 9, 2),
      name: 'Gandhi Jayanti',
      type: 'public',
      recurring: true
    }
  ]);

  const [newHoliday, setNewHoliday] = useState({
    name: '',
    date: new Date(),
    type: 'public',
    recurring: false
  });

  const [systemSettings, setSystemSettings] = useState({
    allowSelfTaskAssignment: true,
    requireTaskApproval: false,
    autoApproveLeaves: false,
    maxConsecutiveLeaveDays: 15,
    minNoticePeriodDays: 2,
    allowWeekendWork: false,
    enforceWorkingHours: true,
    workingHoursStart: '09:00',
    workingHoursEnd: '18:00'
  });

  const handleTogglePermission = (fromRole: string, toRole: string) => {
    setTaskPermissions(permissions => 
      permissions.map(perm => {
        if (perm.fromRole === fromRole) {
          const isEnabled = perm.toRoles.includes(toRole);
          if (isEnabled) {
            return {
              ...perm,
              toRoles: perm.toRoles.filter(r => r !== toRole)
            };
          } else {
            return {
              ...perm,
              toRoles: [...perm.toRoles, toRole]
            };
          }
        }
        return perm;
      })
    );
    
    toast({
      title: 'Success',
      description: 'Task permissions updated successfully'
    });
  };

  const handleAddHoliday = () => {
    if (!newHoliday.name) {
      toast({
        title: 'Error',
        description: 'Please enter a holiday name',
        variant: 'destructive'
      });
      return;
    }

    const holiday: Holiday = {
      id: Date.now().toString(),
      date: newHoliday.date,
      name: newHoliday.name,
      type: newHoliday.type as Holiday['type'],
      recurring: newHoliday.recurring
    };

    setHolidays([...holidays, holiday]);
    setNewHoliday({
      name: '',
      date: new Date(),
      type: 'public',
      recurring: false
    });
    
    toast({
      title: 'Success',
      description: 'Holiday added successfully'
    });
  };

  const handleDeleteHoliday = (id: string) => {
    setHolidays(holidays.filter(h => h.id !== id));
    toast({
      title: 'Success',
      description: 'Holiday removed successfully'
    });
  };

  const handleUpdateSystemSetting = (key: string, value: any) => {
    setSystemSettings({
      ...systemSettings,
      [key]: value
    });
    
    toast({
      title: 'Success',
      description: 'System settings updated'
    });
  };

  const roles = ['admin', 'hr', 'manager', 'team_lead', 'employee'];
  
  const getHolidayTypeColor = (type: string) => {
    switch (type) {
      case 'public': return 'bg-red-100 text-red-800';
      case 'company': return 'bg-blue-100 text-blue-800';
      case 'optional': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Only Admin can access this module
  if (user?.role !== 'admin') {
    return (
      <div className="w-full">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Access Restricted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Only Administrators can access the Access Control module.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Access Control</h1>
      </div>

      <Tabs defaultValue="permissions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="permissions">Task Permissions</TabsTrigger>
          <TabsTrigger value="holidays">Holiday Calendar</TabsTrigger>
          <TabsTrigger value="settings">System Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>Task Assignment Permissions</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure who can assign tasks to whom in the organization
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {taskPermissions.map((permission) => (
                  <div key={permission.fromRole} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        <span className="font-semibold capitalize">
                          {permission.fromRole.replace('_', ' ')}
                        </span>
                      </div>
                      <Badge variant={permission.enabled ? 'default' : 'secondary'}>
                        {permission.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Can assign tasks to:</Label>
                      <div className="flex flex-wrap gap-2">
                        {roles
                          .filter(role => role !== permission.fromRole)
                          .map((role) => {
                            const isEnabled = permission.toRoles.includes(role);
                            return (
                              <Button
                                key={role}
                                variant={isEnabled ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleTogglePermission(permission.fromRole, role)}
                                className="capitalize"
                              >
                                {isEnabled ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                                {role.replace('_', ' ')}
                              </Button>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holidays">
          <Card>
            <CardHeader>
              <CardTitle>Holiday Calendar Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage company holidays and leave calendar
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-4">Add New Holiday</h3>
                  <div className="space-y-4">
                    <div>
                      <Label>Holiday Name</Label>
                      <Input
                        value={newHoliday.name}
                        onChange={(e) => setNewHoliday({...newHoliday, name: e.target.value})}
                        placeholder="Enter holiday name"
                      />
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={format(newHoliday.date, 'yyyy-MM-dd')}
                        onChange={(e) => setNewHoliday({...newHoliday, date: new Date(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <div className="flex gap-2 mt-2">
                        {['public', 'company', 'optional'].map((type) => (
                          <Button
                            key={type}
                            variant={newHoliday.type === type ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setNewHoliday({...newHoliday, type})}
                            className="capitalize"
                          >
                            {type}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={newHoliday.recurring}
                        onCheckedChange={(checked) => setNewHoliday({...newHoliday, recurring: checked})}
                      />
                      <Label>Recurring annually</Label>
                    </div>
                    <Button onClick={handleAddHoliday} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Holiday
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-4">Holiday List</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {holidays
                      .sort((a, b) => a.date.getTime() - b.date.getTime())
                      .map((holiday) => (
                        <div key={holiday.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4" />
                              <span className="font-medium">{holiday.name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-muted-foreground">
                                {format(holiday.date, 'MMM dd, yyyy')}
                              </span>
                              <Badge className={getHolidayTypeColor(holiday.type)} variant="secondary">
                                {holiday.type}
                              </Badge>
                              {holiday.recurring && (
                                <Badge variant="outline">Recurring</Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteHoliday(holiday.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure system-wide settings and policies
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Task Settings</h3>
                    <div className="flex items-center justify-between">
                      <Label>Allow Self Task Assignment</Label>
                      <Switch
                        checked={systemSettings.allowSelfTaskAssignment}
                        onCheckedChange={(checked) => handleUpdateSystemSetting('allowSelfTaskAssignment', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Require Task Approval</Label>
                      <Switch
                        checked={systemSettings.requireTaskApproval}
                        onCheckedChange={(checked) => handleUpdateSystemSetting('requireTaskApproval', checked)}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold">Leave Settings</h3>
                    <div className="flex items-center justify-between">
                      <Label>Auto-approve Leaves</Label>
                      <Switch
                        checked={systemSettings.autoApproveLeaves}
                        onCheckedChange={(checked) => handleUpdateSystemSetting('autoApproveLeaves', checked)}
                      />
                    </div>
                    <div>
                      <Label>Max Consecutive Leave Days</Label>
                      <Input
                        type="number"
                        value={systemSettings.maxConsecutiveLeaveDays}
                        onChange={(e) => handleUpdateSystemSetting('maxConsecutiveLeaveDays', parseInt(e.target.value))}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Minimum Notice Period (Days)</Label>
                      <Input
                        type="number"
                        value={systemSettings.minNoticePeriodDays}
                        onChange={(e) => handleUpdateSystemSetting('minNoticePeriodDays', parseInt(e.target.value))}
                        className="mt-2"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Working Hours</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <Label>Allow Weekend Work</Label>
                      <Switch
                        checked={systemSettings.allowWeekendWork}
                        onCheckedChange={(checked) => handleUpdateSystemSetting('allowWeekendWork', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Enforce Working Hours</Label>
                      <Switch
                        checked={systemSettings.enforceWorkingHours}
                        onCheckedChange={(checked) => handleUpdateSystemSetting('enforceWorkingHours', checked)}
                      />
                    </div>
                  </div>
                  {systemSettings.enforceWorkingHours && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={systemSettings.workingHoursStart}
                          onChange={(e) => handleUpdateSystemSetting('workingHoursStart', e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={systemSettings.workingHoursEnd}
                          onChange={(e) => handleUpdateSystemSetting('workingHoursEnd', e.target.value)}
                          className="mt-2"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme, ColorTheme } from '@/contexts/ThemeContext';
import { apiService } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Building,
  MapPin,
  Calendar,
  Camera,
  Shield,
  Target,
  Plus,
  KeyRound,
  RotateCcw,
} from 'lucide-react';
import { formatDateIST } from '@/utils/timezone';

const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { colorTheme, setColorTheme } = useTheme();
  const navigate = useNavigate();
  const [editedUser, setEditedUser] = useState(user);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newPin, setNewPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [changePinOpen, setChangePinOpen] = useState(false);
  const [changePinForm, setChangePinForm] = useState({ current_pin: '', new_pin: '', confirm_pin: '' });
  const [isChangingPin, setIsChangingPin] = useState(false);


  // Fetch employee data from database
  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!user?.email) return;

      try {
        setIsLoading(true);

        let currentEmployee = null;

        // If user is admin or HR, they can fetch all or specific. 
        // But for regular employees, apiService.getEmployees() will 403.
        // Better to always try fetching the specific employee record by ID first.
        try {
          currentEmployee = await apiService.getEmployeeById(user.id);
        } catch (err) {
          console.warn('Failed to fetch specific employee data, trying fallback:', err);
          // Fallback only for privileged roles
          if (['admin', 'hr', 'manager', 'team_lead'].includes(user.role)) {
            const employees = await apiService.getEmployees().catch(() => []);
            currentEmployee = employees.find((emp: any) =>
              emp.email === user.email || String(emp.employee_id) === String(user.id) || String(emp.id) === String(user.id)
            );
          }
        }

        if (currentEmployee) {
          setEmployeeData(currentEmployee);
          // Update editedUser with database data
          const joiningDateRaw = currentEmployee.joining_date || currentEmployee.created_at || user.joiningDate;
          const formattedJoiningDate = joiningDateRaw ? new Date(joiningDateRaw).toISOString().split('T')[0] : '';

          setEditedUser({
            ...user,
            id: currentEmployee.employee_id || currentEmployee.id || user.id,
            phone: currentEmployee.phone || user.phone,
            address: currentEmployee.address || user.address,
            department: currentEmployee.department || user.department,
            designation: currentEmployee.designation || user.designation,
            joiningDate: formattedJoiningDate,
            profilePhoto: currentEmployee.photo_url || user.profilePhoto,
          });
        }
      } catch (error) {
        console.error('Failed to fetch employee data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load employee data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployeeData();
  }, [user?.email, user?.id]);



  if (!user || !editedUser) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageData = reader.result as string;
        setSelectedImage(imageData);
        updateUser({ ...editedUser, profilePhoto: imageData });
        toast({
          title: 'Profile Photo Updated',
          description: 'Your profile photo has been saved.',
        });
      };
      reader.readAsDataURL(file);
    }
  };


  const handleSavePin = async () => {
    if (newPin.length !== 4) {
      toast({
        title: 'Invalid PIN',
        description: 'PIN must be 4 digits',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingPin(true);
    try {
      await apiService.request('/auth/set-pin', {
        method: 'POST',
        body: JSON.stringify({
          pin: newPin,
          confirm_pin: newPin
        })
      });

      toast({
        title: 'Success',
        description: 'Security PIN updated successfully',
        variant: 'success',
      });
      setNewPin('');
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update PIN',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changePinForm.new_pin !== changePinForm.confirm_pin) {
      toast({ title: 'Error', description: 'New PINs do not match', variant: 'destructive' });
      return;
    }
    if (changePinForm.new_pin.length !== 4) {
      toast({ title: 'Error', description: 'PIN must be exactly 4 digits', variant: 'destructive' });
      return;
    }
    setIsChangingPin(true);
    try {
      await apiService.changePin(changePinForm);
      toast({ title: 'Success', description: 'PIN changed successfully', variant: 'success' });
      setChangePinOpen(false);
      setChangePinForm({ current_pin: '', new_pin: '', confirm_pin: '' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to change PIN', variant: 'destructive' });
    } finally {
      setIsChangingPin(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      hr: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      manager: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      team_lead: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      employee: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    };
    return colors[role as keyof typeof colors] || colors.employee;
  };



  const canCreateTask = ['admin', 'hr', 'manager', 'team_lead', 'employee'].includes(user.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      <div className="w-full space-y-6">
        {/* Header Card */}
        <Card className="overflow-hidden border-2 border-[#000000] shadow-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <div className="relative h-32 bg-gradient-to-r from-primary via-primary/80 to-primary/60">
            <div className="absolute inset-0 bg-grid-white/10" />
          </div>
          <CardContent className="relative -mt-16 pb-6">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
              <div className="relative">
                <Avatar className="h-32 w-32 ring-4 ring-background shadow-xl">
                  <AvatarImage src={selectedImage || user.profilePhoto} alt={user.name} />
                  <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute bottom-0 right-0 p-2 bg-primary rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-lg">
                  <Camera className="h-5 w-5 text-primary-foreground" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex-1 text-center md:text-left space-y-2">
                <div className="flex flex-col md:flex-row items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{user.name}</h1>
                  <Badge className={`${getRoleBadgeColor(user.role)} px-3 py-1`}>
                    <Shield className="h-3 w-3 mr-1" />
                    {t.roles[user.role]}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{user.designation}</p>
                <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building className="h-4 w-4" />
                    {user.department}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {user.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Joined {formatDateIST(user.joiningDate, 'MMM dd, yyyy')}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                {canCreateTask && (
                  <Button
                    onClick={() => navigate(`/${user.role}/tasks`, { state: { createFor: user.id } })}
                    className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create Task
                  </Button>
                )}

              </div>
            </div>
          </CardContent>
        </Card>



        {/* Main Content */}
        <Tabs defaultValue="personal" className="space-y-4">
          <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-2 bg-card">
            <TabsTrigger value="personal">Personal Info</TabsTrigger>
            <TabsTrigger value="professional">Professional</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4">
            <Card className="border-2 border-[#000000] shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Manage your personal details and contact information
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={editedUser.name}
                    disabled
                    className="disabled:opacity-60"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editedUser.email}
                    disabled
                    className="disabled:opacity-60"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={editedUser.phone || ''}
                    disabled
                    placeholder="+91 98765 43210"
                    className="disabled:opacity-60"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={editedUser.address || ''}
                    disabled
                    placeholder="Enter your address"
                    className="disabled:opacity-60"
                  />
                </div>
                <div className="md:col-span-2 space-y-3">
                  <Label>Security PIN</Label>
                  <div className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-200 hover:border-primary/40 bg-slate-50 dark:bg-slate-900/50 transition-colors max-w-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow">
                        <KeyRound className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Change PIN</p>
                        <p className="text-[11px] text-muted-foreground">Update your current PIN</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setChangePinOpen(true)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3"
                    >
                      Change
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="professional" className="space-y-4">
            <Card className="border-2 border-[#000000] shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Professional Information
                </CardTitle>
                <CardDescription>
                  Your role and department details
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="employeeId">Employee ID</Label>
                  <Input
                    id="employeeId"
                    value={editedUser.id || employeeData?.employee_id || user.id}
                    disabled
                    className="disabled:opacity-60"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={editedUser.department}
                    disabled
                    className="disabled:opacity-60"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="designation">Designation</Label>
                  <Input
                    id="designation"
                    value={editedUser.designation}
                    disabled
                    className="disabled:opacity-60"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="joiningDate">Joining Date</Label>
                  <Input
                    id="joiningDate"
                    type="date"
                    value={editedUser.joiningDate}
                    disabled
                    className="disabled:opacity-60"
                  />
                </div>

              </CardContent>
            </Card>

            <Card className="border-2 border-[#000000] shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  About Me
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Textarea
                  placeholder="Tell us about yourself, your skills, and experience..."
                  className="min-h-[120px] disabled:opacity-60"
                  disabled
                />
              </CardContent>
            </Card>
          </TabsContent>


        </Tabs>

        {/* Change PIN Dialog */}
        <Dialog open={changePinOpen} onOpenChange={setChangePinOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-emerald-500" />
                Change Security PIN
              </DialogTitle>
              <DialogDescription>
                Enter your current PIN and choose a new 4-digit security code.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleChangePin} className="space-y-5 py-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cp_current">Current PIN</Label>
                  <Input
                    id="cp_current"
                    type="password"
                    placeholder="••••"
                    maxLength={4}
                    value={changePinForm.current_pin}
                    onChange={(e) => setChangePinForm({ ...changePinForm, current_pin: e.target.value.replace(/\D/g, '') })}
                    required
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="cp_new">New PIN</Label>
                  <Input
                    id="cp_new"
                    type="password"
                    placeholder="••••"
                    maxLength={4}
                    value={changePinForm.new_pin}
                    onChange={(e) => setChangePinForm({ ...changePinForm, new_pin: e.target.value.replace(/\D/g, '') })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cp_confirm">Confirm New PIN</Label>
                  <Input
                    id="cp_confirm"
                    type="password"
                    placeholder="••••"
                    maxLength={4}
                    value={changePinForm.confirm_pin}
                    onChange={(e) => setChangePinForm({ ...changePinForm, confirm_pin: e.target.value.replace(/\D/g, '') })}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setChangePinOpen(false)} disabled={isChangingPin}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={isChangingPin || changePinForm.new_pin.length !== 4 || changePinForm.confirm_pin.length !== 4}
                >
                  {isChangingPin ? (
                    <><div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin mr-2" />Saving...</>
                  ) : 'Save PIN'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Profile;

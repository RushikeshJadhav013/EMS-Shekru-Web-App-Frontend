import { useState, useEffect } from 'react';
import { useTheme, ColorTheme, ThemeMode } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Globe, Palette, Bell, Lock, Check, Sparkles, Sun, Moon, Monitor, Shield } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";

export default function SettingsPage() {
  const { colorTheme, setColorTheme, themeMode, setThemeMode } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const { toast } = useToast();

  // Notification settings state
  const [emailNotifications, setEmailNotifications] = useState(() => {
    const saved = localStorage.getItem('emailNotifications');
    return saved ? JSON.parse(saved) : true;
  });

  const [pushNotifications, setPushNotifications] = useState(() => {
    const saved = localStorage.getItem('pushNotifications');
    return saved ? JSON.parse(saved) : true;
  });

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(() => {
    const saved = localStorage.getItem('twoFactorAuth');
    return saved ? JSON.parse(saved) : false;
  });

  // Save notification settings
  useEffect(() => {
    localStorage.setItem('emailNotifications', JSON.stringify(emailNotifications));
  }, [emailNotifications]);

  useEffect(() => {
    localStorage.setItem('pushNotifications', JSON.stringify(pushNotifications));
  }, [pushNotifications]);

  useEffect(() => {
    localStorage.setItem('twoFactorAuth', JSON.stringify(twoFactorEnabled));
  }, [twoFactorEnabled]);

  // Handle notification toggle
  const handleEmailNotificationToggle = (checked: boolean) => {
    setEmailNotifications(checked);
    toast({
      title: checked ? 'Email Notifications Enabled' : 'Email Notifications Disabled',
      description: checked
        ? 'You will receive email notifications for important updates'
        : 'You will not receive email notifications',
    });
  };

  const handlePushNotificationToggle = (checked: boolean) => {
    setPushNotifications(checked);
    toast({
      title: checked ? 'Push Notifications Enabled' : 'Push Notifications Disabled',
      description: checked
        ? 'You will receive push notifications on this device'
        : 'You will not receive push notifications',
    });
  };

  // Handle 2FA toggle
  const handleTwoFactorToggle = (checked: boolean) => {
    setTwoFactorEnabled(checked);
    toast({
      title: checked ? 'Two-Factor Authentication Enabled' : 'Two-Factor Authentication Disabled',
      description: checked
        ? 'Your account now has an extra layer of security'
        : 'Two-factor authentication has been disabled',
      variant: checked ? 'default' : 'destructive',
    });
  };

  const languages = [
    { value: "en", label: "English" },
    { value: "hi", label: "हिंदी" },
    { value: "mr", label: "मराठी" },
  ];

  const themeModes = [
    { value: "light", label: "Light", icon: Sun, description: "Light theme for bright environments" },
    { value: "dark", label: "Dark", icon: Moon, description: "Dark theme for low-light environments" },
    { value: "system", label: "System", icon: Monitor, description: "Automatically match your system preference" },
  ];

  const colorThemes = [
    { name: 'default', label: 'Blue', color: 'from-blue-500 to-indigo-600', preview: 'bg-blue-500' },
    { name: 'purple', label: 'Purple', color: 'from-purple-500 to-pink-600', preview: 'bg-purple-500' },
    { name: 'green', label: 'Green', color: 'from-green-500 to-emerald-600', preview: 'bg-green-500' },
    { name: 'orange', label: 'Orange', color: 'from-orange-500 to-amber-600', preview: 'bg-orange-500' },
    { name: 'pink', label: 'Pink', color: 'from-pink-500 to-rose-600', preview: 'bg-pink-500' },
    { name: 'cyan', label: 'Cyan', color: 'from-cyan-500 to-blue-600', preview: 'bg-cyan-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      <div className="w-full space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Settings</h1>
              <p className="text-muted-foreground">
                Customize your workspace and preferences
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Theme Mode Section (Light/Dark) */}
          <Card className="border-0 shadow-xl overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-slate-500 via-gray-500 to-zinc-500"></div>
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Sun className="h-6 w-6 text-primary" />
                Display Mode
              </CardTitle>
              <CardDescription className="text-base">
                Choose between light, dark, or system theme for the entire dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {themeModes.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.value}
                      onClick={() => {
                        setThemeMode(mode.value as ThemeMode);
                        toast({
                          title: 'Theme Mode Updated',
                          description: `${mode.label} mode applied successfully!`,
                        });
                      }}
                      className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg ${themeMode === mode.value
                          ? 'border-primary shadow-xl ring-2 ring-primary/20 bg-primary/5'
                          : 'border-gray-200 dark:border-gray-700 hover:border-primary/50 bg-card'
                        }`}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-all ${themeMode === mode.value
                            ? 'bg-gradient-to-br from-primary to-primary/60 text-white'
                            : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                          }`}>
                          <Icon className="h-8 w-8" />
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-base mb-1">{mode.label}</p>
                          <p className="text-xs text-muted-foreground">{mode.description}</p>
                        </div>
                      </div>
                      {themeMode === mode.value && (
                        <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg ring-2 ring-background">
                          <Check className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Color Theme Section */}
          <Card className="border-0 shadow-xl overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Palette className="h-6 w-6 text-primary" />
                Color Theme
              </CardTitle>
              <CardDescription className="text-base">
                Choose your favorite color scheme to personalize your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {colorThemes.map((themeOption) => (
                  <button
                    key={themeOption.name}
                    onClick={() => {
                      setColorTheme(themeOption.name as ColorTheme);
                      toast({
                        title: 'Theme Updated',
                        description: `${themeOption.label} theme applied successfully!`,
                      });
                    }}
                    className={`group relative p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg ${colorTheme === themeOption.name
                        ? 'border-primary shadow-xl ring-2 ring-primary/20'
                        : 'border-gray-200 dark:border-gray-800 hover:border-primary/50'
                      }`}
                  >
                    <div className={`h-16 w-full rounded-xl bg-gradient-to-r ${themeOption.color} shadow-md group-hover:shadow-lg transition-shadow`}></div>
                    <p className="text-sm font-semibold mt-3 text-center">{themeOption.label}</p>
                    {colorTheme === themeOption.name && (
                      <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg ring-2 ring-background">
                        <Check className="h-5 w-5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Language Settings */}
          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Globe className="h-6 w-6 text-primary" />
                Language Preferences
              </CardTitle>
              <CardDescription className="text-base">
                Choose your preferred language for the application
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <div className="space-y-1">
                  <Label htmlFor="language" className="text-base font-semibold">Language</Label>
                  <p className="text-sm text-muted-foreground">
                    Select your preferred language for the interface
                  </p>
                </div>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-[180px] border-2">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          {lang.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Bell className="h-6 w-6 text-primary" />
                Notifications
              </CardTitle>
              <CardDescription className="text-base">
                Manage how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <div className="space-y-1">
                  <Label htmlFor="email-notifications" className="text-base font-semibold">
                    Email Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications for important updates
                  </p>
                  <p className="text-xs text-primary mt-1">
                    Status: {emailNotifications ? 'Enabled ✓' : 'Disabled ✗'}
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={handleEmailNotificationToggle}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <div className="space-y-1">
                  <Label htmlFor="push-notifications" className="text-base font-semibold">
                    Push Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Enable push notifications on this device
                  </p>
                  <p className="text-xs text-primary mt-1">
                    Status: {pushNotifications ? 'Enabled ✓' : 'Disabled ✗'}
                  </p>
                </div>
                <Switch
                  id="push-notifications"
                  checked={pushNotifications}
                  onCheckedChange={handlePushNotificationToggle}
                />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Lock className="h-6 w-6 text-primary" />
                Security
              </CardTitle>
              <CardDescription className="text-base">
                Manage your security and privacy settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <Label htmlFor="2fa" className="text-base font-semibold">
                      Two-Factor Authentication
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`h-2 w-2 rounded-full ${twoFactorEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                      }`}></div>
                    <p className={`text-xs font-semibold ${twoFactorEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500'
                      }`}>
                      {twoFactorEnabled ? 'Active & Protected' : 'Not Active'}
                    </p>
                  </div>
                </div>
                <Switch
                  id="2fa"
                  checked={twoFactorEnabled}
                  onCheckedChange={handleTwoFactorToggle}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                <div className="space-y-1">
                  <p className="text-base font-semibold">Password</p>
                  <p className="text-sm text-muted-foreground">
                    Update your password regularly for better security
                  </p>
                </div>
                <Button variant="outline" className="font-semibold">
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

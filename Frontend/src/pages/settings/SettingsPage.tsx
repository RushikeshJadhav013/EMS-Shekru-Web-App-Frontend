import { useState, useEffect } from 'react';
import { useTheme, ColorTheme, ThemeMode } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Globe, Palette, Bell, Lock, Check, Sparkles, Sun, Moon, Monitor, Shield, RotateCcw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiService } from '@/lib/api';

export default function SettingsPage() {
  const { colorTheme, setColorTheme, themeMode, setThemeMode, resetToDefault } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const { toast } = useToast();

  const handleResetToDefault = () => {
    resetToDefault();
    toast({
      title: 'Default Theme Applied',
      description: 'All custom themes deselected. Staffly default theme restored successfully!',
    });
  };

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

  // Change PIN state
  const [changePinDialogOpen, setChangePinDialogOpen] = useState(false);
  const [pinForm, setPinForm] = useState({
    current_pin: '',
    new_pin: '',
    confirm_pin: ''
  });
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);

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

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pinForm.new_pin !== pinForm.confirm_pin) {
      toast({
        title: "Error",
        description: "New PINs do not match",
        variant: "destructive"
      });
      return;
    }

    if (pinForm.new_pin.length !== 4) {
      toast({
        title: "Error",
        description: "PIN must be 4 digits",
        variant: "destructive"
      });
      return;
    }

    setIsSubmittingPin(true);
    try {
      await apiService.changePin(pinForm);
      toast({
        title: "Success",
        description: "Security PIN changed successfully",
        variant: "success"
      });
      setChangePinDialogOpen(false);
      setPinForm({ current_pin: '', new_pin: '', confirm_pin: '' });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to change PIN",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingPin(false);
    }
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

  const [selectedCategory, setSelectedCategory] = useState<'all' | 'it' | 'sales' | 'general'>('all');

  interface ThemeOption {
    id: ColorTheme;
    name: string;
    category: 'it' | 'sales' | 'general';
    categoryLabel: string;
    tagline: string;
    bestFor: string;
    primaryColor: string;
    accentColor: string;
    bgPreview: string;
    sidebarPreview: string;
    cardPreview: string;
    palette: string[];
  }

  const allThemes: ThemeOption[] = [
    // IT Professional Themes (4)
    {
      id: 'tech-blue',
      name: 'Tech Blue (Staffly Default)',
      category: 'it',
      categoryLabel: 'Default',
      tagline: 'Standard high-tech blue & clean SaaS workspace',
      bestFor: 'Software Developers, IT Companies & SaaS Teams',
      primaryColor: '#2563eb',
      accentColor: '#0ea5e9',
      bgPreview: 'bg-slate-100',
      sidebarPreview: 'bg-slate-900',
      cardPreview: 'bg-white',
      palette: ['#2563eb', '#0ea5e9', '#ffffff', '#0f172a'],
    },
    {
      id: 'cyber-dark',
      name: 'Cyber Dark',
      category: 'it',
      categoryLabel: 'IT Professional',
      tagline: 'Deep obsidian dark with neon cyan highlights',
      bestFor: 'Cybersecurity, Cloud Infra & DevOps',
      primaryColor: '#00f0ff',
      accentColor: '#3b82f6',
      bgPreview: 'bg-[#060810]',
      sidebarPreview: 'bg-[#030408]',
      cardPreview: 'bg-[#0d111d]',
      palette: ['#00f0ff', '#3b82f6', '#0d111d', '#060810'],
    },
    {
      id: 'cloud-professional',
      name: 'Cloud Professional',
      category: 'it',
      categoryLabel: 'IT Professional',
      tagline: 'Airy cloud white with sky blue aesthetic',
      bestFor: 'Cloud Architectures, SaaS Products & Tech Ops',
      primaryColor: '#0284c7',
      accentColor: '#38bdf8',
      bgPreview: 'bg-sky-50',
      sidebarPreview: 'bg-sky-100',
      cardPreview: 'bg-white',
      palette: ['#0284c7', '#38bdf8', '#f0f9ff', '#ffffff'],
    },
    {
      id: 'developer-dark',
      name: 'Developer Dark',
      category: 'it',
      categoryLabel: 'IT Professional',
      tagline: 'Code editor charcoal with terminal emerald & purple',
      bestFor: 'Engineers, Architects & Data Scientists',
      primaryColor: '#10b981',
      accentColor: '#8b5cf6',
      bgPreview: 'bg-[#12151c]',
      sidebarPreview: 'bg-[#0c0e14]',
      cardPreview: 'bg-[#1a1e28]',
      palette: ['#10b981', '#8b5cf6', '#1a1e28', '#12151c'],
    },

    // Sales Themes (4)
    {
      id: 'sales-blue',
      name: 'Sales Blue',
      category: 'sales',
      categoryLabel: 'Sales & Revenue',
      tagline: 'High-trust royal blue for pipeline & performance',
      bestFor: 'Sales Leadership, CRM & KPI Tracking',
      primaryColor: '#1d4ed8',
      accentColor: '#60a5fa',
      bgPreview: 'bg-blue-50',
      sidebarPreview: 'bg-blue-950',
      cardPreview: 'bg-white',
      palette: ['#1d4ed8', '#60a5fa', '#ffffff', '#172554'],
    },
    {
      id: 'sales-orange',
      name: 'Sales Orange',
      category: 'sales',
      categoryLabel: 'Sales & Revenue',
      tagline: 'Energetic warm orange with motivating contrast',
      bestFor: 'Inside Sales, SDRs & Fast-paced Outreach',
      primaryColor: '#ea580c',
      accentColor: '#f97316',
      bgPreview: 'bg-orange-50',
      sidebarPreview: 'bg-[#1c130d]',
      cardPreview: 'bg-white',
      palette: ['#ea580c', '#f97316', '#fff7ed', '#ffffff'],
    },
    {
      id: 'revenue-green',
      name: 'Revenue Green',
      category: 'sales',
      categoryLabel: 'Sales & Revenue',
      tagline: 'Prosperity & financial growth focused emerald',
      bestFor: 'Finance, Revenue Ops & Deal Closers',
      primaryColor: '#059669',
      accentColor: '#10b981',
      bgPreview: 'bg-emerald-50',
      sidebarPreview: 'bg-[#062016]',
      cardPreview: 'bg-white',
      palette: ['#059669', '#10b981', '#ecfdf5', '#062016'],
    },
    {
      id: 'executive-sales',
      name: 'Executive Sales',
      category: 'sales',
      categoryLabel: 'Sales & Revenue',
      tagline: 'Premium midnight navy with gold luxury accents',
      bestFor: 'Executives, Directors & Enterprise Accounts',
      primaryColor: '#eab308',
      accentColor: '#f59e0b',
      bgPreview: 'bg-[#0b0f19]',
      sidebarPreview: 'bg-[#070a12]',
      cardPreview: 'bg-[#111827]',
      palette: ['#eab308', '#f59e0b', '#111827', '#0b0f19'],
    },

    // General Professional Themes (7)
    {
      id: 'corporate-blue',
      name: 'Corporate Blue',
      category: 'general',
      categoryLabel: 'General Professional',
      tagline: 'Formal, deep corporate indigo & enterprise slate',
      bestFor: 'Enterprise HR, Operations & Corporate Teams',
      primaryColor: '#1e40af',
      accentColor: '#3b82f6',
      bgPreview: 'bg-slate-50',
      sidebarPreview: 'bg-[#0f172a]',
      cardPreview: 'bg-white',
      palette: ['#1e40af', '#3b82f6', '#ffffff', '#0f172a'],
    },
    {
      id: 'modern-purple',
      name: 'Modern Purple',
      category: 'general',
      categoryLabel: 'General Professional',
      tagline: 'Creative royal violet with smooth modern gradients',
      bestFor: 'Design, Marketing & Creative Agencies',
      primaryColor: '#9333ea',
      accentColor: '#c084fc',
      bgPreview: 'bg-purple-50',
      sidebarPreview: 'bg-[#180a2a]',
      cardPreview: 'bg-white',
      palette: ['#9333ea', '#c084fc', '#faf5ff', '#180a2a'],
    },
    {
      id: 'minimal-white',
      name: 'Minimal White',
      category: 'general',
      categoryLabel: 'General Professional',
      tagline: 'Ultra-clean monochrome Scandinavian minimalism',
      bestFor: 'Distraction-free focus & Clean Management',
      primaryColor: '#334155',
      accentColor: '#64748b',
      bgPreview: 'bg-gray-50',
      sidebarPreview: 'bg-white',
      cardPreview: 'bg-white',
      palette: ['#0f172a', '#64748b', '#f8fafc', '#ffffff'],
    },
    {
      id: 'ocean',
      name: 'Ocean',
      category: 'general',
      categoryLabel: 'General Professional',
      tagline: 'Deep coastal teal & refreshing aquamarine vibe',
      bestFor: 'Consulting, HealthTech & Modern Organizations',
      primaryColor: '#0891b2',
      accentColor: '#06b6d4',
      bgPreview: 'bg-cyan-50',
      sidebarPreview: 'bg-[#08232c]',
      cardPreview: 'bg-white',
      palette: ['#0891b2', '#06b6d4', '#ecfeff', '#08232c'],
    },
    {
      id: 'emerald',
      name: 'Emerald',
      category: 'general',
      categoryLabel: 'General Professional',
      tagline: 'Sophisticated jewel-tone green with luxury appeal',
      bestFor: 'Sustainability, Healthcare & Corporate Services',
      primaryColor: '#047857',
      accentColor: '#10b981',
      bgPreview: 'bg-emerald-50',
      sidebarPreview: 'bg-[#051c14]',
      cardPreview: 'bg-white',
      palette: ['#047857', '#10b981', '#f0fdf4', '#051c14'],
    },
    {
      id: 'sunset',
      name: 'Sunset',
      category: 'general',
      categoryLabel: 'General Professional',
      tagline: 'Warm coral, amber, and rose sunset glow',
      bestFor: 'Hospitality, People Operations & Staff Care',
      primaryColor: '#f43f5e',
      accentColor: '#fb923c',
      bgPreview: 'bg-rose-50',
      sidebarPreview: 'bg-[#220a10]',
      cardPreview: 'bg-white',
      palette: ['#f43f5e', '#fb923c', '#fff1f2', '#220a10'],
    },
    {
      id: 'premium-dark',
      name: 'Premium Dark',
      category: 'general',
      categoryLabel: 'General Professional',
      tagline: 'Pitch black onyx with refined titanium silver sheen',
      bestFor: 'Night work, High-contrast dashboards & Power users',
      primaryColor: '#60a5fa',
      accentColor: '#94a3b8',
      bgPreview: 'bg-[#090b10]',
      sidebarPreview: 'bg-[#05060a]',
      cardPreview: 'bg-[#12151e]',
      palette: ['#60a5fa', '#94a3b8', '#12151e', '#090b10'],
    },
  ];

  const filteredThemes = selectedCategory === 'all'
    ? allThemes
    : allThemes.filter(t => t.category === selectedCategory);

  const categories = [
    { id: 'all', label: 'All Themes', count: allThemes.length },
    { id: 'it', label: 'IT Professional', count: 4 },
    { id: 'sales', label: 'Sales & Revenue', count: 4 },
    { id: 'general', label: 'General Professional', count: 7 },
  ];

  // Active theme normalized name
  const activeThemeId = colorTheme === 'default' ? 'tech-blue' :
    colorTheme === 'purple' ? 'modern-purple' :
      colorTheme === 'green' ? 'revenue-green' :
        colorTheme === 'orange' ? 'sales-orange' :
          colorTheme === 'pink' ? 'sunset' :
            colorTheme === 'cyan' ? 'ocean' : colorTheme;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 pb-12">
      <div className="w-full space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg text-primary-foreground">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Theme & Workspace Settings</h1>
              <p className="text-muted-foreground">
                Personalize your Staffly workspace with 15 modern, dynamic themes and display modes
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-8">
          {/* Display Mode Section (Light/Dark/System) */}
          <Card className="border border-border shadow-lg overflow-hidden bg-card text-card-foreground">
            <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-secondary"></div>
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <Sun className="h-5 w-5 text-primary" />
                Display Mode
              </CardTitle>
              <CardDescription className="text-sm">
                Choose between light, dark, or system preference for the entire application
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {themeModes.map((mode) => {
                  const Icon = mode.icon;
                  const isSelected = themeMode === mode.value;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => {
                        setThemeMode(mode.value as ThemeMode);
                        toast({
                          title: 'Display Mode Updated',
                          description: `${mode.label} mode applied successfully!`,
                        });
                      }}
                      className={`group relative p-5 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-md text-left ${isSelected
                        ? 'border-primary shadow-md ring-2 ring-primary/20 bg-primary/5'
                        : 'border-border hover:border-primary/40 bg-card'
                        }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${isSelected
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                          }`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-base text-foreground mb-1">{mode.label}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{mode.description}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 15 Themes Section */}
          <Card className="border border-border shadow-lg overflow-hidden bg-card text-card-foreground">
            <div className="h-1.5 bg-gradient-to-r from-blue-500 via-emerald-500 to-purple-500"></div>
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <Palette className="h-5 w-5 text-primary" />
                    Color Themes (15 Themes)
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Select a curated theme to transform the Header, Sidebar, Cards, Buttons, and Tables in real-time
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Reset to Default Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetToDefault}
                    className="h-8 gap-1.5 rounded-lg border-primary/40 text-primary hover:bg-primary/10 font-bold text-xs shadow-sm transition-all active:scale-95"
                    title="Deselect custom themes and restore Staffly default theme"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset to Default
                  </Button>

                  {/* Category Filters */}
                  <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id as any)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${selectedCategory === cat.id
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                      >
                        {cat.label} ({cat.count})
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Banner when Custom Theme or Dark Mode is active */}
              {activeThemeId !== 'tech-blue' && (
                <div className="mt-3.5 px-3.5 py-2.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-3 text-xs">
                  <span className="text-foreground font-medium">
                    Custom theme <strong className="text-primary font-bold">{allThemes.find(t => t.id === activeThemeId)?.name || activeThemeId}</strong> is currently active.
                  </span>
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="font-bold text-primary hover:underline flex items-center gap-1 flex-shrink-0"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Deselect & Restore Default
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredThemes.map((themeOption) => {
                  const isSelected = activeThemeId === themeOption.id;
                  return (
                    <div
                      key={themeOption.id}
                      onClick={() => {
                        setColorTheme(themeOption.id);
                        toast({
                          title: 'Theme Applied',
                          description: `${themeOption.name} theme is now active across Staffly!`,
                        });
                      }}
                      className={`group relative flex flex-col p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:shadow-xl ${isSelected
                        ? 'border-primary shadow-xl ring-2 ring-primary/20 bg-primary/[0.03]'
                        : 'border-border hover:border-primary/50 bg-card'
                        }`}
                    >
                      {/* Mini UI Mockup Preview */}
                      <div className="w-full h-28 rounded-xl p-2.5 overflow-hidden border border-border/80 shadow-inner flex flex-col justify-between"
                        style={{
                          background: themeOption.palette[3],
                        }}
                      >
                        {/* Mini Header & Sidebar Layout */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: themeOption.primaryColor }}></div>
                            <span className="text-[10px] font-black tracking-wide" style={{ color: themeOption.palette[0] === '#ffffff' ? '#000' : '#fff' }}>
                              STAFFLY
                            </span>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{
                              backgroundColor: `${themeOption.primaryColor}30`,
                              color: themeOption.primaryColor,
                            }}
                          >
                            {themeOption.categoryLabel}
                          </span>
                        </div>

                        {/* Mini Dashboard Content */}
                        <div className="flex gap-2 items-center">
                          {/* Mini Sidebar */}
                          <div className="w-6 h-12 rounded-lg flex flex-col gap-1 p-1"
                            style={{ backgroundColor: `${themeOption.primaryColor}20` }}
                          >
                            <div className="h-2 w-full rounded" style={{ backgroundColor: themeOption.primaryColor }}></div>
                            <div className="h-1.5 w-full rounded bg-white/20"></div>
                            <div className="h-1.5 w-full rounded bg-white/20"></div>
                          </div>
                          {/* Mini Cards */}
                          <div className="flex-1 grid grid-cols-2 gap-1.5">
                            <div className="h-12 rounded-lg p-1.5 flex flex-col justify-between border"
                              style={{
                                backgroundColor: themeOption.palette[2],
                                borderColor: `${themeOption.primaryColor}40`,
                              }}
                            >
                              <div className="h-1.5 w-8 rounded" style={{ backgroundColor: themeOption.primaryColor }}></div>
                              <div className="h-3 w-3 rounded-full ml-auto" style={{ backgroundColor: themeOption.accentColor }}></div>
                            </div>
                            <div className="h-12 rounded-lg p-1.5 flex flex-col justify-between border"
                              style={{
                                backgroundColor: themeOption.palette[2],
                                borderColor: `${themeOption.primaryColor}40`,
                              }}
                            >
                              <div className="h-1.5 w-6 rounded bg-slate-400"></div>
                              <div className="h-2 w-full rounded" style={{ backgroundColor: themeOption.primaryColor }}></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Theme Details */}
                      <div className="mt-3 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="font-extrabold text-base text-foreground tracking-tight group-hover:text-primary transition-colors">
                              {themeOption.name}
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                              {themeOption.category === 'it' ? 'IT Pro' : themeOption.category === 'sales' ? 'Sales' : 'General'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {themeOption.tagline}
                          </p>
                          <p className="text-[11px] text-muted-foreground/80 mt-1 italic line-clamp-1">
                            Best for: {themeOption.bestFor}
                          </p>
                        </div>

                        {/* Color Palette Dots & Active Check */}
                        <div className="mt-3.5 pt-3 border-t border-border flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {themeOption.palette.map((color, idx) => (
                              <div
                                key={idx}
                                className="h-4 w-4 rounded-full border border-black/10 shadow-sm"
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>

                          <div className="flex items-center gap-1">
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-primary">
                                <Check className="h-3.5 w-3.5" />
                                Active
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                                Apply Theme →
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Selected Checkmark Badge */}
                      {isSelected && (
                        <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg ring-2 ring-background">
                          <Check className="h-4 w-4 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>



          {/* Notifications */}
          <Card className="border border-slate-200 shadow-xl">
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
          <Card className="border border-slate-200 shadow-xl">
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
                  <p className="text-base font-semibold">Security PIN</p>
                  <p className="text-sm text-muted-foreground">
                    Update your 4-digit security PIN for authentication
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="font-semibold border-slate-300 hover:bg-slate-100"
                  onClick={() => setChangePinDialogOpen(true)}
                >
                  Change PIN
                </Button>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                <div className="space-y-1">
                  <p className="text-base font-semibold">Password</p>
                  <p className="text-sm text-muted-foreground">
                    Update your password regularly for better security
                  </p>
                </div>
                <Button variant="outline" className="font-semibold border-slate-300 hover:bg-slate-100">
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Change PIN Dialog */}
      <Dialog open={changePinDialogOpen} onOpenChange={setChangePinDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Security PIN</DialogTitle>
            <DialogDescription>
              Enter your current PIN and choose a new 4-digit security code.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePin} className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current_pin">Current PIN</Label>
                <Input
                  id="current_pin"
                  type="password"
                  placeholder="••••"
                  maxLength={4}
                  value={pinForm.current_pin}
                  onChange={(e) => setPinForm({ ...pinForm, current_pin: e.target.value.replace(/\D/g, '') })}
                  required
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="new_pin">New 4-digit PIN</Label>
                <Input
                  id="new_pin"
                  type="password"
                  placeholder="••••"
                  maxLength={4}
                  value={pinForm.new_pin}
                  onChange={(e) => setPinForm({ ...pinForm, new_pin: e.target.value.replace(/\D/g, '') })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_pin">Confirm New PIN</Label>
                <Input
                  id="confirm_pin"
                  type="password"
                  placeholder="••••"
                  maxLength={4}
                  value={pinForm.confirm_pin}
                  onChange={(e) => setPinForm({ ...pinForm, confirm_pin: e.target.value.replace(/\D/g, '') })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setChangePinDialogOpen(false)}
                disabled={isSubmittingPin}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isSubmittingPin || pinForm.new_pin.length !== 4 || pinForm.confirm_pin.length !== 4}
              >
                {isSubmittingPin ? "Updating..." : "Update PIN"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

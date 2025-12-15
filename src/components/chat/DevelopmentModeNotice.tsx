import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import CHAT_CONFIG from '@/config/chat';

const DevelopmentModeNotice: React.FC = () => {
  const { themeMode } = useTheme();
  
  if (!CHAT_CONFIG.DEVELOPMENT_MODE) {
    return null;
  }

  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <Alert className={cn("mb-4", 
      isDark 
        ? "border-blue-600 bg-blue-900/20" 
        : "border-blue-200 bg-blue-50")}>
      <Info className={cn("h-4 w-4", isDark ? "text-blue-400" : "text-blue-600")} />
      <AlertDescription className={cn(isDark ? "text-blue-300" : "text-blue-800")}>
        <strong>Development Mode:</strong> Chat is using mock data. 
        Real-time messaging will be available once the backend APIs are implemented.
      </AlertDescription>
    </Alert>
  );
};

export default DevelopmentModeNotice;
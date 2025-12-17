import React from 'react';
import { Construction, Sparkles, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface V2OverlayProps {
  message?: string;
  title?: string;
  fallbackPath?: string;
}

export const V2Overlay: React.FC<V2OverlayProps> = ({ 
  message = "Version 2 features are under development. Coming soon.",
  title = "Coming Soon",
  fallbackPath
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="absolute inset-0 z-[30] flex items-center justify-center">
      {/* Blurred backdrop - only covers content area */}
      <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl" />
      
      {/* Prevent all interactions on content */}
      <div className="absolute inset-0 cursor-not-allowed" onClick={(e) => e.stopPropagation()} />
      
      {/* Content card */}
      <div className="relative z-10 mx-4 max-w-lg w-full px-4 sm:px-0">
        <div className="bg-gradient-to-br from-white/98 to-slate-50/98 dark:from-slate-800/98 dark:to-slate-900/98 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] border border-slate-200/50 dark:border-slate-700/50 p-6 sm:p-8 md:p-12">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              {/* Animated background glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl blur-2xl opacity-40 animate-pulse" />
              
              {/* Icon container */}
              <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl">
                <Construction className="h-10 w-10 text-white" strokeWidth={2.5} />
                
                {/* Sparkle accent */}
                <div className="absolute -top-2 -right-2">
                  <Sparkles className="h-6 w-6 text-amber-400 animate-pulse" fill="currentColor" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Title */}
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            {title}
          </h2>
          
          {/* Message */}
          <p className="text-center text-slate-600 dark:text-slate-300 text-lg leading-relaxed mb-6">
            {message}
          </p>
          
          {/* Decorative divider */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="h-1 w-12 bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-full" />
            <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse" />
            <div className="h-1 w-12 bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full" />
          </div>
          
          {/* Additional info */}
          <div className="text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              We're working hard to bring you amazing new features
            </p>
          </div>
          
          {/* Back button */}
          <div className="flex justify-center mt-8" onClick={(e) => e.stopPropagation()}>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Try to go back in history first, if that fails use fallback path
                if (window.history.length > 1) {
                  navigate(-1);
                } else if (fallbackPath) {
                  navigate(fallbackPath);
                } else if (user) {
                  // Default fallback to dashboard
                  navigate(`/${user.role}`);
                }
              }}
              className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 py-2.5 cursor-pointer z-10"
            >
              <div className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                <span className="font-medium">Go Back</span>
              </div>
            </Button>
          </div>
          
          {/* Animated dots */}
          <div className="flex justify-center gap-2 mt-6">
            <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default V2Overlay;

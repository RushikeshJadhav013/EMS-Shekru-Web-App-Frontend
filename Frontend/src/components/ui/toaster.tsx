import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";

export function Toaster() {
  const { toasts } = useToast();

  // Get icon based on variant with enhanced styling
  const getIcon = (variant?: string) => {
    const iconClasses = "h-6 w-6 flex-shrink-0 drop-shadow-sm";
    switch (variant) {
      case "success":
        return (
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 ring-2 ring-emerald-200 dark:ring-emerald-800">
            <CheckCircle2 className={iconClasses} />
          </div>
        );
      case "destructive":
        return (
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/30 ring-2 ring-red-200 dark:ring-red-800">
            <AlertCircle className={iconClasses} />
          </div>
        );
      case "warning":
        return (
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-200 dark:ring-amber-800">
            <AlertTriangle className={iconClasses} />
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-200 dark:ring-blue-800">
            <Info className={iconClasses} />
          </div>
        );
    }
  };

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-4 w-full">
              {/* Icon with background */}
              <div className="mt-0.5">
                {getIcon(variant)}
              </div>
              
              {/* Content */}
              <div className="flex-1 grid gap-1.5 pt-0.5">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            </div>
            {action}
            <ToastClose />
            
            {/* Auto-dismiss progress indicator */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5 dark:bg-white/5 overflow-hidden rounded-b-2xl">
              <div 
                className="h-full bg-current opacity-40"
                style={{
                  animation: 'toast-progress 4s linear forwards',
                }}
              />
            </div>
            <style>{`
              @keyframes toast-progress {
                from { width: 100%; }
                to { width: 0%; }
              }
            `}</style>
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

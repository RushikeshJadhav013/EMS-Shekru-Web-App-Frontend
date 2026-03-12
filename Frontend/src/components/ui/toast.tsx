import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-3 p-6 sm:max-w-[440px]",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start gap-4 overflow-hidden rounded-2xl border p-5 pr-12 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md transition-all duration-500 ease-out data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-top-full hover:shadow-[0_12px_40px_rgb(0,0,0,0.15)] hover:scale-[1.01] hover:-translate-y-0.5",
  {
    variants: {
      variant: {
        default: "border-blue-300/50 bg-gradient-to-br from-blue-50/95 via-indigo-50/95 to-blue-100/95 dark:from-blue-950/95 dark:via-indigo-950/95 dark:to-blue-900/95 dark:border-blue-700/50 text-blue-950 dark:text-blue-50 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400",
        destructive: "border-red-300/50 bg-gradient-to-br from-red-50/95 via-rose-50/95 to-red-100/95 dark:from-red-950/95 dark:via-rose-950/95 dark:to-red-900/95 dark:border-red-700/50 text-red-950 dark:text-red-50 [&>svg]:text-red-600 dark:[&>svg]:text-red-400",
        warning: "border-amber-300/50 bg-gradient-to-br from-amber-50/95 via-yellow-50/95 to-amber-100/95 dark:from-amber-950/95 dark:via-yellow-950/95 dark:to-amber-900/95 dark:border-amber-700/50 text-amber-950 dark:text-amber-50 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400",
        success: "border-emerald-300/50 bg-gradient-to-br from-emerald-50/95 via-green-50/95 to-emerald-100/95 dark:from-emerald-950/95 dark:via-green-950/95 dark:to-emerald-900/95 dark:border-emerald-700/50 text-emerald-950 dark:text-emerald-50 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />;
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors group-[.destructive]:border-muted/40 hover:bg-secondary group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 group-[.destructive]:focus:ring-destructive disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-3 top-3 rounded-lg p-1.5 text-foreground/60 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground group-[.destructive]:text-red-400 group-[.destructive]:hover:text-red-600 group-[.destructive]:hover:bg-red-100/50 dark:group-[.destructive]:hover:bg-red-900/30 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 group-[.destructive]:focus:ring-red-400",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn("text-sm font-bold tracking-tight", className)} {...props} />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn("text-sm opacity-95 leading-relaxed", className)} {...props} />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};

// Add warning variant to the toast function
declare module "@/components/ui/toast" {
  interface ToasterToast extends Omit<React.ComponentProps<typeof Toast>, "title"> {
    id: string;
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactElement<typeof ToastAction>;
    variant?: "default" | "destructive" | "warning" | "success";
  }
}

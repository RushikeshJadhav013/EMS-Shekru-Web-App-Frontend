import React from 'react';
import { X, User, Users, MessageCircle, ArrowRight } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatTypeSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: 'individual' | 'group') => void;
    canCreateGroups: boolean;
}

const ChatTypeSelectorModal: React.FC<ChatTypeSelectorModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    canCreateGroups
}) => {
    const { themeMode } = useTheme();
    const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (!isOpen) return null;

    const options = [
        {
            id: 'individual',
            title: 'Individual Chat',
            description: 'Start a direct conversation with a colleague',
            icon: <User className="h-6 w-6" />,
            color: 'bg-blue-500',
            hoverBg: 'hover:bg-blue-500/5',
            borderColor: 'border-blue-500/20',
            textColor: 'text-blue-500',
            disabled: false
        },
        {
            id: 'group',
            title: 'Group Chat',
            description: 'Collaborate with multiple team members',
            icon: <Users className="h-6 w-6" />,
            color: 'bg-indigo-500',
            hoverBg: 'hover:bg-indigo-500/5',
            borderColor: 'border-indigo-500/20',
            textColor: 'text-indigo-500',
            disabled: !canCreateGroups
        }
    ];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300">
            <div className={cn(
                "rounded-[32px] w-full max-w-lg mx-auto shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border overflow-hidden animate-in zoom-in-95 duration-300",
                isDark ? "bg-[#0f172a] border-slate-800" : "bg-white border-slate-100"
            )}>
                {/* Header */}
                <div className={cn(
                    "flex items-center justify-between p-8 border-b",
                    isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-100 bg-gray-50/50"
                )}>
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-green-500 shadow-lg shadow-green-500/20 rounded-2xl">
                            <MessageCircle className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className={cn("text-2xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>New Chat</h2>
                            <p className={cn("text-sm font-medium", isDark ? "text-slate-400" : "text-slate-500")}>Choose your conversation type</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost" size="icon" onClick={onClose}
                        className="h-11 w-11 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-95"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Options */}
                <div className="p-8 space-y-4">
                    {options.map((option) => (
                        <button
                            key={option.id}
                            disabled={option.disabled}
                            onClick={() => onSelect(option.id as 'individual' | 'group')}
                            className={cn(
                                "w-full flex items-center p-6 rounded-[24px] border transition-all duration-300 group text-left relative overflow-hidden",
                                option.disabled ? "opacity-50 cursor-not-allowed" : cn("cursor-pointer", option.hoverBg, "hover:shadow-xl hover:shadow-black/5 active:scale-[0.98]"),
                                isDark ? "bg-slate-800/40 border-slate-700" : "bg-white border-slate-200"
                            )}
                        >
                            <div className={cn(
                                "p-4 rounded-2xl shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
                                option.color,
                                "text-white shadow-xl shadow-black/10"
                            )}>
                                {option.icon}
                            </div>

                            <div className="ml-5 flex-1 min-w-0">
                                <h3 className={cn(
                                    "text-lg font-bold mb-1 transition-colors",
                                    isDark ? "text-white" : "text-slate-900",
                                    !option.disabled && `group-hover:${option.textColor}`
                                )}>
                                    {option.title}
                                </h3>
                                <p className={cn(
                                    "text-sm font-medium transition-colors",
                                    isDark ? "text-slate-400" : "text-slate-500"
                                )}>
                                    {option.description}
                                </p>
                            </div>

                            {!option.disabled && (
                                <div className={cn(
                                    "p-2 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1",
                                    isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"
                                )}>
                                    <ArrowRight className="h-5 w-5" />
                                </div>
                            )}

                            {option.disabled && (
                                <div className="absolute top-4 right-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Restricted
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Footer info */}
                <div className={cn(
                    "p-6 text-center border-t",
                    isDark ? "border-slate-800 bg-slate-900/30" : "border-slate-50 bg-gray-50/30"
                )}>
                    <p className={cn("text-xs font-semibold", isDark ? "text-slate-500" : "text-slate-400")}>
                        Communication helps teams work better together
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChatTypeSelectorModal;

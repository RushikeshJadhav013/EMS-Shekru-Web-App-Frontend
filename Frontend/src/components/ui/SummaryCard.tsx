import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, ChevronRight } from 'lucide-react';
import { cn } from "@/lib/utils";

interface SummaryCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    iconColor?: string;
    iconBg?: string;
    onClick?: () => void;
    className?: string;
}

const SummaryCard = ({
    title,
    value,
    icon: Icon,
    iconColor = "text-blue-600",
    iconBg = "bg-blue-50",
    onClick,
    className
}: SummaryCardProps) => {
    return (
        <Card className={cn(
            "border-2 border-black shadow-sm overflow-hidden rounded-[1.5rem] transition-all hover:shadow-md",
            className
        )}>
            <CardContent className="p-6">
                <div className="flex justify-between items-start mb-6">
                    <h3 className="text-[11px] font-extrabold tracking-wide text-black/80">
                        {title}
                    </h3>
                    <div className={cn("p-2.5 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", iconBg)}>
                        <Icon className={cn("h-5 w-5", iconColor)} />
                    </div>
                </div>

                <div className="mb-4">
                    <span className="text-[36px] font-bold tracking-tight text-black">
                        {value}
                    </span>
                </div>

                <button
                    onClick={onClick}
                    className="flex items-center gap-1.5 text-[11px] font-black tracking-wide text-black/80 hover:text-black transition-colors"
                >
                    View details
                    <ChevronRight className="h-3 w-3 stroke-[3px]" />
                </button>
            </CardContent>
        </Card>
    );
};

export default SummaryCard;

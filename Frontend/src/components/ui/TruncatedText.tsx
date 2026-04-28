import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface TruncatedTextProps {
    text: string;
    maxLength?: number;
    className?: string;
    textClassName?: string;
    showMoreClassName?: string;
    showToggle?: boolean;
    style?: React.CSSProperties;
}

const TruncatedText: React.FC<TruncatedTextProps> = ({
    text,
    maxLength = 100,
    className,
    textClassName,
    showMoreClassName,
    showToggle = true,
    style
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!text) return null;

    const shouldTruncate = text.length > maxLength;
    const displayedText = shouldTruncate && !isExpanded
        ? text.substring(0, maxLength) + '...'
        : text;

    return (
        <div className={cn("inline", className)}>
            <span className={cn(textClassName, "break-words whitespace-pre-wrap")} style={style}>
                {displayedText}
            </span>
            {showToggle && shouldTruncate && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                    className={cn(
                        "ml-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium inline-block",
                        showMoreClassName
                    )}
                >
                    {isExpanded ? 'Show less' : 'Show more'}
                </button>
            )}
        </div>
    );
};

export default TruncatedText;

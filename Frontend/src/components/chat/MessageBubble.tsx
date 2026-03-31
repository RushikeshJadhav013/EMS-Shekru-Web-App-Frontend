import React, { useState, useCallback } from 'react';
import { Reply, Edit, Trash2, Copy, Check, CheckCheck, Download, FileText, ZoomIn, X, Share2, ExternalLink } from 'lucide-react';
import { ChatMessage } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatTimeIST } from '@/utils/timezone';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  replyMessage?: ChatMessage;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i;
const PDF_EXT   = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)(\?.*)?$/i;

function isImageUrl(text: string) {
  if (text.includes('|data:image/') || text.startsWith('data:image/')) return true;
  if (text.includes('staffly_type=image')) return true;
  try { return IMAGE_EXTS.test(new URL(text).pathname); } 
  catch { return IMAGE_EXTS.test(text.split('?')[0]); } // Fallback for relative paths
}

function isPdfUrl(text: string) {
  if (text.includes('|data:application/') || text.startsWith('data:application/')) return true;
  if (text.includes('staffly_type=file')) return true;
  try { return PDF_EXT.test(new URL(text).pathname); } 
  catch { return PDF_EXT.test(text.split('?')[0]); } // Fallback for relative paths
}

function extractFileParts(text: string) {
  if (text.includes('|data:application/') || text.includes('|data:image/')) {
    const parts = text.split('|');
    return { name: parts[0], url: parts[1] };
  }
  return { name: fileNameFromUrl(text), url: text };
}

function isUrl(text: string) {
  try { new URL(text); return true; } catch { return false; }
}

function fileNameFromUrl(url: string) {
  try {
    const parts = new URL(url).pathname.split('/');
    return decodeURIComponent(parts[parts.length - 1]) || 'file';
  } catch { return 'file'; }
}

// ─── Image Lightbox ───────────────────────────────────────────────────────────

interface LightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

const ImageLightbox: React.FC<LightboxProps> = ({ src, alt, onClose }) => {
  const [scale, setScale] = useState(1);

  const handleDownload = useCallback(async () => {
    try {
      const res  = await fetch(src);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = fileNameFromUrl(src); a.click();
      URL.revokeObjectURL(url);
    } catch { window.open(src, '_blank'); }
  }, [src]);

  const handleCopy = useCallback(async () => {
    try {
      const res  = await fetch(src);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } catch { await navigator.clipboard.writeText(src); }
  }, [src]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try { await navigator.share({ url: src, title: alt || 'Image' }); return; } catch {}
    }
    await navigator.clipboard.writeText(src);
  }, [src, alt]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdrop}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent z-10">
        <span className="text-white/80 text-sm font-medium truncate max-w-[200px]">{fileNameFromUrl(src)}</span>
        <div className="flex items-center gap-2">
          <button
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-90"
            onClick={() => setScale(s => Math.min(s + 0.5, 4))}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-90"
            onClick={handleCopy}
            title="Copy image"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-90"
            onClick={handleShare}
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-90"
            onClick={handleDownload}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-red-500/60 flex items-center justify-center text-white transition-all active:scale-90"
            onClick={onClose}
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Image */}
      <img
        src={src}
        alt={alt || 'Image'}
        draggable={false}
        style={{ transform: `scale(${scale})`, transition: 'transform 0.2s ease', maxHeight: '85vh', maxWidth: '90vw', objectFit: 'contain', borderRadius: 12 }}
        onClick={(e) => { e.stopPropagation(); setScale(s => s === 1 ? 2 : 1); }}
        className="cursor-zoom-in select-none shadow-2xl"
      />

      {/* Bottom hint */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
        <span className="text-white/40 text-xs">Click image to zoom · Click outside to close</span>
      </div>
    </div>
  );
};

// ─── Content renderer ─────────────────────────────────────────────────────────

interface ContentProps {
  content: string;
  isOwn: boolean;
  isDark: boolean;
  onImageClick: (url: string) => void;
  messageType: string;
}

import { API_BASE_URL } from '@/lib/api';

const MessageContent: React.FC<ContentProps> = ({ content, isOwn, isDark, onImageClick, messageType }) => {
  const trimmed = content.trim();
  let { url: finalUrl, name: finalName } = extractFileParts(trimmed);
  
  // If the message is explicitly a media type OR has a known media extension, 
  // and it's a relative path (doesn't start with http/data:), prepend the API base URL.
  // This prevents relative images from 404ing and intentionally triggering the onError fallback link.
  const isMediaByPath = isImageUrl(finalUrl) || isPdfUrl(finalUrl);
  if ((messageType === 'image' || messageType === 'file' || isMediaByPath) && !finalUrl.startsWith('http') && !finalUrl.startsWith('data:') && finalUrl.length > 0) {
    // Prevent accidentally prefixing normal text sentences that happen to not start with http
    // Only prefix if it actually looks like a path (has no spaces)
    if (!finalUrl.includes(' ')) {
      const base = API_BASE_URL.replace(/\/api$/, ''); // typically API is like https://staffly.space/api
      finalUrl = finalUrl.startsWith('/') ? `${base}${finalUrl}` : `${base}/${finalUrl}`;
    }
  }

  // Image message
  if (messageType === 'image' || isImageUrl(finalUrl)) {
    return (
      <div className="relative group/img">
        <img
          src={finalUrl}
          alt="Shared image"
          className="rounded-2xl max-w-[280px] max-h-[320px] w-auto h-auto object-cover cursor-zoom-in hover:brightness-90 transition-all shadow-md"
          onClick={() => onImageClick(finalUrl)}
          onError={(e) => {
            // Safely show a broken state instead of mutating the DOM into a raw text link
            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23e2e8f0"/><text x="50" y="50" font-family="sans-serif" font-size="10" text-anchor="middle" dominant-baseline="middle" fill="%2364748b">Image failed to load</text></svg>';
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none rounded-2xl bg-black/20">
          <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
        </div>
      </div>
    );
  }

  // File/PDF message
  if (messageType === 'file' || isPdfUrl(finalUrl)) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-2xl border min-w-[200px] max-w-[280px]",
        isOwn
          ? "bg-white/10 border-white/20"
          : isDark
            ? "bg-slate-800 border-slate-700"
            : "bg-slate-50 border-slate-200"
      )}>
        <div className={cn(
          "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0",
          isOwn ? "bg-white/20" : "bg-red-100"
        )}>
          <FileText className={cn("h-6 w-6", isOwn ? "text-white" : "text-red-500")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-bold truncate", isOwn ? "text-white" : isDark ? "text-slate-100" : "text-slate-800")}>{finalName}</p>
          <p className={cn("text-[11px] mt-0.5", isOwn ? "text-white/60" : "text-slate-400")}>Document</p>
          <div className="flex gap-2 mt-2">
            <a
              href={finalUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "text-[11px] font-bold flex items-center gap-1 hover:underline",
                isOwn ? "text-white/80" : "text-blue-500"
              )}
            >
              <ExternalLink className="h-3 w-3" /> View
            </a>
            <a
              href={finalUrl}
              download={finalName}
              className={cn(
                "text-[11px] font-bold flex items-center gap-1 hover:underline",
                isOwn ? "text-white/80" : "text-green-600"
              )}
            >
              <Download className="h-3 w-3" /> Save
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Generic URL (not image/pdf) — show as clickable link
  if (isUrl(finalUrl)) {
    return (
      <a
        href={finalUrl}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "text-[14.5px] leading-snug font-medium tracking-tight underline break-all",
          isOwn ? "text-white" : "text-blue-500"
        )}
      >
        {finalUrl}
      </a>
    );
  }

  // Plain text
  return (
    <div className="text-[14.5px] leading-snug font-medium tracking-tight pr-2 break-words whitespace-pre-wrap">
      {content}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  replyMessage,
  onReply,
  onEdit,
  onDelete,
}) => {
  const [showActions, setShowActions]   = useState(false);
  const [lightboxUrl, setLightboxUrl]   = useState<string | null>(null);
  const { user }      = useAuth();
  const { themeMode } = useTheme();

  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setShowActions(false);
  };

  const formatTime = (timestamp: string) => formatTimeIST(timestamp, 'h:mm a') + ' IST';

  const getUserAvatar = () => isOwn ? user?.profilePhoto || '' : message.senderAvatar || '';

  // Detect if this is a media message to suppress Edit action
  const trimmed = message.content.trim();
  const isMediaMsg = message.messageType === 'image' || message.messageType === 'file' || isImageUrl(trimmed) || isPdfUrl(trimmed);

  return (
    <>
      {lightboxUrl && (
        <ImageLightbox
          src={lightboxUrl}
          onClose={() => setLightboxUrl(null)}
        />
      )}

      <div
        className={cn(
          'flex items-end space-x-3 mb-4 group/bubble animate-in fade-in slide-in-from-bottom-2 duration-500',
          isOwn ? 'flex-row-reverse space-x-reverse' : 'flex-row'
        )}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <Avatar className={cn(
          "h-9 w-9 border-2 shadow-lg flex-shrink-0 transition-transform duration-300 group-hover/bubble:scale-110",
          isOwn ? "border-green-500/20" : "border-slate-200 dark:border-slate-800"
        )}>
          <AvatarImage src={getUserAvatar()} />
          <AvatarFallback className={cn(
            "text-white text-[10px] font-black uppercase",
            isOwn ? "bg-green-600" : "bg-gradient-to-br from-indigo-500 to-purple-600"
          )}>
            {message.senderName?.charAt(0).toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>

        <div className={cn('max-w-[80%] flex flex-col', isOwn ? 'items-end' : 'items-start')}>
          {/* Sender label */}
          {!isOwn && (
            <div className="flex items-center gap-2 mb-1.5 ml-1">
              <span className={cn("text-[10px] font-black uppercase tracking-widest", isDark ? "text-emerald-400" : "text-emerald-600")}>
                {message.senderName}
              </span>
              {message.senderRole && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border",
                  message.senderRole === 'admin'     ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                  message.senderRole === 'hr'        ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' :
                  message.senderRole === 'manager'   ? 'bg-violet-500/10 text-violet-500 border-violet-500/20' :
                  message.senderRole === 'team_lead' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                       'bg-slate-500/10 text-slate-500 border-slate-500/20'
                )}>
                  {message.senderRole.replace('_', ' ')}
                </span>
              )}
            </div>
          )}

          <div className="relative group/content">
            {/* Action toolbar */}
            <div className={cn(
              "absolute -top-1 pb-1.5 z-50 transition-all duration-300 pointer-events-none",
              isOwn ? "right-0" : "left-0",
              showActions ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-90"
            )}>
              <div className={cn(
                "flex items-center gap-1.5 p-1.5 rounded-2xl border shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-xl",
                isDark ? "bg-slate-900/95 border-slate-700/50" : "bg-white/95 border-slate-200"
              )}>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 rounded-xl hover:bg-green-500/10 hover:text-green-500 transition-all active:scale-90"
                  onClick={(e) => { e.stopPropagation(); onReply?.(); }}
                  title="Reply"
                >
                  <Reply className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 rounded-xl hover:bg-blue-500/10 hover:text-blue-500 transition-all active:scale-90"
                  onClick={(e) => { e.stopPropagation(); handleCopyMessage(); }}
                  title={isMediaMsg ? "Copy link" : "Copy message"}
                >
                  <Copy className="h-4 w-4" />
                </Button>

                {/* Image-specific actions */}
                {isMediaMsg && (message.messageType === 'image' || isImageUrl(trimmed)) && (
                  <>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 rounded-xl hover:bg-purple-500/10 hover:text-purple-500 transition-all active:scale-90"
                      onClick={(e) => { e.stopPropagation(); setLightboxUrl(trimmed); }}
                      title="View full image"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <a href={trimmed} download target="_blank" rel="noreferrer">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 rounded-xl hover:bg-teal-500/10 hover:text-teal-500 transition-all active:scale-90"
                        title="Download image"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  </>
                )}

                {isOwn && (
                  <>
                    {/* Edit – only for text messages */}
                    {!isMediaMsg && (
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 rounded-xl hover:bg-amber-500/10 hover:text-amber-500 transition-all active:scale-90"
                        onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                        title="Edit message"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition-all active:scale-90"
                      onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Reply context */}
            {replyMessage && (
              <div className={cn(
                'border-l-[3px] px-3 py-1.5 mb-2 rounded-lg text-[11px] transition-all',
                isOwn
                  ? 'bg-black/10 border-white/40'
                  : isDark
                    ? 'bg-[#1a1b1e] border-lime-500/80'
                    : 'bg-slate-100 border-lime-500/80'
              )}>
                <p className={cn("font-bold text-[10px] mb-0.5 leading-tight", isOwn ? "text-white/80" : "text-lime-500")}>
                  @{replyMessage.senderId?.toString() === user?.id?.toString() ? 'You' : replyMessage.senderName}
                </p>
                <p className={cn("line-clamp-1 opacity-90 text-[11px] leading-snug", isOwn ? "text-white/90" : "text-slate-300")}>
                  {replyMessage.messageType === 'image' || isImageUrl(replyMessage.content.trim()) 
                     ? '📷 Photo' 
                     : replyMessage.messageType === 'file' || isPdfUrl(replyMessage.content.trim()) 
                     ? '📄 Document' 
                     : replyMessage.content}
                </p>
              </div>
            )}

            {/* Core bubble */}
            <div className={cn(
              'px-5 py-3.5 relative shadow-xl transition-all duration-300 min-w-[100px]',
              message.messageType === 'emoji'
                ? 'bg-transparent border-0 shadow-none px-2 scale-150 py-6 min-w-0'
                : isMediaMsg
                  ? cn(
                      'rounded-[20px]',
                      isOwn
                        ? 'bg-green-500 text-white rounded-tr-none shadow-green-500/10 p-2'
                        : isDark
                          ? 'bg-[#26272b] border border-slate-700/30 text-slate-100 rounded-tl-none p-2'
                          : 'bg-white border border-slate-100 text-slate-900 rounded-tl-none shadow-slate-200/50 p-2'
                    )
                  : isOwn
                    ? 'bg-green-500 text-white rounded-[24px] rounded-tr-none shadow-green-500/10'
                    : isDark
                      ? 'bg-[#26272b] border border-slate-700/30 text-slate-100 rounded-[24px] rounded-tl-none'
                      : 'bg-white border border-slate-100 text-slate-900 rounded-[24px] rounded-tl-none shadow-slate-200/50'
            )}>
              <div className="break-words">
                {message.messageType === 'emoji' ? (
                  <span className="leading-none select-none">{message.content}</span>
                ) : (
                  <MessageContent
                    content={message.content}
                    isOwn={isOwn}
                    isDark={isDark}
                    messageType={message.messageType}
                    onImageClick={(url) => setLightboxUrl(url)}
                  />
                )}
              </div>

              {/* Timestamp + read receipt — hidden for media (shown below separately) */}
              {!isMediaMsg && (
                <div className={cn("flex items-center gap-1.5 mt-1.5 h-4 justify-end select-none", message.messageType === 'emoji' && "hidden")}>
                  <span className={cn('text-[9px] font-bold tracking-tight opacity-70 uppercase', isOwn ? 'text-white/90' : 'text-slate-400')}>
                    {formatTime(message.timestamp)}
                  </span>
                  {isOwn && (
                    <div className="flex items-center">
                      {message.isRead
                        ? <CheckCheck className="h-3.5 w-3.5 text-white" />
                        : <Check className="h-3.5 w-3.5 text-white/70" />}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Timestamp below for media messages */}
            {isMediaMsg && (
              <div className={cn("flex items-center gap-1.5 mt-1 h-4 select-none", isOwn ? "justify-end" : "justify-start", "px-1")}>
                <span className={cn('text-[9px] font-bold tracking-tight opacity-70 uppercase', isOwn ? 'text-green-600' : 'text-slate-400')}>
                  {formatTime(message.timestamp)}
                </span>
                {isOwn && (
                  <div className="flex items-center">
                    {message.isRead
                      ? <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                      : <Check className="h-3.5 w-3.5 text-slate-400" />}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default MessageBubble;
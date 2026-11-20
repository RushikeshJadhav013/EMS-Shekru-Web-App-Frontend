import React, { useState, useCallback } from 'react';
import { Reply, Edit, Trash2, Copy, Check, CheckCheck, Download, FileText, ZoomIn, X, Share2, ExternalLink } from 'lucide-react';
import { ChatMessage } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatTimeIST } from '@/utils/timezone';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/lib/api';


interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  replyMessage?: ChatMessage;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onImageClick?: (url: string, name?: string) => void;
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i;
const PDF_EXT = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)(\?.*)?$/i;

function isImageUrl(text: string) {
  if (text.includes('|data:image/') || text.startsWith('data:image/')) return true;
  if (text.includes('staffly_type=image')) return true;
  const url = text.split('|')[1] || text;
  try { return IMAGE_EXTS.test(new URL(url).pathname); }
  catch { return IMAGE_EXTS.test(url.split('?')[0]); }
}

function isPdfUrl(text: string) {
  if (text.includes('|data:application/') || text.startsWith('data:application/')) return true;
  if (text.includes('staffly_type=file')) return true;
  const url = text.split('|')[1] || text;
  try { return PDF_EXT.test(new URL(url).pathname); }
  catch { return PDF_EXT.test(url.split('?')[0]); }
}

function extractFileParts(text: string) {
  if (text.includes('|')) {
    const parts = text.split('|');
    // If the second part looks like a URL or base64 data, it's name|url
    if (parts[1].startsWith('http') || parts[1].startsWith('/') || parts[1].startsWith('data:')) {
      return { name: parts[0], url: parts.slice(1).join('|') };
    }
  }
  return { name: fileNameFromUrl(text), url: text };
}

function resolveMediaUrl(content: string, type: string) {
  const trimmed = content.trim();
  let { url, name } = extractFileParts(trimmed);

  // If the message is explicitly a media type OR has a known media extension, 
  // and it's a relative path (doesn't start with http/data:), prepend the API base URL.
  // This prevents relative images from 404ing.
  const isMediaByPath = isImageUrl(url) || isPdfUrl(url);
  if ((type === 'image' || type === 'file' || isMediaByPath) && !url.startsWith('http') && !url.startsWith('data:') && url.length > 0) {
    // Only prefix if it actually looks like a path (has no spaces)
    if (!url.includes(' ')) {
      let base = API_BASE_URL || '';
      // If we have a full URL ending in /api, we remove it to get the domain root.
      if (base.includes('://') && base.endsWith('/api')) {
        base = base.replace(/\/api$/, '');
      }
      url = url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
    }
  }
  return { url, name };
}


// ─── Blob helpers (needed because browsers block data: URLs in new tabs) ───────

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

function openInTab(url: string) {
  if (!url.startsWith('data:')) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  dataUrlToBlob(url)
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
      // revoke after the tab has loaded
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
      if (!win) {
        // popup blocked – fall back to download
        downloadBlob(url, 'file');
      }
    })
    .catch(() => window.open(url, '_blank'));
}

function downloadBlob(url: string, filename: string) {
  if (url.startsWith('data:')) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  fetch(url, { mode: 'cors' })
    .then(res => res.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    })
    .catch(() => {
      // Fallback for CORS restricted or failed fetches
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.download = filename;
      a.click();
    });
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


export const ImageLightbox: React.FC<LightboxProps> = ({ src, alt, onClose }) => {
  const [scale, setScale] = useState(1);

  const { toast } = useToast();

  const handleDownload = useCallback(() => {
    downloadBlob(src, fileNameFromUrl(src));
  }, [src]);

  const handleCopy = useCallback(async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      toast({
        title: "Copied!",
        description: "Image copied to clipboard.",
      });
    } catch (err) {
      // Fallback to copying URL
      try {
        await navigator.clipboard.writeText(src);
        toast({
          title: "Link Copied",
          description: "Could not copy image data, so the link was copied instead.",
        });
      } catch (copyErr) {
        console.error("Copy failed:", copyErr);
      }
    }
  }, [src, toast]);



  const handleShare = useCallback(async () => {
    const filename = alt || fileNameFromUrl(src);
    // Try to share as a file first (better UX on mobile)
    if (navigator.share && navigator.canShare) {
      try {
        const response = await fetch(src);
        const blob = await response.blob();
        const file = new File([blob], filename, { type: blob.type });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: filename,
            text: 'Check out this image from Staffly'
          });
          return;
        }
      } catch (err) {
        console.error("File share failed, falling back to URL:", err);
      }
    }

    // Fallback 1: Share as URL
    if (navigator.share) {
      try {
        await navigator.share({
          url: src,
          title: filename,
        });
        return;
      } catch (err) {
        console.error("URL share failed:", err);
      }
    }


    // Fallback 2: Copy to clipboard
    try {
      await navigator.clipboard.writeText(src);
      toast({
        title: "Link Copied",
        description: "Image link copied to clipboard as sharing is unavailable.",
      });
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  }, [src, alt, toast]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col bg-black/95 backdrop-blur-md animate-in fade-in duration-300"
      onClick={handleBackdrop}
    >
      {/* Top bar - Now a regular flex child to prevent overlapping */}
      <div className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent z-20 shrink-0">
        <span className="text-white/90 text-sm font-semibold truncate max-w-[300px] drop-shadow-sm">{alt || fileNameFromUrl(src)}</span>

        <div className="flex items-center gap-3">
          <button
            className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-all active:scale-90 border border-white/5"
            onClick={() => setScale(s => Math.min(s + 0.5, 4))}
            title="Zoom in"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-all active:scale-90 border border-white/5"
            onClick={handleCopy}
            title="Copy image"
          >
            <Copy className="h-5 w-5" />
          </button>
          <button
            className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-all active:scale-90 border border-white/5"
            onClick={handleShare}
            title="Share"
          >
            <Share2 className="h-5 w-5" />
          </button>
          <button
            className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-all active:scale-90 border border-white/5"
            onClick={handleDownload}
            title="Download"
          >
            <Download className="h-5 w-5" />
          </button>
          <button
            className="h-10 w-10 rounded-full bg-white/10 hover:bg-red-500/80 flex items-center justify-center text-white transition-all active:scale-90 border border-white/5"
            onClick={onClose}
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Container - Centering Image in the remaining viewport space */}
      <div className="flex-1 w-full relative flex items-center justify-center overflow-auto p-4 md:p-8 pointer-events-none">
        <div className="relative flex items-center justify-center min-h-full min-w-full pointer-events-auto">
          <img
            src={src}
            alt={alt || 'Image'}
            draggable={false}
            style={{
              transform: `scale(${scale})`,
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              maxHeight: 'calc(100vh - 120px)',
              maxWidth: '95vw',
              objectFit: 'contain',
              borderRadius: 12
            }}
            onClick={(e) => { e.stopPropagation(); setScale(s => s === 1 ? 2 : 1); }}
            className="cursor-zoom-in select-none shadow-2xl transition-all duration-300"
          />
        </div>
      </div>
    </div>
  );
};

// ─── Content renderer ─────────────────────────────────────────────────────────

interface ContentProps {
  content: string;
  isOwn: boolean;
  isDark: boolean;
  onImageClick: (url: string, name?: string) => void;
  messageType: string;
}


const MessageContent: React.FC<ContentProps> = ({ content, isOwn, isDark, onImageClick, messageType }) => {
  const { url: finalUrl, name: finalName } = resolveMediaUrl(content, messageType);

  // Image message
  if (messageType === 'image' || isImageUrl(finalUrl)) {

    return (
      <div className="relative group/img">
        <img
          src={finalUrl}
          alt={finalName}
          className="rounded-2xl max-w-[280px] max-h-[320px] w-auto h-auto object-cover cursor-zoom-in hover:brightness-90 transition-all shadow-md"
          onClick={() => onImageClick(finalUrl, finalName)}
          onError={(e) => {

            // Safely show a broken state instead of mutating the DOM into a raw text link
            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23e2e8f0"/><text x="50" y="50" font-family="sans-serif" font-size="10" text-anchor="middle" dominant-baseline="middle" fill="%2364748b">Image failed to load</text></svg>';
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none rounded-2xl bg-black/20">
          <ZoomIn className="h-8 w-8 text-black drop-shadow-lg" />
        </div>
      </div>
    );
  }

  // File/PDF message
  if (messageType === 'file' || isPdfUrl(finalUrl)) {
    const ext = finalName.split('.').pop()?.toUpperCase() || 'FILE';
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
          <FileText className={cn("h-6 w-6", isOwn ? "text-black" : "text-red-500")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-xs font-black truncate", isOwn ? "text-black" : isDark ? "text-slate-100" : "text-slate-800")}>{finalName}</p>
          <p className={cn("text-[9px] mt-0.5 uppercase tracking-tighter font-black opacity-50", isOwn ? "text-black" : "text-slate-500")}>Document · {ext}</p>
          <div className="flex gap-4 mt-3">
            <button
              type="button"
              onClick={() => openInTab(finalUrl)}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:scale-105 transition-all active:scale-95 cursor-pointer",
                isOwn ? "text-black/90" : "text-blue-500"
              )}
            >
              <ExternalLink className="h-3.5 w-3.5" /> View
            </button>
            <button
              type="button"
              onClick={() => downloadBlob(finalUrl, finalName)}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:scale-105 transition-all active:scale-95 cursor-pointer",
                isOwn ? "text-black/90" : "text-green-600"
              )}
            >
              <Download className="h-3.5 w-3.5" /> Save
            </button>
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
          "text-[14px] leading-relaxed font-normal underline [overflow-wrap:anywhere] [word-break:break-all] break-all max-w-full inline-block",
          isOwn ? "text-black" : "text-blue-500"
        )}
      >
        {finalUrl}
      </a>
    );
  }

  // Plain text
  return (
    <div
      className={cn(
        "text-[14px] leading-relaxed font-normal [overflow-wrap:anywhere] [word-break:break-word] break-words whitespace-pre-wrap max-w-full",
        isOwn ? (isDark ? "text-slate-100" : "text-slate-900") : (isDark ? "text-slate-100" : "text-slate-900")
      )}
    >
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
  onImageClick,
}) => {
  const [showActions, setShowActions] = useState(false);
  const { user } = useAuth();
  const { themeMode } = useTheme();

  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setShowActions(false);
  };

  const formatTime = (timestamp: string) => formatTimeIST(timestamp, 'h:mm a');

  const getUserAvatar = () => isOwn ? user?.profilePhoto || '' : message.senderAvatar || '';

  // Detect if this is a media message to suppress Edit action
  const trimmed = message.content.trim();
  const isMediaMsg = message.messageType === 'image' || message.messageType === 'file' || isImageUrl(trimmed) || isPdfUrl(trimmed);

  return (
    <>

      <div
        className={cn(
          'w-full min-w-0 flex items-end gap-2 mb-2 group/bubble animate-in fade-in slide-in-from-bottom-2 duration-200',
          isOwn ? 'justify-end' : 'justify-start'
        )}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {!isOwn && (
          <Avatar className="h-8 w-8 border shadow-sm flex-shrink-0 mb-0.5 border-slate-200 dark:border-slate-800">
            <AvatarImage src={getUserAvatar()} />
            <AvatarFallback className="text-white text-[11px] font-bold bg-gradient-to-br from-indigo-500 to-purple-600">
              {message.senderName?.charAt(0).toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
        )}

        <div className={cn('flex flex-col min-w-0 max-w-[85%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-[65%]', isOwn ? 'items-end' : 'items-start')}>
          {/* Sender label */}
          {!isOwn && (
            <div className="flex items-center gap-2 mb-1.5 ml-1">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 truncate max-w-[200px]">
                {message.senderName}
              </span>
              {message.senderRole && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[12px] font-black uppercase tracking-tighter border",
                  message.senderRole === 'admin' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                    message.senderRole === 'hr' ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' :
                      message.senderRole === 'manager' ? 'bg-violet-500/10 text-violet-500 border-violet-500/20' :
                        message.senderRole === 'team_lead' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                          'bg-slate-500/10 text-slate-500 border-slate-500/20'
                )}>
                  {message.senderRole.replace('_', ' ')}
                </span>
              )}
            </div>
          )}

          <div className="relative group/content max-w-full min-w-0">
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
                      onClick={(e) => {
                        e.stopPropagation();
                        const { url, name } = resolveMediaUrl(message.content, message.messageType);
                        onImageClick?.(url, name);
                      }}
                      title="View full image"
                    >

                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 rounded-xl hover:bg-teal-500/10 hover:text-teal-500 transition-all active:scale-90"
                      title="Download image"
                      onClick={(e) => {
                        e.stopPropagation();
                        const { url, name } = resolveMediaUrl(message.content, message.messageType);
                        downloadBlob(url, name);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
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
                'border-l-[3.5px] px-2.5 py-1.5 mb-1.5 rounded-r-lg text-xs transition-all max-w-full min-w-0 overflow-hidden',
                isOwn
                  ? 'bg-black/5 dark:bg-black/20 border-emerald-600 dark:border-emerald-400'
                  : isDark
                    ? 'bg-[#182229] border-emerald-500'
                    : 'bg-slate-100 border-emerald-500'
              )}>
                <p className="font-semibold text-[11px] mb-0.5 truncate text-emerald-700 dark:text-emerald-400">
                  {replyMessage.senderId?.toString() === user?.id?.toString() ? 'You' : replyMessage.senderName}
                </p>
                <p className="line-clamp-1 text-[12px] text-slate-600 dark:text-slate-300 truncate">
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
              'px-3.5 py-2 relative shadow-sm transition-all duration-200 min-w-[80px] max-w-full',
              message.messageType === 'emoji'
                ? 'bg-transparent border-0 shadow-none px-2 scale-150 py-6 min-w-0'
                : isMediaMsg
                  ? cn(
                    'rounded-[22px]',
                    isOwn
                      ? 'bg-[#d9fdd3] dark:bg-[#005c4b] rounded-2xl rounded-tr-xs p-1.5 shadow-sm'
                      : isDark
                        ? 'bg-[#202c33] border border-slate-700/60 text-slate-100 rounded-2xl rounded-tl-xs p-1.5 shadow-sm'
                        : 'bg-white border border-slate-200/80 text-slate-900 rounded-2xl rounded-tl-xs p-1.5 shadow-sm'
                  )
                  : isOwn
                    ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-slate-100 rounded-2xl rounded-tr-xs border border-[#c1f3b7] dark:border-[#005c4b]'
                    : isDark
                      ? 'bg-[#202c33] border border-slate-700/60 text-slate-100 rounded-2xl rounded-tl-xs'
                      : 'bg-white border border-slate-200/80 text-slate-900 rounded-2xl rounded-tl-xs'
            )}>
              <div className="w-full min-w-0 [overflow-wrap:anywhere] [word-break:break-word] break-words">
                {message.messageType === 'emoji' ? (
                  <span className="leading-none select-none">{message.content}</span>
                ) : (
                  <MessageContent
                    content={message.content}
                    isOwn={isOwn}
                    isDark={isDark}
                    messageType={message.messageType}
                    onImageClick={onImageClick}
                  />
                )}
              </div>

              {/* Timestamp + read receipt — hidden for media (shown below separately) */}
              {!isMediaMsg && message.messageType !== 'emoji' && (
                <div className="flex items-center gap-1 mt-1 justify-end select-none">
                  <span className={cn(
                    "text-[11px] font-normal leading-none",
                    isOwn
                      ? (isDark ? "text-emerald-100/70" : "text-slate-500")
                      : "text-slate-400 dark:text-slate-400"
                  )}>
                    {formatTime(message.timestamp)}
                  </span>
                  {isOwn && (
                    <div className="flex items-center leading-none">
                      {message.isRead
                        ? <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                        : <Check className={cn("h-3.5 w-3.5", isDark ? "text-emerald-100/70" : "text-slate-400")} />}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Timestamp below for media messages */}
            {isMediaMsg && (
              <div className={cn("flex items-center gap-1.5 mt-1 h-4 select-none", isOwn ? "justify-end" : "justify-start", "px-1")}>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                  {formatTime(message.timestamp)}
                </span>
                {isOwn && (
                  <div className="flex items-center">
                    {message.isRead
                      ? <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
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
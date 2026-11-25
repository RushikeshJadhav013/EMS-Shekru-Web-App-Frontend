import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Smile,
  Users,
  MessageCircle,
  X,
  Reply,
  MoreVertical,
  Check,
  CheckCheck,
  Edit,
  Trash2 as TrashIcon,
  AlertTriangle,
  Settings,
  UserPlus,
  UserMinus,
  LogOut,
  Info,
  Plus,
  Search,
  Image as ImageIcon,
  Paperclip,
  Loader2
} from 'lucide-react';
import { chatService } from '@/services/chatService';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleBasePath } from '@/utils/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDateIST } from '@/utils/timezone';
import { cn } from '@/lib/utils';

import MessageBubble, { ImageLightbox } from '@/components/chat/MessageBubble';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

const ChatBox: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const {
    activeChat,
    messages,
    isLoading,
    sendMessage,
    sendMessageWithFile,
    setActiveChat,
    chats,
    availableUsers,
    markAsRead,
    sendTyping,
    deleteMessage,
    editMessage,
    updateGroupName,
    deleteGroup,
    addParticipants,
    removeParticipants,
    loadMessages,
    loadAvailableUsers,
    setIsLightboxOpen
  } = useChat();

  const { user } = useAuth();
  const { themeMode } = useTheme();
  const { toast } = useToast();
  const [messageText, setMessageText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [messageToEdit, setMessageToEdit] = useState<any>(null);
  const [editText, setEditText] = useState('');
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedNewUsers, setSelectedNewUsers] = useState<string[]>([]);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [isRemovingMembers, setIsRemovingMembers] = useState(false);
  const [selectedRemoveUsers, setSelectedRemoveUsers] = useState<string[]>([]);
  const [removeSearchTerm, setRemoveSearchTerm] = useState('');
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
  const [isProcessingRemoval, setIsProcessingRemoval] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string | undefined>(undefined);

  const typingPulseRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isScrolledToBottom = useRef(true);

  useEffect(() => {
    setIsLightboxOpen(!!lightboxUrl);
  }, [lightboxUrl, setIsLightboxOpen]);

  // Clean up lightbox state on unmount
  useEffect(() => {
    return () => setIsLightboxOpen(false);
  }, [setIsLightboxOpen]);

  // ── Effects ────────────────────────────────────────────────────────────────
  // Scroll to bottom when messages change if we were already at bottom
  useEffect(() => {
    if (isScrolledToBottom.current) {
      // Use requestAnimationFrame to ensure the DOM has updated and layout is calculated
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      });
    }
  }, [messages]);

  // Force scroll to bottom when switching chats to ensure we start at the newest message
  useEffect(() => {
    if (chatId) {
      isScrolledToBottom.current = true;
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      });
    }
  }, [chatId]);


  useEffect(() => {
    if (chatId) {
      loadAvailableUsers();
      if (!activeChat || activeChat.id !== chatId) {
        const foundChat = chats.find(chat => chat.id?.toString() === chatId?.toString());
        if (foundChat) {
          setActiveChat(foundChat);
        }
      }
    }
  }, [chatId, activeChat, chats, setActiveChat, loadAvailableUsers]);

  // Synchronously compute the chat to display to prevent "Loading..." flickers
  const displayedChat = useMemo(() => {
    if (activeChat?.id === chatId) return activeChat;
    const found = chats.find(c => c.id?.toString() === chatId?.toString());
    return found || activeChat;
  }, [activeChat, chats, chatId]);

  const isCreator = useMemo(() => {
    return displayedChat?.createdBy?.toString() === user?.id?.toString() || user?.role === 'admin';
  }, [displayedChat, user]);

  useEffect(() => {
    if (activeChat && messages.length > 0) {
      const unreadMessageIds = messages
        .filter(m => !m.isRead && m.senderId?.toString() !== user?.id?.toString())
        .map(m => m.id);
      if (unreadMessageIds.length > 0) markAsRead(activeChat.id, unreadMessageIds);
    }
  }, [activeChat, messages, markAsRead, user?.id]);

  // ── All hooks declared above — safe to do conditional render now ────────────

  // Tracks whether user is at the bottom so auto-scroll doesn't hijack manual scrolling
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    isScrolledToBottom.current = Math.abs(scrollHeight - clientHeight - scrollTop) < 60;
  };

  const handleTyping = () => {
    if (!activeChat) return;
    if (typingPulseRef.current) return;
    sendTyping(activeChat.id);
    typingPulseRef.current = setTimeout(() => {
      typingPulseRef.current = null;
    }, 2000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    handleTyping();
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeChat) return;
    try {
      isScrolledToBottom.current = true;
      await sendMessage(messageText, 'text', replyingTo || undefined);
      setMessageText('');
      setReplyingTo(null);
      // Extra insurance to scroll after state update
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    }
  };


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeChat) return;

    // 100 MB limit
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 100MB.",
        variant: "destructive"
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    try {
      isScrolledToBottom.current = true;
      // Use the new dedicated file upload API
      await sendMessageWithFile(file, '', replyingTo || undefined);
      setReplyingTo(null);

      // Extra insurance to scroll after state update
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      toast({
        title: file.type.startsWith('image/') ? '📷 Image sent' : '📄 File sent',
        description: `${file.name} was sent successfully.`,
      });
    } catch (error: any) {
      console.error('Failed to read/send file:', error);
      toast({
        title: "Failed to send",
        description: error.message || "Could not send the file. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerFileSelect = (accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const handleEditClick = (message: any) => {
    // Check if within 2 minutes
    const sentTime = new Date(message.timestamp).getTime();
    const now = new Date().getTime();
    const diffMins = (now - sentTime) / (1000 * 60);

    if (diffMins > 2) {
      toast({
        title: "Edit restricted",
        description: "Messages can only be edited within 2 minutes of sending.",
        variant: "destructive"
      });
      return;
    }

    setMessageToEdit(message);
    setEditText(message.content);
    setIsEditDialogOpen(true);
  };

  const handleConfirmEdit = async () => {
    if (!messageToEdit || !editText.trim()) return;
    try {
      await editMessage(messageToEdit.id, editText);
      setIsEditDialogOpen(false);
      setMessageToEdit(null);
      setEditText('');
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  const handleDeleteClick = (message: any) => {
    /* Time restriction removed as per user request */
    setMessageToDelete(message);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!messageToDelete) return;
    try {
      await deleteMessage(messageToDelete.id);
      setIsDeleteDialogOpen(false);
      setMessageToDelete(null);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const handleUpdateGroupName = async () => {
    if (!activeChat || !newGroupName.trim() || newGroupName === activeChat.name) return;
    setIsUpdatingGroup(true);
    try {
      await updateGroupName(activeChat.id, newGroupName);
      setIsGroupSettingsOpen(false);
    } catch (error) {
      console.error('Failed to update group name:', error);
    } finally {
      setIsUpdatingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!activeChat) return;
    try {
      await deleteGroup(activeChat.id);
      setIsGroupSettingsOpen(false);
      setIsDeletingGroup(false);
      const slug = localStorage.getItem('company_slug');
      const chatBase = slug && user?.role === 'admin' ? `/${slug}/${user?.role}/chat` : `/${user?.role}/chat`;
      navigate(chatBase);
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  };

  const handleAddMembers = async () => {
    if (!activeChat || selectedNewUsers.length === 0) return;
    setIsUpdatingGroup(true);
    try {
      await addParticipants(activeChat.id, selectedNewUsers);
      setSelectedNewUsers([]);
      setIsAddingMembers(false);
    } catch (error) {
      console.error('Failed to add members:', error);
    } finally {
      setIsUpdatingGroup(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeChat) return;
    try {
      await removeParticipants(activeChat.id, [userId]);
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const handleConfirmRemoveMembers = async () => {
    if (!activeChat || selectedRemoveUsers.length === 0) return;
    setIsProcessingRemoval(true);
    try {
      await removeParticipants(activeChat.id, selectedRemoveUsers);
      toast({
        title: "Members Removed",
        description: `Successfully removed ${selectedRemoveUsers.length} member${selectedRemoveUsers.length > 1 ? 's' : ''} from the group.`
      });
      setSelectedRemoveUsers([]);
      setIsConfirmRemoveOpen(false);
      setIsRemovingMembers(false);
    } catch (error: any) {
      console.error('Failed to remove members:', error);
      toast({
        title: "Error",
        description: error?.response?.data?.message || error?.message || "Failed to remove members. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingRemoval(false);
    }
  };

  const handleFileClick = (type: 'image' | 'file') => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'image' ? 'image/*' : '*/*';
      fileInputRef.current.click();
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };



  const chatName = useMemo(() => {
    if (!displayedChat) return '';
    if (displayedChat.name && displayedChat.name !== 'string' && displayedChat.name !== 'null') return displayedChat.name;
    const currentUserId = user?.id?.toString();
    const otherParticipant = displayedChat.participants?.find((p: any) => p.userId?.toString() !== currentUserId);
    if (otherParticipant) {
      const u = availableUsers?.find(u => u.id?.toString() === otherParticipant.userId?.toString());
      return u?.name || otherParticipant.userName || 'Chat User';
    }
    return displayedChat.type === 'group' ? 'Group Chat' : 'Chat User';
  }, [displayedChat, availableUsers, user]);

  const chatAvatar = useMemo(() => {
    if (!displayedChat) return '';
    if (displayedChat.type === 'group') return displayedChat.groupAvatar || '';
    const currentUserId = user?.id?.toString();
    const otherParticipant = displayedChat.participants?.find((p: any) => p.userId?.toString() !== currentUserId);
    if (otherParticipant && availableUsers) {
      const userData = availableUsers.find(u => u.id?.toString() === otherParticipant.userId?.toString());
      return userData?.profilePhoto || '';
    }
    return '';
  }, [displayedChat, availableUsers, user]);

  const enrichedMessages = useMemo(() => {
    return messages.map(msg => {
      const isOwn = msg.senderId?.toString() === user?.id?.toString();
      if (isOwn) {
        return {
          ...msg,
          senderName: 'You',
          senderRole: user?.role,
          senderAvatar: user?.profilePhoto
        };
      }

      const userDetails = availableUsers?.find(u => u.id?.toString() === msg.senderId?.toString());
      const participantDetails = activeChat?.participants?.find(p => p.userId?.toString() === msg.senderId?.toString());

      return {
        ...msg,
        senderName: userDetails?.name || participantDetails?.userName || msg.senderName || 'Team Member',
        senderRole: userDetails?.role || participantDetails?.userRole || msg.senderRole || 'employee',
        senderAvatar: userDetails?.profilePhoto || msg.senderAvatar
      };
    });
  }, [messages, availableUsers, displayedChat, user]);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const themeClasses = {
    background: isDark ? 'bg-[#0b141a]' : 'bg-[#efeae2]/50',
    headerBg: isDark ? 'bg-[#202c33]' : 'bg-[#f0f2f5]',
    inputBg: isDark ? 'bg-[#202c33]' : 'bg-[#f0f2f5]',
    inputFieldBg: isDark ? 'bg-[#2a3942]' : 'bg-white',
    text: isDark ? 'text-slate-100' : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-400' : 'text-slate-500',
    border: isDark ? 'border-slate-800' : 'border-slate-200',
  };

  if (isLoading && !displayedChat) {
    return (
      <div className={cn("flex items-center justify-center h-full", themeClasses.background)}>
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent shadow-lg shadow-green-500/20"></div>
          <p className={cn("text-xs font-bold uppercase tracking-widest opacity-50", themeClasses.text)}>Loading Session...</p>
        </div>
      </div>
    );
  }

  if (!displayedChat) {
    if (!isLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-8 text-center bg-inherit">
          <div className="p-5 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-400">
            <MessageCircle className="h-10 w-10 opacity-40" />
          </div>
          <div className="space-y-1">
            <h3 className={cn("text-base font-bold", themeClasses.text)}>Conversation Not Available</h3>
            <p className={cn("text-xs opacity-60 max-w-sm", themeClasses.textSecondary)}>
              This conversation may have been deleted, or you may not be a participant.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigate(`${getRoleBasePath(user?.role)}/chat`);
            }}
            className="text-xs font-semibold rounded-xl mt-2"
          >
            Back to Chats
          </Button>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-inherit">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-4 border-slate-100 dark:border-slate-800 border-t-green-500 animate-spin" />
          <MessageCircle className="h-8 w-8 text-green-500 absolute inset-0 m-auto" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-500">Loading conversation...</p>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">Please wait a moment</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full relative overflow-hidden", themeClasses.background)}>
      {lightboxUrl && (
        <ImageLightbox
          src={lightboxUrl}
          alt={lightboxName}
          onClose={() => {
            setLightboxUrl(null);
            setLightboxName(undefined);
          }}
        />
      )}

      {/* Dynamic Background Patterns (WhatsApp Style) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className={cn(
          "absolute inset-0 opacity-[0.06] dark:opacity-[0.03] transition-opacity duration-700",
          "bg-[url('https://w0.peakpx.com/wallpaper/580/650/HD-wallpaper-whatsapp-bg-doodles-pattern-whatsapp.jpg')] bg-repeat bg-center mix-blend-multiply dark:mix-blend-overlay"
        )} style={{ backgroundSize: '400px' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/5 dark:to-white/5" />
      </div>

      {/* Modern Header */}
      <div className={cn(
        "flex-shrink-0 flex items-center justify-between p-3 sm:p-3.5 px-4 sm:px-6 relative z-10 border-b transition-colors",
        themeClasses.headerBg,
        themeClasses.border
      )}>
        <div className="flex items-center space-x-3 min-w-0 flex-1 mr-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const slug = localStorage.getItem('company_slug');
              const chatBase = slug && user?.role === 'admin' ? `/${slug}/${user?.role}/chat` : `/${user?.role}/chat`;
              navigate(chatBase);
            }}
            className="sm:hidden p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50 flex-shrink-0"
          >
            <ArrowLeft className={cn("h-5 w-5", themeClasses.text)} />
          </Button>

          <div className="relative group flex-shrink-0">
            <Avatar className="h-10 w-10 border shadow-sm transition-transform">
              <AvatarImage src={chatAvatar} />
              <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white font-bold text-xs">{chatName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 border-2 rounded-full shadow-sm",
              isDark ? "border-[#202c33]" : "border-white",
              displayedChat?.type === 'group' ? "bg-indigo-500" : (displayedChat?.isOnline ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600")
            )} />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className={cn("text-sm font-bold tracking-tight truncate leading-tight", isDark ? "text-slate-100" : "text-slate-900")}>
              {chatName}
            </h2>
            {displayedChat?.type === 'group' ? (
              <p
                className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5"
                title={displayedChat.participants?.map((p: any) => {
                  const userDetails = availableUsers?.find((u: any) => u.id?.toString() === p.userId?.toString());
                  return userDetails?.name || p.userName || 'Member';
                }).join(', ')}
              >
                {displayedChat.participants?.map((p: any) => {
                  const userDetails = availableUsers?.find((u: any) => u.id?.toString() === p.userId?.toString());
                  return userDetails?.name || p.userName || 'Member';
                }).join(', ')}
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {displayedChat?.isOnline ? 'Online' : 'Offline'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full text-slate-400 hover:text-green-500 hover:bg-green-500/10 transition-colors">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl border-2 shadow-xl p-2">
              <DropdownMenuLabel style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }} className="flex items-center gap-2 px-3 py-2 uppercase tracking-widest">
                <Info className="h-3 w-3" />
                Chat Options
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {displayedChat.type === 'group' ? (
                <>
                  {isCreator ? (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          setNewGroupName(displayedChat.name || '');
                          setIsGroupSettingsOpen(true);
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Settings className="h-4 w-4 text-slate-500" />
                        <span style={{ color: "#000000", fontSize: "14px" }}>Group Settings</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedNewUsers([]);
                          setMemberSearchTerm('');
                          setIsAddingMembers(true);
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <UserPlus className="h-4 w-4 text-slate-500" />
                        <span style={{ color: "#000000", fontSize: "14px" }}>Add Members</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedRemoveUsers([]);
                          setRemoveSearchTerm('');
                          setIsRemovingMembers(true);
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      >
                        <UserMinus className="h-4 w-4 text-red-500" />
                        <span style={{ color: "#EF4444", fontSize: "14px" }}>Remove Members</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setIsDeletingGroup(true)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      >
                        <TrashIcon className="h-4 w-4" />
                        <span style={{ color: "#EF4444", fontSize: "14px" }}>Delete Group</span>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          setNewGroupName(displayedChat.name || '');
                          setIsGroupSettingsOpen(true);
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Info className="h-4 w-4 text-slate-500" />
                        <span style={{ color: "#000000", fontSize: "14px" }}>View Group</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const slug = localStorage.getItem('company_slug');
                          const chatBase = slug && user?.role === 'admin' ? `/${slug}/${user?.role}/chat` : `/${user?.role}/chat`;
                          navigate(chatBase);
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <LogOut className="h-4 w-4 text-slate-500" />
                        <span style={{ color: "#000000", fontSize: "14px" }}>Exit Chat</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              ) : (
                <DropdownMenuItem
                  onClick={() => {
                    const slug = localStorage.getItem('company_slug');
                    const chatBase = slug && user?.role === 'admin' ? `/${slug}/${user?.role}/chat` : `/${user?.role}/chat`;
                    navigate(chatBase);
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <LogOut className="h-4 w-4 text-slate-500" />
                  <span style={{ color: "#000000", fontSize: "14px" }}>Exit Chat</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-6 py-4 relative z-10 custom-scrollbar"
        onScroll={handleScroll}
      >
        {enrichedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 animate-in fade-in zoom-in duration-500">
            <div className="p-6 rounded-full bg-slate-100 dark:bg-slate-800/40 text-slate-400">
              <MessageCircle className="h-12 w-12 opacity-50" />
            </div>
            <div className="text-center">
              <p className={cn("text-base font-bold", themeClasses.text)}>No messages yet</p>
              <p className={cn("text-xs opacity-60", themeClasses.textSecondary)}>Start the conversation with your team member</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 pb-2 w-full min-w-0">
            {enrichedMessages.map((message, index) => {
              const showDateSeparator = index === 0 || formatDateIST(message.timestamp, 'yyyy-MM-dd') !== formatDateIST(enrichedMessages[index - 1].timestamp, 'yyyy-MM-dd');
              return (
                <div
                  key={message.id}
                  id={`msg-${message.id}`}
                  className="animate-in slide-in-from-bottom-2 fade-in duration-200 rounded-xl"
                >
                  {showDateSeparator && (
                    <div className="flex justify-center my-3.5 sticky top-2 z-20 pointer-events-none">
                      <span className="px-3 py-1 rounded-lg text-[11px] font-semibold tracking-wide shadow-sm border bg-white/95 dark:bg-[#182229]/95 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/60 pointer-events-auto">
                        {formatDateIST(message.timestamp, 'MMMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={message}
                    isOwn={message.senderId?.toString() === user?.id?.toString()}
                    onReply={() => setReplyingTo(message.id)}
                    onEdit={() => handleEditClick(message)}
                    onDelete={() => handleDeleteClick(message)}
                    onImageClick={(url, name) => {
                      setLightboxUrl(url);
                      setLightboxName(name);
                    }}
                    replyMessage={message.replyTo ? enrichedMessages.find(m => m.id === message.replyTo) : undefined}
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Section */}
      {!lightboxUrl && (
        <div className={cn("p-2.5 sm:p-3 px-3 sm:px-6 relative z-20 border-t transition-colors", themeClasses.inputBg, themeClasses.border)}>
          {replyingTo && (
            <div className={cn(
              "flex items-center justify-between p-2.5 px-3 border-l-[3.5px] border-emerald-500 mb-2.5 rounded-r-xl shadow-sm transition-all",
              isDark ? "bg-[#182229]" : "bg-white"
            )}>
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Reply className="h-3 w-3 text-emerald-500" />
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                    Replying to {enrichedMessages.find(m => m.id === replyingTo)?.senderName || 'Message'}
                  </p>
                </div>
                <p className={cn("text-xs truncate font-medium", themeClasses.text)}>
                  {(() => {
                    const replyMsg = enrichedMessages.find(m => m.id === replyingTo);
                    if (!replyMsg) return '';
                    const c = replyMsg.content;
                    if (c.startsWith('data:image/') || c.includes('staffly_type=image') || replyMsg.messageType === 'image') return '📷 Photo';
                    if (c.includes('|data:application/') || c.includes('staffly_type=file') || replyMsg.messageType === 'file') return '📄 Document';
                    return `"${c}"`;
                  })()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-all flex-shrink-0"
                onClick={() => setReplyingTo(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-end gap-2 relative z-10 w-full min-w-0">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />

            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0 pb-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isUploading}
                onClick={() => triggerFileSelect("image/*")}
                className="h-9 w-9 rounded-full text-slate-500 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                title="Send Image"
              >
                <ImageIcon className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isUploading}
                onClick={() => triggerFileSelect(".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar")}
                className="h-9 w-9 rounded-full text-slate-500 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                title="Send Document"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
            </div>

            <div className={cn(
              "flex-1 relative rounded-2xl px-3.5 py-1 flex items-center transition-all border shadow-sm focus-within:ring-1 focus-within:ring-emerald-500/50 min-w-0",
              themeClasses.inputFieldBg,
              themeClasses.border
            )}>
              <textarea
                ref={inputRef}
                rows={1}
                value={messageText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isUploading}
                placeholder={isUploading ? "Uploading file..." : "Type a message..."}
                className={cn(
                  "w-full bg-transparent border-0 resize-none outline-none focus:outline-none focus:ring-0 text-sm py-2 px-1 placeholder:text-slate-400 dark:placeholder:text-slate-500 max-h-32 min-h-[38px] leading-relaxed custom-scrollbar",
                  themeClasses.text
                )}
              />
            </div>

            <Button
              type="button"
              onClick={handleSendMessage}
              disabled={!messageText.trim() || isUploading}
              className={cn(
                "rounded-full h-10 w-10 sm:h-11 sm:w-11 shadow-md transition-all flex-shrink-0 p-0 mb-0.5",
                messageText.trim() && !isUploading
                  ? "bg-[#00a884] hover:bg-[#008f6f] text-white shadow-emerald-500/20 hover:scale-105 active:scale-95"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed opacity-60"
              )}
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-4.5 w-4.5 ml-0.5 text-white" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog for Deletion */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="border-2 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <AlertDialogTitle className="text-xl font-bold">Delete Message?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Are you sure you want to delete this message? This action cannot be undone and the message will be removed for everyone in the chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="font-bold border-2">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              Delete for Everyone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Small Edit Form Modal */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] border-2 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <Edit className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl font-bold">Edit Message</DialogTitle>
            </div>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              Update your message content. Only the content will be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
              placeholder="Type updated message..."
              className="min-h-[100px] border-2 focus:ring-green-500/50 resize-none font-medium text-[15px]"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className="font-bold border-2"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmEdit}
              disabled={!editText.trim() || editText === messageToEdit?.content}
              className="bg-green-600 hover:bg-green-700 text-white font-bold min-w-[80px]"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Settings Dialog */}
      <Dialog open={isGroupSettingsOpen} onOpenChange={setIsGroupSettingsOpen}>
        <DialogContent className="sm:max-w-[500px] border-2 shadow-2xl p-0 overflow-hidden rounded-[28px]">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center gap-4 mb-2">
              <div className="h-12 w-12 rounded-2xl bg-green-500 shadow-lg shadow-green-500/20 flex items-center justify-center text-white">
                {isCreator ? <Settings className="h-6 w-6" /> : <Info className="h-6 w-6" />}
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight">{isCreator ? 'Group Settings' : 'Group Details'}</DialogTitle>
                <DialogDescription className="font-medium">{isCreator ? 'Manage members and group identity' : 'View group information and members'}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Group Name</label>
              <div className="flex gap-2">
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                  className="rounded-xl border-2 font-bold"
                  placeholder="Enter group name"
                  disabled={!isCreator}
                />
                {isCreator && (
                  <Button
                    onClick={handleUpdateGroupName}
                    disabled={isUpdatingGroup || !newGroupName.trim() || newGroupName === activeChat?.name}
                    className="bg-green-500 hover:bg-green-600 text-white font-black rounded-xl"
                  >
                    {isUpdatingGroup ? '...' : 'Update'}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Members ({(activeChat?.participants || []).length})</label>
                {isCreator && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingMembers(true)}
                    className="h-7 px-2 text-[10px] font-black text-green-600 hover:bg-green-50 rounded-lg uppercase tracking-wider"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add New
                  </Button>
                )}
              </div>

              <ScrollArea className="h-[200px] rounded-2xl border-2 p-2">
                <div className="space-y-1">
                  {(activeChat?.participants || []).map((p) => {
                    const memberDetails = availableUsers.find(u => u.id?.toString() === p.userId?.toString());
                    const memberDesignation = memberDetails?.designation || p.userRole;
                    return (
                      <div key={p.userId} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={memberDetails?.profilePhoto} />
                            <AvatarFallback className="bg-slate-100 font-bold text-xs">{p.userName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-bold leading-none mb-1">{memberDetails?.name || p.userName} {p.userId === user?.id && <span className="text-[10px] text-green-500 font-black ml-1">(You)</span>}</p>
                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">{memberDesignation}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {p.isAdmin && (
                            <Badge variant="outline" className="text-[8px] font-black uppercase bg-amber-50 text-amber-600 border-amber-200">Admin</Badge>
                          )}
                          {isCreator && p.userId !== user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveMember(p.userId)}
                              className="h-8 w-8 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t mt-auto flex flex-col gap-3">
            {isCreator ? (
              <Button
                variant="destructive"
                className="w-full rounded-xl font-bold py-6 bg-red-500 hover:bg-red-600 text-white border-none shadow-lg shadow-red-500/20"
                onClick={() => setIsDeletingGroup(true)}
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete Group
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="w-full rounded-xl font-bold py-6 bg-red-500 hover:bg-red-600 text-white border-none shadow-lg shadow-red-500/20"
                onClick={() => {
                  const slug = localStorage.getItem('company_slug');
                  const chatBase = slug && user?.role === 'admin' ? `/${slug}/${user?.role}/chat` : `/${user?.role}/chat`;
                  navigate(chatBase);
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Exit Chat
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full rounded-xl font-bold border-2"
              onClick={() => setIsGroupSettingsOpen(false)}
            >
              {isCreator ? 'Close Settings' : 'Close Details'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Members Dialog */}
      <Dialog open={isAddingMembers} onOpenChange={setIsAddingMembers}>
        <DialogContent className="sm:max-w-[450px] border-2 shadow-2xl p-0 overflow-hidden rounded-[28px]">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center gap-4 mb-2">
              <div className="h-12 w-12 rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/20 flex items-center justify-center text-white">
                <UserPlus className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight">Add Members</DialogTitle>
                <DialogDescription className="font-medium">Invite teammates to this group</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search teammates..."
                className="pl-9 h-11 rounded-xl border-2"
                value={memberSearchTerm}
                onChange={(e) => setMemberSearchTerm(e.target.value)}
              />
            </div>

            <ScrollArea className="h-[250px] rounded-2xl border-2 p-2">
              <div className="space-y-1">
                {availableUsers
                  .filter(u =>
                    !(activeChat?.participants || []).some(p => p.userId === u.id) &&
                    ((u.name || '').toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
                      (u.department || '').toLowerCase().includes(memberSearchTerm.toLowerCase()))
                  )
                  .map((u) => (
                    <div
                      key={u.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all",
                        selectedNewUsers.includes(u.id) ? "bg-blue-500/10 border border-blue-200" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                      onClick={() => {
                        setSelectedNewUsers(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={u.profilePhoto} />
                          <AvatarFallback className="bg-slate-100 font-bold text-xs">{u.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-bold leading-none mb-1">{u.name}</p>
                          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">{u.department || 'N/A'} • {u.role}</p>
                        </div>
                      </div>
                      <Checkbox checked={selectedNewUsers.includes(u.id)} onCheckedChange={() => { }} />
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </div>

          <div className="p-6 flex gap-3 border-t">
            <Button variant="outline" className="flex-1 rounded-xl font-bold border-2" onClick={() => setIsAddingMembers(false)}>Cancel</Button>
            <Button
              className="flex-1 rounded-xl font-black bg-blue-500 hover:bg-blue-600 text-white"
              onClick={handleAddMembers}
              disabled={selectedNewUsers.length === 0 || isUpdatingGroup}
            >
              {isUpdatingGroup ? 'Adding...' : `Add ${selectedNewUsers.length} Members`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation */}
      <AlertDialog open={isDeletingGroup} onOpenChange={setIsDeletingGroup}>
        <AlertDialogContent className="border-2 shadow-2xl rounded-[28px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-4 mb-2">
              <div className="h-12 w-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600">
                <TrashIcon className="h-6 w-6" />
              </div>
              <div>
                <AlertDialogTitle className="text-2xl font-black tracking-tight text-red-600">Delete Group?</AlertDialogTitle>
                <AlertDialogDescription className="font-medium text-slate-600">
                  This will permanently delete the group <span className="font-black text-slate-900">"{activeChat?.name}"</span> and all its message history for everyone.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-0 mt-4">
            <AlertDialogCancel className="font-bold border-2 rounded-xl h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              className="bg-red-600 hover:bg-red-700 text-white font-black rounded-xl h-11"
            >
              Yes, Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Members Dialog */}
      <Dialog
        open={isRemovingMembers}
        onOpenChange={(open) => {
          setIsRemovingMembers(open);
          if (!open) {
            setSelectedRemoveUsers([]);
            setRemoveSearchTerm('');
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px] border-2 shadow-2xl p-0 overflow-hidden rounded-[28px]">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center gap-4 mb-2">
              <div className="h-12 w-12 rounded-2xl bg-red-500 shadow-lg shadow-red-500/20 flex items-center justify-center text-white">
                <UserMinus className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight">Remove Members</DialogTitle>
                <DialogDescription className="font-medium">
                  Select members to remove from "{displayedChat?.name}"
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search member by name, role or department..."
                value={removeSearchTerm}
                onChange={(e) => setRemoveSearchTerm(e.target.value)}
                className="pl-10 rounded-xl border-2 font-medium"
              />
            </div>

            {/* List Controls: Count and Select/Deselect All */}
            {(() => {
              const currentParticipants = displayedChat?.participants || [];
              const filteredParticipants = currentParticipants.filter((p: any) => {
                const memberDetails = availableUsers?.find(u => String(u.id) === String(p.userId));
                const name = memberDetails?.name || p.userName || '';
                const dept = memberDetails?.department || '';
                const role = memberDetails?.role || p.userRole || '';
                const q = removeSearchTerm.toLowerCase();
                return name.toLowerCase().includes(q) || dept.toLowerCase().includes(q) || role.toLowerCase().includes(q);
              });

              const removableFilteredIds = filteredParticipants
                .filter((p: any) => {
                  const isSelf = String(p.userId) === String(user?.id);
                  const isGroupCreator = String(p.userId) === String(displayedChat?.createdBy);
                  const memberDetails = availableUsers?.find(u => String(u.id) === String(p.userId));
                  const isMemberAdmin = p.userRole === 'admin' || memberDetails?.role === 'admin';
                  return !isSelf && !isGroupCreator && (user?.role === 'admin' || !isMemberAdmin);
                })
                .map((p: any) => String(p.userId));

              const allRemovableSelected =
                removableFilteredIds.length > 0 &&
                removableFilteredIds.every(id => selectedRemoveUsers.includes(id));

              return (
                <>
                  <div className="flex items-center justify-between px-1 text-xs">
                    <span className="font-semibold text-slate-500">
                      {removableFilteredIds.length} removable member{removableFilteredIds.length === 1 ? '' : 's'}
                      {selectedRemoveUsers.length > 0 && ` (${selectedRemoveUsers.length} selected)`}
                    </span>
                    {removableFilteredIds.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (allRemovableSelected) {
                            setSelectedRemoveUsers(prev => prev.filter(id => !removableFilteredIds.includes(id)));
                          } else {
                            setSelectedRemoveUsers(prev => Array.from(new Set([...prev, ...removableFilteredIds])));
                          }
                        }}
                        className="h-7 px-2 text-[11px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                      >
                        {allRemovableSelected ? 'Deselect All' : 'Select All'}
                      </Button>
                    )}
                  </div>

                  {/* Scrollable Members List */}
                  <ScrollArea className="h-[280px] rounded-2xl border-2 p-2">
                    <div className="space-y-1">
                      {filteredParticipants.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-500">
                          No members found matching "{removeSearchTerm}"
                        </div>
                      ) : (
                        filteredParticipants.map((p: any) => {
                          const pIdStr = String(p.userId);
                          const memberDetails = availableUsers?.find(u => String(u.id) === pIdStr);
                          const isSelf = pIdStr === String(user?.id);
                          const isGroupCreator = pIdStr === String(displayedChat?.createdBy);
                          const isMemberAdmin = p.userRole === 'admin' || memberDetails?.role === 'admin';
                          const isRemovable = !isSelf && !isGroupCreator && (user?.role === 'admin' || !isMemberAdmin);
                          const isSelected = selectedRemoveUsers.includes(pIdStr);

                          return (
                            <div
                              key={pIdStr}
                              className={cn(
                                "flex items-center justify-between p-2.5 rounded-xl transition-all",
                                isRemovable ? "cursor-pointer select-none" : "opacity-60 cursor-not-allowed",
                                isSelected
                                  ? "bg-red-500/10 border border-red-200 dark:border-red-900/50"
                                  : isRemovable
                                    ? "hover:bg-slate-50 dark:hover:bg-slate-800"
                                    : ""
                              )}
                              onClick={() => {
                                if (!isRemovable) return;
                                setSelectedRemoveUsers(prev =>
                                  prev.includes(pIdStr) ? prev.filter(id => id !== pIdStr) : [...prev, pIdStr]
                                );
                              }}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="h-9 w-9 flex-shrink-0">
                                  <AvatarImage src={memberDetails?.profilePhoto} />
                                  <AvatarFallback className="bg-slate-100 dark:bg-slate-800 font-bold text-xs">
                                    {(memberDetails?.name || p.userName || 'U').charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-sm font-bold leading-tight truncate">
                                      {memberDetails?.name || p.userName}
                                    </p>
                                    {isSelf && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400">
                                        You
                                      </span>
                                    )}
                                    {isGroupCreator && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                                        Creator
                                      </span>
                                    )}
                                    {!isGroupCreator && isMemberAdmin && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                                        Admin
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-tight truncate mt-0.5">
                                    {memberDetails?.department || 'Member'} • {memberDetails?.designation || p.userRole || 'Member'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center pl-2 flex-shrink-0">
                                {isRemovable ? (
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => {
                                      setSelectedRemoveUsers(prev =>
                                        prev.includes(pIdStr) ? prev.filter(id => id !== pIdStr) : [...prev, pIdStr]
                                      );
                                    }}
                                    className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                  />
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">
                                    {isGroupCreator ? 'Creator' : isSelf ? 'Cannot remove self' : 'Protected'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </>
              );
            })()}
          </div>

          <div className="p-6 flex gap-3 border-t bg-slate-50/50 dark:bg-slate-900/50">
            <Button
              variant="outline"
              className="flex-1 rounded-xl font-bold border-2"
              onClick={() => {
                setIsRemovingMembers(false);
                setSelectedRemoveUsers([]);
                setRemoveSearchTerm('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-xl font-black bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20"
              onClick={() => setIsConfirmRemoveOpen(true)}
              disabled={selectedRemoveUsers.length === 0}
            >
              Remove {selectedRemoveUsers.length > 0 ? `(${selectedRemoveUsers.length})` : ''} Members
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Members Confirmation Dialog */}
      <AlertDialog open={isConfirmRemoveOpen} onOpenChange={setIsConfirmRemoveOpen}>
        <AlertDialogContent className="border-2 shadow-2xl rounded-[28px] max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-4 mb-2">
              <div className="h-12 w-12 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 flex-shrink-0">
                <UserMinus className="h-6 w-6" />
              </div>
              <div>
                <AlertDialogTitle className="text-xl font-black tracking-tight text-red-600">
                  Remove {selectedRemoveUsers.length} Member{selectedRemoveUsers.length > 1 ? 's' : ''}?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">
                  Are you sure you want to remove {selectedRemoveUsers.length === 1 ? 'this member' : `these ${selectedRemoveUsers.length} members`} from <span className="font-bold text-slate-900 dark:text-slate-100">"{displayedChat?.name}"</span>? They will no longer have access to this conversation.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-3 mt-4">
            <AlertDialogCancel
              disabled={isProcessingRemoval}
              className="font-bold border-2 rounded-xl h-11"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmRemoveMembers();
              }}
              disabled={isProcessingRemoval}
              className="bg-red-600 hover:bg-red-700 text-white font-black rounded-xl h-11 flex items-center justify-center gap-2"
            >
              {isProcessingRemoval ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Yes, Remove Members'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChatBox;

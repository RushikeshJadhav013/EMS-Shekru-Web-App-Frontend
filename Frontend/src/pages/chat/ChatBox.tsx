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
  Search
} from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDateIST } from '@/utils/timezone';
import { cn } from '@/lib/utils';

import MessageBubble from '../../components/chat/MessageBubble';
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
    removeParticipants
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const typingPulseRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);



  useEffect(() => {
    if (chatId && (!activeChat || activeChat.id !== chatId)) {
      const foundChat = chats.find(chat => chat.id?.toString() === chatId?.toString());
      if (foundChat) {
        setActiveChat(foundChat);
      }
    }
  }, [chatId, activeChat, chats, setActiveChat]);

  useEffect(() => {
    if (activeChat && messages.length > 0) {
      const unreadMessageIds = messages
        .filter(m => !m.isRead && m.senderId?.toString() !== user?.id?.toString())
        .map(m => m.id);

      if (unreadMessageIds.length > 0) {
        markAsRead(activeChat.id, unreadMessageIds);
      }
    }
  }, [activeChat, messages, markAsRead, user?.id]);

  const handleTyping = () => {
    if (!activeChat) return;
    if (typingPulseRef.current) return;
    sendTyping(activeChat.id);
    typingPulseRef.current = setTimeout(() => {
      typingPulseRef.current = null;
    }, 2000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitizedValue = e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '');
    setMessageText(sanitizedValue);
    handleTyping();
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeChat) return;
    try {
      await sendMessage(messageText, 'text', replyingTo || undefined);
      setMessageText('');
      setReplyingTo(null);

    } catch (error) {
      console.error('Failed to send message:', error);
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
    // Check if within 5 minutes
    const sentTime = new Date(message.timestamp).getTime();
    const now = new Date().getTime();
    const diffMins = (now - sentTime) / (1000 * 60);

    if (diffMins > 5) {
      toast({
        title: "Delete restricted",
        description: "Messages can only be deleted within 5 minutes of sending.",
        variant: "destructive"
      });
      return;
    }

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
      navigate(`/${user?.role}/chat`);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };



  const chatName = useMemo(() => {
    if (!activeChat) return '';
    if (activeChat.name && activeChat.name !== 'string' && activeChat.name !== 'null') return activeChat.name;
    const currentUserId = user?.id?.toString();
    const otherParticipant = activeChat.participants?.find((p: any) => p.userId?.toString() !== currentUserId);
    if (otherParticipant) {
      const u = availableUsers?.find(u => u.id?.toString() === otherParticipant.userId?.toString());
      return u?.name || otherParticipant.userName || 'Chat User';
    }
    return activeChat.type === 'group' ? 'Group Chat' : 'Chat User';
  }, [activeChat, availableUsers, user]);

  const chatAvatar = useMemo(() => {
    if (!activeChat) return '';
    if (activeChat.type === 'group') return activeChat.groupAvatar || '';
    const currentUserId = user?.id?.toString();
    const otherParticipant = activeChat.participants?.find((p: any) => p.userId?.toString() !== currentUserId);
    if (otherParticipant && availableUsers) {
      const userData = availableUsers.find(u => u.id?.toString() === otherParticipant.userId?.toString());
      return userData?.profilePhoto || '';
    }
    return '';
  }, [activeChat, availableUsers, user]);

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
  }, [messages, availableUsers, activeChat, user]);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const themeClasses = {
    background: isDark ? 'bg-[#0a1628]' : 'bg-white',
    headerBg: isDark ? 'bg-[#0f172a]' : 'bg-gray-50/50',
    inputBg: isDark ? 'bg-[#0f172a]' : 'bg-gray-50/50',
    inputFieldBg: isDark ? 'bg-[#1e293b]' : 'bg-white',
    text: isDark ? 'text-slate-100' : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-400' : 'text-slate-500',
    border: isDark ? 'border-slate-800' : 'border-slate-100',
  };

  if (isLoading && !activeChat) {
    return (
      <div className={cn("flex items-center justify-center h-full", themeClasses.background)}>
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent shadow-lg shadow-green-500/20"></div>
          <p className={cn("text-xs font-bold uppercase tracking-widest opacity-50", themeClasses.text)}>Loading Session...</p>
        </div>
      </div>
    );
  }

  if (!activeChat) return null;

  return (
    <div className={cn("flex flex-col h-full relative overflow-hidden", themeClasses.background)}>
      {/* Dynamic Background Patterns */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#22c55e_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* Modern Header */}
      <div className={cn(
        "flex-shrink-0 flex items-center justify-between p-3.5 px-6 relative z-10 border-b transition-colors",
        themeClasses.headerBg,
        themeClasses.border
      )}>
        <div className="flex items-center space-x-3.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/${user?.role}/chat`)}
            className="sm:hidden p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
          >
            <ArrowLeft className={cn("h-5 w-5", themeClasses.text)} />
          </Button>

          <div className="relative group">
            <Avatar className="h-10 w-10 border shadow-lg shadow-green-500/5 group-hover:scale-105 transition-transform">
              <AvatarImage src={chatAvatar} />
              <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white font-black text-xs">{chatName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 border-2 border-white dark:border-[#0f172a] rounded-full shadow-sm" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className={cn("font-black truncate text-[15px] tracking-tight leading-none", themeClasses.text)}>{chatName}</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[10px] font-black text-green-500 uppercase tracking-widest leading-none">
                Online
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full text-slate-400 hover:text-green-500 hover:bg-green-500/10 transition-colors">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl border-2 shadow-xl p-2">
              <DropdownMenuLabel className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <Info className="h-3 w-3" />
                Chat Options
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {activeChat.type === 'group' && (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      setNewGroupName(activeChat.name || '');
                      setIsGroupSettingsOpen(true);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Settings className="h-4 w-4 text-slate-500" />
                    <span className="font-bold text-sm">Group Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedNewUsers([]);
                      setIsAddingMembers(true);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <UserPlus className="h-4 w-4 text-slate-500" />
                    <span className="font-bold text-sm">Add Members</span>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem
                onClick={() => navigate(`/${user?.role}/chat`)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <LogOut className="h-4 w-4 text-slate-500" />
                <span className="font-bold text-sm">Exit Chat</span>
              </DropdownMenuItem>
              {activeChat.type === 'group' && activeChat.participants.find(p => p.userId === user?.id)?.isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setIsDeletingGroup(true)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                    <span className="font-bold text-sm">Delete Group</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 relative z-10 custom-scrollbar">
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
          <div className="space-y-4 pb-4">
            {enrichedMessages.map((message, index) => {
              const showDateSeparator = index === 0 || formatDateIST(message.timestamp, 'yyyy-MM-dd') !== formatDateIST(enrichedMessages[index - 1].timestamp, 'yyyy-MM-dd');
              return (
                <div key={message.id} className="animate-in slide-in-from-bottom-2 fade-in duration-300">
                  {showDateSeparator && (
                    <div className="flex justify-center my-8 relative">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-slate-100 dark:border-slate-800/50"></div>
                      </div>
                      <span className={cn(
                        "relative text-[10px] uppercase tracking-widest font-black px-4 py-1.5 rounded-full border shadow-sm backdrop-blur-md",
                        isDark ? "bg-[#0f172a] border-slate-800 text-slate-400" : "bg-white border-slate-100 text-slate-500"
                      )}>
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
      <div className={cn("p-4 px-6 relative z-20 transition-all", themeClasses.inputBg)}>
        {replyingTo && (
          <div className={cn(
            "flex items-center justify-between p-3.5 border-l-[3.5px] border-lime-500 mb-4 rounded-r-2xl animate-in slide-in-from-bottom-4 fade-in duration-300 shadow-sm transition-all",
            isDark ? "bg-[#1a1b1e]/80" : "bg-slate-50/80"
          )}>
            <div className="min-w-0 pr-6">
              <div className="flex items-center gap-2 mb-1">
                <Reply className="h-3 w-3 text-lime-500" />
                <p className="text-[10px] text-lime-600 dark:text-lime-500 font-black uppercase tracking-widest">
                  Replying to {enrichedMessages.find(m => m.id === replyingTo)?.senderName || 'Message'}
                </p>
              </div>
              <p className={cn("text-[13px] truncate opacity-80 font-medium italic", themeClasses.text)}>
                "{enrichedMessages.find(m => m.id === replyingTo)?.content}"
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-90"
              onClick={() => setReplyingTo(null)}
            >
              <X className="h-4.5 w-4.5" />
            </Button>
          </div>
        )}

        <div className="flex items-end space-x-3">
          <div className={cn(
            "flex-1 relative rounded-[28px] px-4 py-1.5 flex items-center transition-all shadow-lg ring-1 ring-slate-200 dark:ring-slate-800 focus-within:ring-green-500/50",
            themeClasses.inputFieldBg
          )}>

            <Input
              ref={inputRef}
              value={messageText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="border-0 bg-transparent focus-visible:ring-0 shadow-none text-[15px] h-11 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium"
            />


          </div>

          <Button
            onClick={handleSendMessage}
            disabled={!messageText.trim()}
            className={cn(
              "rounded-full h-[52px] w-[52px] shadow-xl transition-all hover:scale-105 active:scale-95 p-0",
              messageText.trim() ? "bg-green-500 hover:bg-green-600 shadow-green-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
            )}
          >
            <Send className={cn("h-5 w-5 transition-transform", messageText.trim() && "translate-x-0.5 -translate-y-0.5 rotate-[-15deg]")} />
          </Button>
        </div>


      </div>

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
                <Settings className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight">Group Settings</DialogTitle>
                <DialogDescription className="font-medium">Manage members and group identity</DialogDescription>
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
                />
                <Button
                  onClick={handleUpdateGroupName}
                  disabled={isUpdatingGroup || !newGroupName.trim() || newGroupName === activeChat?.name}
                  className="bg-green-500 hover:bg-green-600 text-white font-black rounded-xl"
                >
                  {isUpdatingGroup ? '...' : 'Update'}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Members ({activeChat?.participants.length})</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddingMembers(true)}
                  className="h-7 px-2 text-[10px] font-black text-green-600 hover:bg-green-50 rounded-lg uppercase tracking-wider"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add New
                </Button>
              </div>

              <ScrollArea className="h-[200px] rounded-2xl border-2 p-2">
                <div className="space-y-1">
                  {activeChat?.participants.map((p) => (
                    <div key={p.userId} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={availableUsers.find(u => u.id === p.userId)?.profilePhoto} />
                          <AvatarFallback className="bg-slate-100 font-bold text-xs">{p.userName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-bold leading-none mb-1">{p.userName} {p.userId === user?.id && <span className="text-[10px] text-green-500 font-black ml-1">(You)</span>}</p>
                          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">{p.department} • {p.userRole}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.isAdmin && (
                          <Badge variant="outline" className="text-[8px] font-black uppercase bg-amber-50 text-amber-600 border-amber-200">Admin</Badge>
                        )}
                        {activeChat.participants.find(part => part.userId === user?.id)?.isAdmin && p.userId !== user?.id && (
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
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t mt-auto">
            <Button
              variant="outline"
              className="w-full rounded-xl font-bold border-2"
              onClick={() => setIsGroupSettingsOpen(false)}
            >
              Close Settings
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
                onChange={(e) => setMemberSearchTerm(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
              />
            </div>

            <ScrollArea className="h-[250px] rounded-2xl border-2 p-2">
              <div className="space-y-1">
                {availableUsers
                  .filter(u =>
                    !activeChat?.participants.some(p => p.userId === u.id) &&
                    (u.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
                      u.department.toLowerCase().includes(memberSearchTerm.toLowerCase()))
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
                          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">{u.department} • {u.role}</p>
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
    </div>
  );
};

export default ChatBox;
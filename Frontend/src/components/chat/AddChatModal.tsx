import React, { useState, useEffect } from 'react';
import { X, Users, MessageCircle, Search, Hash, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ChatPermissions } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AddChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  permissions: ChatPermissions | null;
  initialTab?: 'individual' | 'group';
}

const AddChatModal: React.FC<AddChatModalProps> = ({ isOpen, onClose, permissions, initialTab = 'individual' }) => {
  const navigate = useNavigate();
  const { availableUsers, createChat, loadAvailableUsers, setActiveChat, chats } = useChat();
  const { user } = useAuth();
  const { toast } = useToast();
  const { themeMode } = useTheme();
  const [activeTab, setActiveTab] = useState<'individual' | 'group'>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [groupNameError, setGroupNameError] = useState('');

  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    if (isOpen) {
      loadAvailableUsers();
      setSelectedUsers([]);
      setGroupName('');
      setGroupDescription('');
      setSearchTerm('');
      setGroupNameError('');
    }
  }, [isOpen, loadAvailableUsers]);

  // Check for duplicate group name in real-time
  useEffect(() => {
    if (groupName.trim() && activeTab === 'group') {
      // Normalize: remove all spaces and convert to lowercase for comparison
      const normalizedInput = groupName.toLowerCase().replace(/\s+/g, '');

      const duplicate = chats.find(c =>
        c.type === 'group' &&
        c.name?.toLowerCase().replace(/\s+/g, '') === normalizedInput
      );
      if (duplicate) {
        setGroupNameError(`A group named "${duplicate.name}" already exists`);
      } else {
        setGroupNameError('');
      }
    } else {
      setGroupNameError('');
    }
  }, [groupName, chats, activeTab]);

  const filteredUsers = availableUsers.filter(u => {
    if (u.id === user?.id) return false;
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const handleCreateIndividualChat = async (userId: string) => {
    setIsCreating(true);
    try {
      const newChat = await createChat('individual', [userId]);
      setActiveChat(newChat);
      navigate(`/${user?.role}/chat/${newChat.id}`);
      onClose();
    } catch (error) {
      console.error('Failed to create individual chat:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateGroupChat = async () => {
    if (selectedUsers.length === 0 || !groupName.trim()) return;
    if (groupNameError) return; // Prevent creation if there's an error

    setIsCreating(true);
    try {
      const newChat = await createChat('group', selectedUsers, groupName, groupDescription);
      setActiveChat(newChat);
      navigate(`/${user?.role}/chat/${newChat.id}`);
      onClose();
    } catch (error) {
      console.error('Failed to create group chat:', error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
      <div className={cn(
        "rounded-[32px] w-full max-w-xl mx-auto shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]",
        isDark ? "bg-[#0f172a] border-slate-800" : "bg-white border-slate-100"
      )}>
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between p-8 border-b transition-colors",
          isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-100 bg-gray-50/50"
        )}>
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-500 shadow-lg shadow-green-500/20 rounded-2xl">
              <Plus className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className={cn("text-2xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>New Message</h2>
              <p className={cn("text-sm font-medium", isDark ? "text-slate-400" : "text-slate-500")}>Start a conversation with your team</p>
            </div>
          </div>
          <Button
            variant="ghost" size="icon" onClick={onClose}
            className="h-11 w-11 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-95"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'individual' | 'group')} className="w-full flex flex-col flex-1 overflow-hidden">
          <div className="px-8 pt-6">
            <TabsList className={cn(
              "grid w-full grid-cols-2 p-1.5 rounded-2xl h-auto",
              isDark ? "bg-slate-800/50" : "bg-slate-100"
            )}>
              <TabsTrigger
                value="individual"
                className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all font-bold text-sm"
              >
                <MessageCircle className="h-4 w-4" />
                Individual
              </TabsTrigger>
              <TabsTrigger
                value="group"
                disabled={!permissions?.canCreateGroups}
                className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all font-bold text-sm"
              >
                <Users className="h-4 w-4" />
                Group Chat
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="px-8 py-6">
            <div className="relative group">
              <Search className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors",
                searchTerm ? "text-green-500" : "text-slate-400"
              )} />
              <Input
                placeholder="Search by name, role or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                className={cn(
                  "pl-12 pr-4 py-6 border-0 rounded-2xl font-medium focus-visible:ring-2 focus-visible:ring-green-500/30 transition-all shadow-inner",
                  isDark ? "bg-slate-800/40 text-white placeholder:text-slate-500" : "bg-gray-100 text-slate-900 placeholder:text-slate-400"
                )}
              />
            </div>
          </div>

          <TabsContent value="individual" className="mt-0 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="px-8 flex-1 overflow-y-auto custom-scrollbar pb-8 min-h-0">
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 opacity-50">
                  <div className="p-6 rounded-3xl bg-slate-100 dark:bg-slate-800 mb-4">
                    <Users className="h-10 w-10" />
                  </div>
                  <p className="font-bold">No teammates found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((u, i) => {
                    const existingChat = chats.find(c =>
                      c.type === 'individual' &&
                      c.participants.some(p => p.userId === u.id)
                    );

                    return (
                      <div
                        key={u.id}
                        onClick={() => handleCreateIndividualChat(u.id)}
                        className={cn(
                          "flex items-center p-4 rounded-3xl cursor-pointer transition-all duration-300 border border-transparent hover:shadow-xl hover:shadow-black/5 active:scale-[0.98] group",
                          isDark ? "hover:bg-slate-800/80 hover:border-slate-700" : "hover:bg-white hover:border-slate-100"
                        )}
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <div className="relative">
                          <Avatar className="h-12 w-12 border-2 border-white dark:border-slate-800 shadow-md">
                            <AvatarImage src={u.profilePhoto} />
                            <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white font-black text-sm">
                              {u.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full" />
                        </div>
                        <div className="ml-4 flex-1 min-w-0">
                          <p className={cn("font-bold truncate text-sm", isDark ? "text-white" : "text-slate-900")}>{u.name}</p>
                          <p className={cn("text-xs font-medium opacity-60", isDark ? "text-slate-400" : "text-slate-500")}>
                            {u.designation} • {u.department}
                          </p>
                        </div>
                        {existingChat ? (
                          <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                            <div className={cn(
                              "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border",
                              isDark ? "bg-green-500/5 border-green-500/20 text-green-500/70" : "bg-green-50 border-green-100 text-green-600"
                            )}>
                              Resumable
                            </div>
                            <div className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center transition-all",
                              isDark ? "bg-slate-800 text-slate-400 group-hover:bg-green-500/20 group-hover:text-green-500" : "bg-gray-100 text-slate-400 group-hover:bg-green-50 group-hover:text-green-600"
                            )}>
                              <MessageCircle className="h-3.5 w-3.5" />
                            </div>
                          </div>
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center transition-all scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100">
                            <Plus className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="group" className="mt-0 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="px-8 pb-4 flex-shrink-0 space-y-4">
              {/* Group Configuration Area */}
              <div className={cn(
                "p-4 rounded-2xl flex flex-col space-y-3 border shadow-sm transition-all",
                isDark ? "bg-slate-800/20 border-slate-700/50" : "bg-gray-50/50 border-slate-100"
              )}>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Hash className={cn(
                      "absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors",
                      groupNameError ? "text-red-500" : "text-green-500"
                    )} />
                    <Input
                      placeholder="Group Name"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                      className={cn(
                        "pl-9 h-10 border rounded-xl focus-visible:ring-1 shadow-sm text-sm font-semibold transition-all",
                        groupNameError
                          ? "border-red-500 focus-visible:ring-red-500/50 bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-100"
                          : "border-0 focus-visible:ring-green-500/50",
                        isDark && !groupNameError ? "bg-slate-800 text-white" : !groupNameError && "bg-white text-slate-900"
                      )}
                    />
                  </div>
                  <Input
                    placeholder="Description (Optional)"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                    className={cn(
                      "h-10 border-0 rounded-xl focus-visible:ring-1 focus-visible:ring-green-500/50 shadow-sm text-sm font-medium flex-[1.5]",
                      isDark ? "bg-slate-800 text-white" : "bg-white text-slate-900"
                    )}
                  />
                </div>
              </div>

              {/* Selected Members Preview */}
              {selectedUsers.length > 0 && (
                <div className="animate-in slide-in-from-top-2 fade-in duration-300">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className={cn("text-[10px] font-black uppercase tracking-widest opacity-60", isDark ? "text-slate-400" : "text-slate-500")}>
                      Selected ({selectedUsers.length})
                    </p>
                    <Button
                      variant="ghost"
                      className="h-6 px-2 text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-500/5 rounded-lg"
                      onClick={() => setSelectedUsers([])}
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto pb-2 custom-scrollbar snap-x">
                    {selectedUsers.map(id => {
                      const u = availableUsers.find(user => user.id === id);
                      if (!u) return null;
                      return (
                        <div
                          key={id}
                          className={cn(
                            "flex-shrink-0 flex items-center gap-2 p-1.5 pr-3 rounded-full border snap-start animate-in zoom-in-90",
                            isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100 shadow-sm"
                          )}
                        >
                          <Avatar className="h-6 w-6 border border-white dark:border-slate-800">
                            <AvatarImage src={u.profilePhoto} />
                            <AvatarFallback className="bg-green-500 text-white text-[8px] font-bold">
                              {u.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className={cn("text-[11px] font-bold truncate max-w-[80px]", isDark ? "text-white" : "text-slate-900")}>
                            {u.name.split(' ')[0]}
                          </span>
                          <button
                            onClick={() => handleUserToggle(id)}
                            className="hover:text-red-500 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-8 flex-1 overflow-y-auto custom-scrollbar pb-6 min-h-0">
              <p className={cn(
                "text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2",
                isDark ? "text-slate-400" : "text-slate-500"
              )}>
                <span className="h-1 w-1 rounded-full bg-green-500" />
                Select Team Members to invite
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredUsers.map((u) => {
                  const isSelected = selectedUsers.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleUserToggle(u.id)}
                      className={cn(
                        "flex items-center p-3 rounded-2xl cursor-pointer transition-all duration-300 border group",
                        isSelected
                          ? "bg-green-500/10 border-green-500/30 shadow-[0_0_20px_-5px_rgba(34,197,94,0.15)]"
                          : isDark ? "bg-slate-800/40 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/60" : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-lg hover:shadow-black/[0.03]"
                      )}
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar className={cn(
                          "h-10 w-10 border-2 transition-transform duration-300 group-active:scale-95",
                          isSelected ? "border-green-500/50 shadow-md shadow-green-500/10" : "border-white dark:border-slate-800"
                        )}>
                          <AvatarImage src={u.profilePhoto} />
                          <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-[10px] font-bold uppercase">
                            {u.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white dark:border-[#0f172a] flex items-center justify-center animate-in zoom-in duration-200">
                            <Plus className="h-2 w-2 text-white rotate-45" />
                          </div>
                        )}
                      </div>
                      <div className="ml-3 flex-1 min-w-0">
                        <p className={cn("text-xs font-bold truncate", isSelected ? "text-green-600 dark:text-green-500" : isDark ? "text-white" : "text-slate-900")}>
                          {u.name}
                        </p>
                        <p className={cn("text-[9px] font-medium transition-colors truncate opacity-60", isDark ? "text-slate-400" : "text-slate-500")}>
                          {u.designation}
                        </p>
                      </div>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleUserToggle(u.id)}
                        className={cn(
                          "ml-2 rounded-md transition-all duration-300",
                          isSelected ? "bg-green-500 border-green-500" : "opacity-40"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={cn(
              "p-8 border-t bg-gradient-to-b",
              isDark ? "from-slate-900 to-[#0f172a] border-slate-800" : "from-white to-gray-50 border-slate-100"
            )}>
              {groupNameError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 animate-in slide-in-from-top-2 fade-in duration-300">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <p className="text-xs font-bold text-red-600 dark:text-red-400">
                      {groupNameError}. Please choose a different name.
                    </p>
                  </div>
                </div>
              )}
              <Button
                onClick={handleCreateGroupChat}
                disabled={selectedUsers.length === 0 || !groupName.trim() || isCreating || !!groupNameError}
                className={cn(
                  "w-full h-14 text-white font-black rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                  groupNameError
                    ? "bg-red-500 hover:bg-red-600 shadow-red-500/20"
                    : "bg-green-500 hover:bg-green-600 shadow-green-500/20"
                )}
              >
                {isCreating ? "Initializing..." : groupNameError ? "Name Already Taken" : `Create Group Chat`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AddChatModal;
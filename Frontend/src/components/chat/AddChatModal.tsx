import React, { useState, useEffect } from 'react';
import { X, Users, MessageCircle, Search, Hash, Plus } from 'lucide-react';
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
}

const AddChatModal: React.FC<AddChatModalProps> = ({ isOpen, onClose, permissions }) => {
  const { availableUsers, createChat, loadAvailableUsers } = useChat();
  const { user } = useAuth();
  const { toast } = useToast();
  const { themeMode } = useTheme();
  const [activeTab, setActiveTab] = useState('individual');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    if (isOpen) {
      loadAvailableUsers();
      setSelectedUsers([]);
      setGroupName('');
      setGroupDescription('');
      setSearchTerm('');
    }
  }, [isOpen, loadAvailableUsers]);

  const filteredUsers = availableUsers.filter(u => {
    if (u.id === user?.id) return false;
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department.toLowerCase().includes(searchTerm.toLowerCase());
    const hasPermission = permissions?.canChatWith.includes(u.role) || false;
    return matchesSearch && hasPermission;
  });

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const handleCreateIndividualChat = async (userId: string) => {
    setIsCreating(true);
    try {
      await createChat('individual', [userId]);
      onClose();
    } catch (error) {
      console.error('Failed to create individual chat:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateGroupChat = async () => {
    if (selectedUsers.length === 0 || !groupName.trim()) return;
    setIsCreating(true);
    try {
      await createChat('group', selectedUsers, groupName, groupDescription);
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 overflow-hidden">
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
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "pl-12 pr-4 py-6 border-0 rounded-2xl font-medium focus-visible:ring-2 focus-visible:ring-green-500/30 transition-all shadow-inner",
                  isDark ? "bg-slate-800/40 text-white placeholder:text-slate-500" : "bg-gray-100 text-slate-900 placeholder:text-slate-400"
                )}
              />
            </div>
          </div>

          <TabsContent value="individual" className="mt-0 flex-1 overflow-hidden">
            <div className="px-8 h-full overflow-y-auto custom-scrollbar pb-8">
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 opacity-50">
                  <div className="p-6 rounded-3xl bg-slate-100 dark:bg-slate-800 mb-4">
                    <Users className="h-10 w-10" />
                  </div>
                  <p className="font-bold">No teammates found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((u, i) => (
                    <div
                      key={u.id}
                      onClick={() => handleCreateIndividualChat(u.id)}
                      className={cn(
                        "flex items-center p-4 rounded-3xl cursor-pointer transition-all duration-300 border border-transparent hover:shadow-xl hover:shadow-black/5 active:scale-[0.98]",
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
                      <div className="h-9 w-9 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <MessageCircle className="h-4 w-4" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="group" className="mt-0 flex-1 overflow-hidden flex flex-col">
            <div className="px-8 pb-4 flex-shrink-0">
              <div className={cn(
                "p-5 rounded-3xl space-y-4 border shadow-sm",
                isDark ? "bg-slate-800/30 border-slate-700" : "bg-gray-50 border-slate-100"
              )}>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  <Input
                    placeholder="Team Group Name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className={cn(
                      "pl-10 h-12 border-0 rounded-xl focus-visible:ring-1 focus-visible:ring-green-500/50 shadow-sm",
                      isDark ? "bg-slate-800" : "bg-white"
                    )}
                  />
                </div>
                <Input
                  placeholder="What is this group for?"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  className={cn(
                    "h-12 border-0 rounded-xl focus-visible:ring-1 focus-visible:ring-green-500/50 shadow-sm",
                    isDark ? "bg-slate-800" : "bg-white"
                  )}
                />
              </div>
            </div>

            <div className="px-8 flex-1 overflow-y-auto custom-scrollbar pb-6">
              <p className={cn("text-[10px] font-black uppercase tracking-widest mb-3 opacity-60", isDark ? "text-slate-400" : "text-slate-500")}>
                Select Team Members ({selectedUsers.length})
              </p>
              <div className="grid grid-cols-1 gap-2">
                {filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => handleUserToggle(u.id)}
                    className={cn(
                      "flex items-center p-3 rounded-2xl cursor-pointer transition-all duration-200 border group",
                      selectedUsers.includes(u.id)
                        ? "bg-green-500/10 border-green-500/20"
                        : isDark ? "hover:bg-slate-800/50 border-transparent" : "hover:bg-gray-50 border-transparent"
                    )}
                  >
                    <Checkbox
                      checked={selectedUsers.includes(u.id)}
                      onCheckedChange={() => handleUserToggle(u.id)}
                      className="mr-4 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 rounded-md"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Avatar className="h-9 w-9 border-2 border-white dark:border-slate-800 shadow-sm">
                      <AvatarImage src={u.profilePhoto} />
                      <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-[10px] font-bold">
                        {u.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="ml-3">
                      <p className={cn("text-sm font-bold truncate", isDark ? "text-white" : "text-white")}>{u.name}</p>
                      <p className={cn("text-[10px] opacity-60 font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                        {u.designation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={cn(
              "p-8 border-t bg-gradient-to-b",
              isDark ? "from-slate-900 to-[#0f172a] border-slate-800" : "from-white to-gray-50 border-slate-100"
            )}>
              <Button
                onClick={handleCreateGroupChat}
                disabled={selectedUsers.length === 0 || !groupName.trim() || isCreating}
                className="w-full h-14 bg-green-500 hover:bg-green-600 text-white font-black rounded-2xl shadow-xl shadow-green-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {isCreating ? "Initializing..." : `Create Group Chat`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AddChatModal;
import React, { useState, useEffect } from 'react';
import { X, Users, MessageCircle, Search } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('individual');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAvailableUsers();
      setSelectedUsers([]);
      setGroupName('');
      setGroupDescription('');
      setSearchTerm('');
    }
  }, [isOpen, loadAvailableUsers]);

  // Filter users based on role permissions and search term
  const filteredUsers = availableUsers.filter(u => {
    if (u.id === user?.id) return false; // Don't show current user
    
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.department.toLowerCase().includes(searchTerm.toLowerCase());
    
    const hasPermission = permissions?.canChatWith.includes(u.role) || false;
    
    return matchesSearch && hasPermission;
  });

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateIndividualChat = async (userId: string) => {
    setIsCreating(true);
    try {
      const chat = await createChat('individual', [userId]);
      onClose();
      toast({
        title: 'Success',
        description: 'Chat created successfully',
      });
    } catch (error) {
      console.error('Failed to create individual chat:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateGroupChat = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one user',
        variant: 'destructive',
      });
      return;
    }

    if (!groupName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a group name',
        variant: 'destructive',
      });
      return;
    }

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-auto shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-500/20 rounded-xl border border-green-500/30">
              <MessageCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Start New Chat</h2>
              <p className="text-sm text-gray-600">Connect with your colleagues</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="h-10 w-10 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 overflow-hidden">
          <div className="px-6 pt-4 flex-shrink-0">
            <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 rounded-xl">
              <TabsTrigger 
                value="individual" 
                className="flex items-center space-x-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-gray-700 data-[state=active]:text-gray-900"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="font-medium">Individual</span>
              </TabsTrigger>
              <TabsTrigger 
                value="group" 
                disabled={!permissions?.canCreateGroups}
                className="flex items-center space-x-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-gray-700 data-[state=active]:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Users className="h-4 w-4" />
                <span className="font-medium">Group</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Search */}
          <div className="px-6 py-4 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name, email, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 py-3 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900 placeholder:text-gray-500"
              />
            </div>
          </div>

          <TabsContent value="individual" className="mt-0 flex-1 overflow-hidden">
            <div className="px-6 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <div className="p-4 bg-gray-100 rounded-full mb-4">
                    <Users className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-lg font-medium">No users found</p>
                  <p className="text-sm text-center">Try adjusting your search or check your permissions</p>
                </div>
              ) : (
                <div className="space-y-1 pb-4">
                  {filteredUsers.map((user, index) => (
                    <div
                      key={user.id}
                      onClick={() => handleCreateIndividualChat(user.id)}
                      className="flex items-center p-4 rounded-xl hover:bg-gray-50 cursor-pointer transition-all duration-200 hover:shadow-sm group"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12 border-2 border-white shadow-md">
                          <AvatarImage src={user.profilePhoto} />
                          <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold">
                            {user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 border-2 border-white rounded-full"></div>
                      </div>
                      <div className="ml-4 flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate group-hover:text-green-600 transition-colors">
                          {user.name}
                        </p>
                        <p className="text-sm text-gray-600 truncate">
                          {user.designation}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {user.department}
                        </p>
                      </div>
                      <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="p-2 bg-green-100 rounded-full">
                          <MessageCircle className="h-4 w-4 text-green-600" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="group" className="mt-0 flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {/* Group Details */}
              <div className="px-6 pt-4 pb-4">
                <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Group Name *</label>
                    <Input
                      placeholder="Enter group name..."
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                    <Input
                      placeholder="What's this group about?"
                      value={groupDescription}
                      onChange={(e) => setGroupDescription(e.target.value)}
                      className="border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder:text-gray-500"
                    />
                  </div>
                </div>
              </div>

              {/* Selected Users Preview */}
              {selectedUsers.length > 0 && (
                <div className="px-6 pb-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-sm font-medium text-green-800 mb-2">
                      Selected Members ({selectedUsers.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedUsers.slice(0, 5).map(userId => {
                        const selectedUser = filteredUsers.find(u => u.id === userId);
                        return selectedUser ? (
                          <div key={userId} className="flex items-center bg-white rounded-full px-3 py-1 text-sm border border-green-200">
                            <Avatar className="h-6 w-6 mr-2">
                              <AvatarFallback className="bg-green-100 text-green-600 text-xs font-semibold">
                                {selectedUser.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-gray-700">{selectedUser.name}</span>
                          </div>
                        ) : null;
                      })}
                      {selectedUsers.length > 5 && (
                        <div className="flex items-center bg-white rounded-full px-3 py-1 text-sm text-gray-600 border border-gray-200">
                          +{selectedUsers.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* User Selection */}
              <div className="px-6 pb-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Select Members</p>
                {filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <div className="p-4 bg-gray-100 rounded-full mb-4">
                      <Users className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-lg font-medium">No users found</p>
                    <p className="text-sm text-center">Try adjusting your search or check your permissions</p>
                  </div>
                ) : (
                  <div className="space-y-1 border border-gray-200 rounded-lg p-2 bg-white max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    {filteredUsers.map((user, index) => (
                      <div 
                        key={user.id} 
                        className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-all duration-200 group cursor-pointer"
                        onClick={() => handleUserToggle(user.id)}
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => handleUserToggle(user.id)}
                          className="mr-4 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                        />
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                          <AvatarImage src={user.profilePhoto} />
                          <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold text-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="ml-3 flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate group-hover:text-green-600 transition-colors">
                            {user.name}
                          </p>
                          <p className="text-sm text-gray-600 truncate">
                            {user.designation} • {user.department}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Create Group Button */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <Button
                onClick={handleCreateGroupChat}
                disabled={selectedUsers.length === 0 || !groupName.trim() || isCreating}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Creating Group...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>Create Group ({selectedUsers.length} members)</span>
                  </div>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AddChatModal;
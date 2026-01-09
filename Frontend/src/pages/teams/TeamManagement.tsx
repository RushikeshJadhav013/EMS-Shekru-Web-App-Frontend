import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { formatTimeIST, formatDateIST } from '@/utils/timezone';
import V2Overlay from '@/components/ui/V2Overlay';
import {
  Users,
  Plus,
  MessageSquare,
  UserPlus,
  UserMinus,
  Send,
  FileText,
  Calendar,
  Target,
  TrendingUp,
  Clock
} from 'lucide-react';

interface Team {
  id: string;
  name: string;
  leadId: string;
  leadName: string;
  members: TeamMember[];
  createdAt: Date;
  description: string;
  department: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  avatar?: string;
  joinedAt: Date;
  status: 'active' | 'inactive';
}

interface TeamMessage {
  id: string;
  teamId: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'update' | 'announcement';
}

export default function TeamManagement() {
  const { user } = useAuth();
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [messageInput, setMessageInput] = useState('');

  const [teams, setTeams] = useState<Team[]>([
    {
      id: '1',
      name: 'Development Team Alpha',
      leadId: user?.id || '1',
      leadName: user?.name || 'Current Team Lead',
      members: [
        {
          id: '101',
          name: 'Alice Johnson',
          role: 'Frontend Developer',
          email: 'alice@company.com',
          joinedAt: new Date(2024, 0, 1),
          status: 'active'
        },
        {
          id: '102',
          name: 'Bob Smith',
          role: 'Backend Developer',
          email: 'bob@company.com',
          joinedAt: new Date(2024, 0, 5),
          status: 'active'
        },
        {
          id: '103',
          name: 'Carol White',
          role: 'QA Engineer',
          email: 'carol@company.com',
          joinedAt: new Date(2024, 0, 10),
          status: 'active'
        }
      ],
      createdAt: new Date(2024, 0, 1),
      description: 'Main development team for Product A',
      department: 'Engineering'
    }
  ]);

  const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([
    {
      id: '1',
      teamId: '1',
      senderId: user?.id || '1',
      senderName: user?.name || 'Team Lead',
      message: 'Welcome to the team chat! Feel free to share updates and collaborate here.',
      timestamp: new Date(2024, 0, 15, 9, 0),
      type: 'announcement'
    },
    {
      id: '2',
      teamId: '1',
      senderId: '101',
      senderName: 'Alice Johnson',
      message: 'Just completed the new feature implementation. Ready for review.',
      timestamp: new Date(2024, 0, 15, 10, 30),
      type: 'update'
    }
  ]);

  const [newTeamData, setNewTeamData] = useState({
    name: '',
    description: '',
    department: ''
  });

  const [availableEmployees] = useState([
    { id: '104', name: 'David Brown', role: 'Developer', email: 'david@company.com' },
    { id: '105', name: 'Emma Davis', role: 'Designer', email: 'emma@company.com' },
    { id: '106', name: 'Frank Wilson', role: 'DevOps', email: 'frank@company.com' },
    { id: '107', name: 'Grace Lee', role: 'Analyst', email: 'grace@company.com' }
  ]);

  const handleCreateTeam = () => {
    if (!newTeamData.name || !newTeamData.department) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    const newTeam: Team = {
      id: Date.now().toString(),
      name: newTeamData.name,
      leadId: user?.id || '',
      leadName: user?.name || '',
      members: [],
      createdAt: new Date(),
      description: newTeamData.description,
      department: newTeamData.department
    };

    setTeams([...teams, newTeam]);
    setIsCreateTeamOpen(false);
    setNewTeamData({ name: '', description: '', department: '' });
    toast({
      title: 'Success',
      description: 'Team created successfully'
    });
  };

  const handleAddMember = (teamId: string, employeeId: string) => {
    const employee = availableEmployees.find(e => e.id === employeeId);
    if (!employee) return;

    const newMember: TeamMember = {
      id: employee.id,
      name: employee.name,
      role: employee.role,
      email: employee.email,
      joinedAt: new Date(),
      status: 'active'
    };

    setTeams(teams.map(team =>
      team.id === teamId
        ? { ...team, members: [...team.members, newMember] }
        : team
    ));

    toast({
      title: 'Success',
      description: `${employee.name} added to the team`
    });
  };

  const handleRemoveMember = (teamId: string, memberId: string) => {
    setTeams(teams.map(team =>
      team.id === teamId
        ? { ...team, members: team.members.filter(m => m.id !== memberId) }
        : team
    ));

    toast({
      title: 'Success',
      description: 'Member removed from the team'
    });
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedTeam) return;

    const newMessage: TeamMessage = {
      id: Date.now().toString(),
      teamId: selectedTeam.id,
      senderId: user?.id || '',
      senderName: user?.name || '',
      message: messageInput,
      timestamp: new Date(),
      type: 'message'
    };

    setTeamMessages([...teamMessages, newMessage]);
    setMessageInput('');
  };

  const getMessageTypeStyle = (type: string) => {
    switch (type) {
      case 'announcement': return 'bg-blue-50 border-blue-200';
      case 'update': return 'bg-green-50 border-green-200';
      default: return 'bg-background';
    }
  };

  // Only Team Leads and Managers can access this module
  if (!['team_lead', 'manager'].includes(user?.role || '')) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Restricted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Only Team Leads and Managers can access the Teams module.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {user?.role === 'manager' && <V2Overlay fallbackPath="/manager" />}
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Team Management</h1>
        {/* Team Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Teams</p>
                  <p className="text-2xl font-bold">{teams.length}</p>
                </div>
                <Users className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Members</p>
                  <p className="text-2xl font-bold">
                    {teams.reduce((acc, team) => acc + team.members.length, 0)}
                  </p>
                </div>
                <UserPlus className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Projects</p>
                  <p className="text-2xl font-bold">5</p>
                </div>
                <Target className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Team Performance</p>
                  <p className="text-2xl font-bold">92%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="teams" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="teams">My Teams</TabsTrigger>
            <TabsTrigger value="chat">Team Chat</TabsTrigger>
            <TabsTrigger value="updates">Work Updates</TabsTrigger>
          </TabsList>

          <TabsContent value="teams" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Team Management</h2>
              <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Team
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Team</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Team Name</Label>
                      <Input
                        value={newTeamData.name}
                        onChange={(e) => setNewTeamData({ ...newTeamData, name: e.target.value })}
                        placeholder="Enter team name"
                      />
                    </div>
                    <div>
                      <Label>Department</Label>
                      <Input
                        value={newTeamData.department}
                        onChange={(e) => setNewTeamData({ ...newTeamData, department: e.target.value })}
                        placeholder="Enter department"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={newTeamData.description}
                        onChange={(e) => setNewTeamData({ ...newTeamData, description: e.target.value })}
                        placeholder="Enter team description"
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateTeamOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateTeam}>Create Team</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teams.map((team) => (
                <Card key={team.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{team.name}</CardTitle>
                      <Badge>{team.department}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{team.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Team Members ({team.members.length})</span>
                        <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add Team Member</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              {availableEmployees
                                .filter(emp => !team.members.find(m => m.id === emp.id))
                                .map((employee) => (
                                  <div key={employee.id} className="flex items-center justify-between p-2 border rounded">
                                    <div>
                                      <p className="font-medium">{employee.name}</p>
                                      <p className="text-sm text-muted-foreground">{employee.role}</p>
                                    </div>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        handleAddMember(team.id, employee.id);
                                        setIsAddMemberOpen(false);
                                      }}
                                    >
                                      Add
                                    </Button>
                                  </div>
                                ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>

                      <div className="space-y-2">
                        {team.members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={member.avatar} />
                                <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{member.name}</p>
                                <p className="text-xs text-muted-foreground">{member.role}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveMember(team.id, member.id)}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => setSelectedTeam(team)}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Open Team Chat
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="chat">
            {selectedTeam ? (
              <Card className="h-[600px] flex flex-col">
                <CardHeader>
                  <CardTitle>{selectedTeam.name} - Team Chat</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ScrollArea className="flex-1 pr-4 mb-4">
                    <div className="space-y-4">
                      {teamMessages
                        .filter(msg => msg.teamId === selectedTeam.id)
                        .map((message) => (
                          <div
                            key={message.id}
                            className={`p-3 rounded-lg border ${getMessageTypeStyle(message.type)}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{message.senderName}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatTimeIST(message.timestamp, 'HH:mm')}
                              </span>
                            </div>
                            <p className="text-sm">{message.message}</p>
                            {message.type !== 'message' && (
                              <Badge className="mt-2" variant="outline">
                                {message.type}
                              </Badge>
                            )}
                          </div>
                        ))}
                    </div>
                  </ScrollArea>

                  <div className="flex gap-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Type your message..."
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <Button onClick={handleSendMessage}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">Select a team to view chat</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="updates">
            <Card>
              <CardHeader>
                <CardTitle>Post Work Update</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    placeholder="Share your work update with the team..."
                    rows={4}
                  />
                  <Button>
                    <FileText className="h-4 w-4 mr-2" />
                    Post Update
                  </Button>
                </div>

                <div className="mt-6 space-y-4">
                  <h3 className="font-semibold">Recent Updates</h3>
                  {teamMessages
                    .filter(msg => msg.type === 'update')
                    .map((update) => (
                      <div key={update.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{update.senderName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{update.senderName}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateIST(update.timestamp, 'MMM dd, yyyy')}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline">Update</Badge>
                        </div>
                        <p className="text-sm">{update.message}</p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
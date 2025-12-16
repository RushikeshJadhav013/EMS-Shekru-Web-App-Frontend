import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Users, Shield, Zap } from 'lucide-react';

const ChatDemo: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          WhatsApp-like Chat Feature
        </h1>
        <p className="text-lg text-gray-600">
          Comprehensive messaging system with role-based permissions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Individual Chats</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              One-to-one conversations with colleagues based on role permissions
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">Group Chats</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Create team groups for project discussions and collaboration
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-lg">Role-Based Access</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Secure messaging with department and hierarchy-based permissions
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-lg">Real-time Features</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Instant messaging with read receipts and online status
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>
            Chat access is controlled based on user roles and department hierarchy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div>
                <Badge variant="destructive" className="mb-1">Admin</Badge>
                <p className="text-sm text-gray-600">Can chat with all users across all departments</p>
              </div>
              <Badge className="bg-green-500">Can Create Groups</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div>
                <Badge className="bg-blue-600 mb-1">HR</Badge>
                <p className="text-sm text-gray-600">Can chat with all users across all departments</p>
              </div>
              <Badge className="bg-green-500">Can Create Groups</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div>
                <Badge className="bg-purple-600 mb-1">Manager</Badge>
                <p className="text-sm text-gray-600">Can chat with Admin, HR, and their department team</p>
              </div>
              <Badge className="bg-green-500">Can Create Groups</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div>
                <Badge className="bg-orange-600 mb-1">Team Lead</Badge>
                <p className="text-sm text-gray-600">Can chat with Admin, HR, Manager, and department colleagues</p>
              </div>
              <Badge className="bg-green-500">Can Create Groups</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Badge variant="secondary" className="mb-1">Employee</Badge>
                <p className="text-sm text-gray-600">Can chat with Admin, HR, Manager, Team Lead, and department colleagues</p>
              </div>
              <Badge variant="outline">View Only</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features Implemented</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-green-700">✅ Completed</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• WhatsApp-like UI design</li>
                <li>• Individual and group chats</li>
                <li>• Role-based permissions</li>
                <li>• Text messaging</li>
                <li>• Emoji support</li>
                <li>• Message timestamps</li>
                <li>• Read/unread indicators</li>
                <li>• Reply to messages</li>
                <li>• Message editing/deletion</li>
                <li>• Responsive design</li>
                <li>• Sidebar integration</li>
                <li>• Unread count badges</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-blue-700">🔄 Ready for Backend</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• API service layer</li>
                <li>• Mock data for testing</li>
                <li>• Error handling</li>
                <li>• State management</li>
                <li>• Authentication headers</li>
                <li>• File upload structure</li>
                <li>• Real-time WebSocket ready</li>
                <li>• Push notification hooks</li>
                <li>• Database schema suggestions</li>
                <li>• Security considerations</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Ready for Integration
        </h3>
        <p className="text-gray-600 mb-4">
          The chat feature is fully implemented on the frontend and ready for backend API integration.
          Navigate to any role dashboard and click "Chat" in the sidebar to explore the functionality.
        </p>
        <Badge className="bg-green-500 text-white px-4 py-2">
          Frontend Complete ✅
        </Badge>
      </div>
    </div>
  );
};

export default ChatDemo;
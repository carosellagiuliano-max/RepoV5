/**
 * Role Management Component
 * Admin interface for managing user roles and permissions
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, UserPlus, Shield, Users, Settings, Eye, EyeOff } from 'lucide-react'
import { UserRole } from '@/lib/types/database'
import { useToast } from '@/hooks/use-toast'

interface UserProfile {
  id: string
  email: string
  role: UserRole
  first_name: string | null
  last_name: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface RolePermission {
  resource: string
  can_read: boolean
  can_create: boolean
  can_update: boolean
  can_delete: boolean
}

interface RoleAssignmentProps {
  onRoleChange?: (userId: string, newRole: UserRole) => void
}

const ROLE_DESCRIPTIONS = {
  admin: 'Full system access including user management and system configuration',
  staff: 'Service provider with access to assigned appointments and own schedule',
  receptionist: 'Front desk operations with appointment and customer management',
  customer: 'Self-service access to own profile and appointments'
}

const ROLE_COLORS = {
  admin: 'destructive',
  staff: 'default',
  receptionist: 'secondary',
  customer: 'outline'
} as const

export function RoleManagement({ onRoleChange }: RoleAssignmentProps) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [newRole, setNewRole] = useState<UserRole>('customer')
  const [showPermissions, setShowPermissions] = useState(false)
  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, RolePermission[]>>({} as any)
  const { toast } = useToast()

  // Fetch users data
  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      
      const data = await response.json()
      setUsers(data.data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch users'
      })
    } finally {
      setLoading(false)
    }
  }

  // Fetch role permissions matrix
  const fetchRolePermissions = async () => {
    try {
      const response = await fetch('/api/admin/role-permissions', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setRolePermissions(data.data || {})
      }
    } catch (error) {
      console.error('Error fetching role permissions:', error)
    }
  }

  // Update user role
  const updateUserRole = async (userId: string, role: UserRole) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ role })
      })

      if (!response.ok) {
        throw new Error('Failed to update user role')
      }

      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role } : user
      ))

      toast({
        title: 'Success',
        description: `User role updated to ${role}`
      })

      onRoleChange?.(userId, role)
      setSelectedUser(null)
    } catch (error) {
      console.error('Error updating user role:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update user role'
      })
    }
  }

  // Filter users based on search and role
  useEffect(() => {
    let filtered = users

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedRole !== 'all') {
      filtered = filtered.filter(user => user.role === selectedRole)
    }

    setFilteredUsers(filtered)
  }, [users, searchTerm, selectedRole])

  useEffect(() => {
    fetchUsers()
    fetchRolePermissions()
  }, [])

  const formatUserName = (user: UserProfile) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim()
    }
    return user.email
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Management
          </CardTitle>
          <CardDescription>
            Manage user roles and permissions across the system
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Permissions Matrix
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search">Search Users</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by email or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="role-filter">Filter by Role</Label>
              <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole | 'all')}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="receptionist">Receptionist</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Users Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Loading users...
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {formatUserName(user)}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={ROLE_COLORS[user.role]}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? 'default' : 'secondary'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(user)
                                  setNewRole(user.role)
                                }}
                              >
                                Change Role
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Change User Role</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Change the role for {formatUserName(user)} ({user.email})
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="new-role">New Role</Label>
                                  <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="staff">Staff</SelectItem>
                                      <SelectItem value="receptionist">Receptionist</SelectItem>
                                      <SelectItem value="customer">Customer</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="p-3 bg-muted rounded-md">
                                  <p className="text-sm text-muted-foreground">
                                    {ROLE_DESCRIPTIONS[newRole]}
                                  </p>
                                </div>
                              </div>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => selectedUser && updateUserRole(selectedUser.id, newRole)}
                                >
                                  Update Role
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions Matrix</CardTitle>
              <CardDescription>
                Overview of what each role can access and modify
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => (
                  <div key={role} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge variant={ROLE_COLORS[role as UserRole]} className="text-base px-3 py-1">
                        {role}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{description}</span>
                    </div>
                    
                    {rolePermissions[role as UserRole] && (
                      <div className="ml-6">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Resource</TableHead>
                              <TableHead>Read</TableHead>
                              <TableHead>Create</TableHead>
                              <TableHead>Update</TableHead>
                              <TableHead>Delete</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rolePermissions[role as UserRole].map((permission) => (
                              <TableRow key={permission.resource}>
                                <TableCell className="font-medium">{permission.resource}</TableCell>
                                <TableCell>
                                  {permission.can_read ? (
                                    <Badge variant="default">✓</Badge>
                                  ) : (
                                    <Badge variant="secondary">✗</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {permission.can_create ? (
                                    <Badge variant="default">✓</Badge>
                                  ) : (
                                    <Badge variant="secondary">✗</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {permission.can_update ? (
                                    <Badge variant="default">✓</Badge>
                                  ) : (
                                    <Badge variant="secondary">✗</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {permission.can_delete ? (
                                    <Badge variant="default">✓</Badge>
                                  ) : (
                                    <Badge variant="secondary">✗</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
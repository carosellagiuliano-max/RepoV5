/**
 * Calendar Management Page for Admin
 * Allows admins to create and manage calendar tokens for staff
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { CalendarDays, Copy, ExternalLink, Plus, Trash2, RefreshCw, Link, Unlink, Sync } from 'lucide-react'

interface CalendarToken {
  id: string
  staff_id: string
  feed_type: 'ical' | 'google'
  is_active: boolean
  expires_at: string | null
  last_accessed_at: string | null
  created_at: string
  staff: {
    staff_with_profiles: {
      first_name: string
      last_name: string
      email: string
    }
  }
  feed_url?: string | null
  is_expired?: boolean
}

interface Staff {
  id: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
}

interface GoogleCalendarStatus {
  connected: boolean
  sync_enabled: boolean
  last_sync_at: string | null
  calendar_id?: string
}

interface SyncResult {
  success: boolean
  eventsCreated: number
  eventsUpdated: number
  eventsDeleted: number
  errors: string[]
}

export default function CalendarManagementPage() {
  const [tokens, setTokens] = useState<CalendarToken[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [googleStatuses, setGoogleStatuses] = useState<Map<string, GoogleCalendarStatus>>(new Map())
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [syncing, setSyncing] = useState<Set<string>>(new Set())
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [feedType, setFeedType] = useState<'ical' | 'google'>('ical')
  const [expiresHours, setExpiresHours] = useState<string>('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newTokenData, setNewTokenData] = useState<{ token: string; feed_url: string } | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch calendar tokens
      const tokensResponse = await fetch('/.netlify/functions/calendar/tokens', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      })
      
      if (tokensResponse.ok) {
        const tokensData = await tokensResponse.json()
        setTokens(tokensData.tokens || [])
      }

      // Fetch staff list
      const staffResponse = await fetch('/.netlify/functions/admin/staff', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      })
      
      if (staffResponse.ok) {
        const staffData = await staffResponse.json()
        setStaff(staffData.staff || [])
        
        // Fetch Google Calendar statuses for each staff member
        const statuses = new Map<string, GoogleCalendarStatus>()
        await Promise.all(staffData.staff.map(async (staffMember: Staff) => {
          try {
            const statusResponse = await fetch(`/.netlify/functions/calendar/google/sync?staff_id=${staffMember.id}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
              }
            })
            
            if (statusResponse.ok) {
              const status = await statusResponse.json()
              statuses.set(staffMember.id, status)
            } else {
              statuses.set(staffMember.id, {
                connected: false,
                sync_enabled: false,
                last_sync_at: null
              })
            }
          } catch (error) {
            console.error(`Error fetching Google status for ${staffMember.id}:`, error)
            statuses.set(staffMember.id, {
              connected: false,
              sync_enabled: false,
              last_sync_at: null
            })
          }
        }))
        
        setGoogleStatuses(statuses)
      }
      
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load calendar data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateToken = async () => {
    if (!selectedStaffId) {
      toast({
        title: 'Error',
        description: 'Please select a staff member',
        variant: 'destructive'
      })
      return
    }

    try {
      setCreating(true)
      
      const payload: {
        staff_id: string
        feed_type: 'ical' | 'google'
        expires_hours?: number
      } = {
        staff_id: selectedStaffId,
        feed_type: feedType
      }
      
      if (expiresHours) {
        payload.expires_hours = parseInt(expiresHours, 10)
      }

      const response = await fetch('/.netlify/functions/calendar/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const result = await response.json()
        setNewTokenData({
          token: result.token,
          feed_url: result.feed_url
        })
        
        toast({
          title: 'Success',
          description: `${feedType.toUpperCase()} calendar token created successfully`
        })
        
        // Reset form
        setSelectedStaffId('')
        setFeedType('ical')
        setExpiresHours('')
        
        // Refresh data
        fetchData()
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to create calendar token',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error creating token:', error)
      toast({
        title: 'Error',
        description: 'Failed to create calendar token',
        variant: 'destructive'
      })
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteToken = async (tokenId: string) => {
    try {
      const response = await fetch(`/.netlify/functions/calendar/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Calendar token deactivated successfully'
        })
        fetchData()
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to deactivate token',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error deleting token:', error)
      toast({
        title: 'Error',
        description: 'Failed to deactivate token',
        variant: 'destructive'
      })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied',
      description: 'URL copied to clipboard'
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStaffName = (token: CalendarToken) => {
    const staffProfile = token.staff?.staff_with_profiles
    return staffProfile ? `${staffProfile.first_name} ${staffProfile.last_name}` : 'Unknown'
  }

  const getTokenStatus = (token: CalendarToken) => {
    if (!token.is_active) return 'inactive'
    if (token.is_expired) return 'expired'
    return 'active'
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'inactive': return 'secondary'
      case 'expired': return 'destructive'
      default: return 'secondary'
    }
  }

  const handleConnectGoogle = async (staffId: string) => {
    try {
      const response = await fetch('/.netlify/functions/calendar/google/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify({ staff_id: staffId })
      })

      if (response.ok) {
        const result = await response.json()
        // Open OAuth URL in new window
        window.open(result.auth_url, '_blank', 'width=600,height=600')
        
        toast({
          title: 'Authorization Required',
          description: 'Please complete the authorization in the popup window'
        })
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to start Google Calendar connection',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error connecting Google Calendar:', error)
      toast({
        title: 'Error',
        description: 'Failed to connect Google Calendar',
        variant: 'destructive'
      })
    }
  }

  const handleDisconnectGoogle = async (staffId: string) => {
    try {
      const response = await fetch(`/.netlify/functions/calendar/google/connect/${staffId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Google Calendar disconnected successfully'
        })
        
        // Update status
        const newStatuses = new Map(googleStatuses)
        newStatuses.set(staffId, {
          connected: false,
          sync_enabled: false,
          last_sync_at: null
        })
        setGoogleStatuses(newStatuses)
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to disconnect Google Calendar',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error)
      toast({
        title: 'Error',
        description: 'Failed to disconnect Google Calendar',
        variant: 'destructive'
      })
    }
  }

  const handleSyncGoogle = async (staffId: string) => {
    try {
      setSyncing(prev => new Set([...prev, staffId]))
      
      const response = await fetch('/.netlify/functions/calendar/google/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify({ staff_id: staffId, direction: 'to_google' })
      })

      if (response.ok) {
        const result: SyncResult = await response.json()
        
        if (result.success) {
          toast({
            title: 'Sync Complete',
            description: `${result.eventsCreated} created, ${result.eventsUpdated} updated`
          })
        } else {
          toast({
            title: 'Sync Issues',
            description: `Sync completed with ${result.errors.length} errors`,
            variant: 'destructive'
          })
        }
        
        // Refresh status
        fetchData()
      } else {
        const error = await response.json()
        toast({
          title: 'Sync Failed',
          description: error.error || 'Failed to sync with Google Calendar',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error syncing Google Calendar:', error)
      toast({
        title: 'Error',
        description: 'Failed to sync Google Calendar',
        variant: 'destructive'
      })
    } finally {
      setSyncing(prev => {
        const newSet = new Set(prev)
        newSet.delete(staffId)
        return newSet
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar Integration</h1>
          <p className="text-muted-foreground">
            Manage calendar feeds and synchronization for staff members
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Token
        </Button>
      </div>

      <Tabs defaultValue="tokens" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tokens">Calendar Tokens</TabsTrigger>
          <TabsTrigger value="google">Google Calendar</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="tokens" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Calendar Tokens</CardTitle>
              <CardDescription>
                Manage calendar feed tokens for staff members. iCal tokens provide read-only access to appointment schedules.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tokens.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No calendar tokens found</h3>
                  <p className="text-muted-foreground mb-4">
                    Create calendar tokens to allow staff members to access their appointment schedules in external calendar applications.
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Token
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Accessed</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokens.map((token) => (
                      <TableRow key={token.id}>
                        <TableCell className="font-medium">
                          {getStaffName(token)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {token.feed_type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(getTokenStatus(token))}>
                            {getTokenStatus(token)}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(token.created_at)}</TableCell>
                        <TableCell>
                          {token.last_accessed_at ? formatDate(token.last_accessed_at) : 'Never'}
                        </TableCell>
                        <TableCell>
                          {token.expires_at ? formatDate(token.expires_at) : 'Never'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {token.feed_url && token.is_active && !token.is_expired && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(token.feed_url!)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteToken(token.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="google" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Google Calendar Integration</CardTitle>
              <CardDescription>
                Connect staff Google Calendar accounts for two-way synchronization. Appointments will be automatically synced to Google Calendar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Connection Status</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.filter(s => s.is_active).map((staffMember) => {
                    const googleStatus = googleStatuses.get(staffMember.id) || {
                      connected: false,
                      sync_enabled: false,
                      last_sync_at: null
                    }
                    
                    return (
                      <TableRow key={staffMember.id}>
                        <TableCell className="font-medium">
                          {staffMember.first_name} {staffMember.last_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Badge variant={googleStatus.connected ? 'default' : 'secondary'}>
                              {googleStatus.connected ? 'Connected' : 'Not Connected'}
                            </Badge>
                            {googleStatus.connected && (
                              <Badge variant={googleStatus.sync_enabled ? 'default' : 'secondary'} className="text-xs">
                                {googleStatus.sync_enabled ? 'Sync On' : 'Sync Off'}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {googleStatus.last_sync_at 
                            ? formatDate(googleStatus.last_sync_at)
                            : 'Never'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {googleStatus.connected ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSyncGoogle(staffMember.id)}
                                  disabled={syncing.has(staffMember.id)}
                                >
                                  {syncing.has(staffMember.id) ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Sync className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDisconnectGoogle(staffMember.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Unlink className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConnectGoogle(staffMember.id)}
                              >
                                <Link className="h-4 w-4 mr-2" />
                                Connect
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              
              {staff.filter(s => s.is_active).length === 0 && (
                <div className="text-center py-8">
                  <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No active staff members</h3>
                  <p className="text-muted-foreground">
                    Add active staff members to enable Google Calendar integration.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Google Calendar Setup</CardTitle>
              <CardDescription>
                Information about setting up Google Calendar integration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Required Setup Steps</h4>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>1. Create a Google Cloud Console project</p>
                  <p>2. Enable the Google Calendar API</p>
                  <p>3. Create OAuth 2.0 credentials</p>
                  <p>4. Configure environment variables</p>
                  <p>5. Set up the OAuth redirect URI</p>
                </div>
              </div>
              
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium">Required Scopes</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• https://www.googleapis.com/auth/calendar</p>
                  <p>• https://www.googleapis.com/auth/calendar.events</p>
                </div>
              </div>
              
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium">Security Notes</h4>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>• Google OAuth tokens are encrypted at rest</p>
                  <p>• Tokens are automatically refreshed when expired</p>
                  <p>• Only appointment data is synced, no personal information</p>
                  <p>• Staff can disconnect their calendar at any time</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Calendar Integration Settings</CardTitle>
              <CardDescription>
                Configure calendar integration and security settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Timezone</Label>
                  <Select defaultValue="Europe/Berlin">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Europe/Berlin">Europe/Berlin (CET/CEST)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST/EDT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Calendar Refresh Interval</Label>
                  <Select defaultValue="60">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium">Security Information</h4>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>• Calendar tokens are cryptographically secure and cannot be guessed</p>
                  <p>• All feed URLs use HTTPS for secure transmission</p>
                  <p>• Tokens can be set to expire automatically for enhanced security</p>
                  <p>• Access is logged and can be monitored for suspicious activity</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Token Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Calendar Token</DialogTitle>
            <DialogDescription>
              Generate a new calendar token for a staff member to access their appointment schedule.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="staff">Staff Member</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.filter(s => s.is_active).map((staffMember) => (
                    <SelectItem key={staffMember.id} value={staffMember.id}>
                      {staffMember.first_name} {staffMember.last_name} ({staffMember.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedType">Feed Type</Label>
              <Select value={feedType} onValueChange={(value: 'ical' | 'google') => setFeedType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ical">iCal Feed (Read-only)</SelectItem>
                  <SelectItem value="google" disabled={!process.env.GOOGLE_CALENDAR_CLIENT_ID}>
                    Google Calendar Sync {!process.env.GOOGLE_CALENDAR_CLIENT_ID && '(Not Configured)'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires">Expires After (hours, optional)</Label>
              <Input
                id="expires"
                type="number"
                placeholder="Leave empty for no expiration"
                value={expiresHours}
                onChange={(e) => setExpiresHours(e.target.value)}
                min="1"
                max="8760"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateToken} disabled={creating || !selectedStaffId}>
              {creating ? 'Creating...' : 'Create Token'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token Created Success Dialog */}
      <Dialog open={!!newTokenData} onOpenChange={() => setNewTokenData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calendar Token Created</DialogTitle>
            <DialogDescription>
              Your calendar token has been created successfully. Please copy the feed URL and provide it to the staff member.
            </DialogDescription>
          </DialogHeader>
          
          {newTokenData && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Feed URL</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    value={newTokenData.feed_url}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(newTokenData.feed_url)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Important:</strong> This URL contains a secret token and should be kept secure.</p>
                <p>The staff member can add this URL to any calendar application that supports iCal feeds.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setNewTokenData(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
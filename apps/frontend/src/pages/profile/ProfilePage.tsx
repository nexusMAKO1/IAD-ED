/**
 * pages/profile/ProfilePage.tsx — User Profile
 * SmartVision IAD Dashboard
 */

import React from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Key, LogOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function ProfilePage() {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <User className="h-6 w-6 text-primary" aria-hidden="true" />
            User Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account settings and preferences
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="md:col-span-1">
          <Card className="glass h-full">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-4 ring-2 ring-primary/40">
                <User className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Admin User</h2>
              <p className="text-sm text-muted-foreground mb-4">admin@express-display.com</p>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-6">
                <Shield className="h-3.5 w-3.5" /> Administrator
              </div>
              
              <Button variant="outline" className="w-full gap-2 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50 transition-colors">
                <LogOut className="h-4 w-4" /> Sign Out
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="md:col-span-2 space-y-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" /> Full Name
                </label>
                <input type="text" defaultValue="Admin User" className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" /> Email Address
                </label>
                <input type="email" defaultValue="admin@express-display.com" className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" disabled />
              </div>
              <Button className="mt-2">Update Profile</Button>
            </CardContent>
          </Card>

          <Card className="glass border-red-500/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-red-400">
                <Key className="h-5 w-5" /> Security
              </CardTitle>
              <CardDescription>Update your password and authentication methods</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="gap-2 border-red-500/20 text-red-400 hover:bg-red-500/10">
                Change Password
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

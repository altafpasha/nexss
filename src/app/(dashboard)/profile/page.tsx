'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2, User, Mail, Lock, Eye, EyeOff, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface UserProfile {
    id: string;
    username: string;
    email: string;
    rank: number;
    created_at: string;
}

export default function ProfilePage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // User settings state
    const [email, setEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/user');
            if (res.ok) {
                const data = await res.json();
                setProfile(data.user);
                setEmail(data.user.email || '');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate password confirmation
        if (newPassword && newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        // Validate password requirements
        if (newPassword && newPassword.length < 6) {
            setError('New password must be at least 6 characters');
            return;
        }

        setSaving(true);
        try {
            const payload: { email?: string; currentPassword?: string; newPassword?: string } = {};
            
            // Only send email if changed
            if (email !== profile?.email) {
                payload.email = email;
            }

            // Only send password if provided
            if (newPassword) {
                payload.currentPassword = currentPassword;
                payload.newPassword = newPassword;
            }

            // Skip if nothing to update
            if (Object.keys(payload).length === 0) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
                return;
            }

            const res = await fetch('/api/user', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
                // Clear password fields
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                // Refresh profile
                fetchProfile();
            } else {
                setError(data.error || 'Failed to update profile');
            }
        } catch {
            setError('Something went wrong');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in max-w-7xl mx-auto pb-10">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Profile</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                    Manage your account settings
                </p>
            </div>

            <form onSubmit={handleSave}>
                <Card className="border border-[#27272a] bg-[#18181c] text-white rounded-lg overflow-hidden">
                    <CardHeader className="pb-3 pt-4 px-4">
                        <div className="flex items-center gap-1.5">
                            <User className="w-4 h-4 text-emerald-500" />
                            <CardTitle className="text-white text-sm">User Profile</CardTitle>
                        </div>
                        <CardDescription className="text-muted-foreground text-sm">
                            Update your email and password
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 px-4 pb-4">
                        {/* Profile Header */}
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded bg-gradient-to-r from-purple-500 to-pink-500 p-[2px]">
                                <div className="w-full h-full rounded bg-[#18181c] flex items-center justify-center text-lg font-bold text-white">
                                    {profile?.username?.charAt(0).toUpperCase() || 'U'}
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <h3 className="text-base font-medium text-white">{profile?.username || 'User'}</h3>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs font-normal border-white/10 text-muted-foreground px-1.5 py-0">
                                        {profile?.rank === 3 ? 'Administrator' : 'User'}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                        Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <Separator className="bg-white/5" />

                        {/* Email Update */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5" />
                                Email Address
                            </label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                className="bg-[#09090b] border-white/5 text-white focus:border-emerald-500/50 focus:ring-emerald-500/20 h-9 text-sm"
                            />
                        </div>

                        <Separator className="bg-white/5" />

                        {/* Password Update */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-sm font-medium text-muted-foreground">Change Password</span>
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Current Password</label>
                                    <div className="relative">
                                        <Input
                                            type={showCurrentPassword ? 'text' : 'password'}
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="bg-[#09090b] border-white/5 text-white focus:border-emerald-500/50 focus:ring-emerald-500/20 h-9 text-sm pr-9"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                                        >
                                            {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">New Password</label>
                                    <div className="relative">
                                        <Input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="bg-[#09090b] border-white/5 text-white focus:border-emerald-500/50 focus:ring-emerald-500/20 h-9 text-sm pr-9"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                                        >
                                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Confirm New Password</label>
                                    <Input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="bg-[#09090b] border-white/5 text-white focus:border-emerald-500/50 focus:ring-emerald-500/20 h-9 text-sm"
                                    />
                                </div>
                            </div>

                            {newPassword && confirmPassword && newPassword !== confirmPassword && (
                                <p className="text-xs text-red-400">Passwords do not match</p>
                            )}
                        </div>

                        {error && (
                            <div className="text-sm text-red-400 bg-red-400/10 p-2.5 rounded text-center font-medium">
                                {error}
                            </div>
                        )}
                    </CardContent>
                    <div className="flex items-center justify-end px-4 py-3 border-t border-white/5 bg-white/[0.02]">
                        <Button type="submit" disabled={saving} className="min-w-[100px] bg-emerald-500 hover:bg-emerald-600 text-white rounded text-sm h-9">
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                                    Saving...
                                </>
                            ) : saved ? (
                                <>
                                    <Check className="w-4 h-4 mr-1.5" />
                                    Saved!
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-1.5" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </Card>
            </form>
        </div>
    );
}

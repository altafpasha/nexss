'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                router.push('/dashboard');
            } else {
                setError('Invalid credentials');
            }
        } catch (err) {
            setError('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#09090b] p-4 relative overflow-hidden">
            {/* Background Gradients for Premium Feel */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[128px]" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[128px]" />

            <Card className="w-full max-w-md border border-[#27272a] bg-[#18181c] shadow-2xl relative z-10 rounded-lg overflow-hidden">
                {/* Brand Header */}
                <div className="h-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 w-full" />

                <CardHeader className="text-center pt-8 pb-2 space-y-3">
                    <div className="mx-auto">
                        <Image
                            src="/nexss-favicon.png"
                            alt="NeXSS"
                            width={180}
                            height={48}
                            className="h-12 w-auto"
                            priority
                        />
                    </div>
                    <div>
                        <CardTitle className="text-xl font-bold text-white tracking-tight">Welcome Back</CardTitle>
                        <CardDescription className="text-muted-foreground text-sm">Sign in to your dashboard</CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Input
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="h-10 bg-[#09090b] border-white/5 text-white focus:border-indigo-500/50 focus:ring-indigo-500/20 rounded px-3 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-10 bg-[#09090b] border-white/5 text-white focus:border-indigo-500/50 focus:ring-indigo-500/20 rounded px-3 text-sm"
                            />
                        </div>

                        {error && (
                            <div className="text-sm text-red-400 bg-red-400/10 p-2.5 rounded text-center font-medium">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading || !username || !password}
                            className="w-full h-10 bg-white hover:bg-white/90 text-black font-semibold rounded text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    Sign In <ArrowRight className="w-4 h-4 ml-1.5" />
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-muted-foreground/50 uppercase tracking-widest font-medium">
                            Lightweight Blind XSS Listener
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

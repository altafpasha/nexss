'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { SettingsProvider } from '@/lib/settings-context';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <SettingsProvider>
            <div className="min-h-screen bg-muted/40">
                <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

                <div className="lg:ml-56 flex flex-col min-h-screen">
                    <Header setSidebarOpen={setSidebarOpen} />

                    <main className="flex-1 p-3 lg:p-6 overflow-auto">
                        <div className="mx-auto max-w-7xl animate-fade-in">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </SettingsProvider>
    );
}

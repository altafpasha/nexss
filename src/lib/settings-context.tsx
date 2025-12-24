'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface SettingsContextType {
    timezone: string;
    appName: string;
    formatDate: (date: Date | string) => string;
    formatDateTime: (date: Date | string) => string;
    refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [timezone, setTimezone] = useState<string>('UTC');
    const [appName, setAppName] = useState<string>('NeXSS');

    const fetchSettings = useCallback(async () => {
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const data = await res.json();
                setTimezone(data.settings.timezone || 'UTC');
                setAppName(data.settings.app_name || 'NeXSS');
            }
        } catch (e) {
            console.error('Failed to fetch settings:', e);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const formatDate = useCallback((date: Date | string): string => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: timezone,
        });
    }, [timezone]);

    const formatDateTime = useCallback((date: Date | string): string => {
        const d = new Date(date);
        return d.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: timezone,
            hour12: false,
        });
    }, [timezone]);

    const refreshSettings = useCallback(async () => {
        await fetchSettings();
    }, [fetchSettings]);

    return (
        <SettingsContext.Provider value={{ timezone, appName, formatDate, formatDateTime, refreshSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}

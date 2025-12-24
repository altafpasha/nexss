import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, timezone?: string): string {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone || 'UTC',
    });
}

export function formatDateWithTimezone(date: Date | string, timezone: string): string {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: timezone,
        timeZoneName: 'short',
    });
}

export function timeAgo(date: Date | string): string {
    const now = new Date();
    const d = new Date(date);
    const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return formatDate(date);
}

export function truncate(str: string, length: number): string {
    if (str.length <= length) return str;
    return str.slice(0, length) + '...';
}

export function getClientIP(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfIP = request.headers.get('cf-connecting-ip');

    if (cfIP) return cfIP;
    if (forwarded) return forwarded.split(',')[0].trim();
    if (realIP) return realIP;
    return 'unknown';
}

// Parse domain from URL
export function getDomainFromUrl(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.hostname;
    } catch {
        return url;
    }
}

// Check if origin matches pattern (supports wildcards)
export function matchesDomain(origin: string, pattern: string): boolean {
    if (!pattern || !origin) return false;

    if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(origin);
    }

    return origin === pattern;
}

// Compress string using pako (for large DOM content)
export async function compressString(str: string): Promise<string> {
    if (typeof window === 'undefined') {
        const pako = await import('pako');
        const compressed = pako.deflate(str);
        return Buffer.from(compressed).toString('base64');
    }
    return str;
}

export async function decompressString(compressed: string): Promise<string> {
    if (typeof window === 'undefined') {
        const pako = await import('pako');
        const buffer = Buffer.from(compressed, 'base64');
        const decompressed = pako.inflate(buffer);
        return new TextDecoder().decode(decompressed);
    }
    return compressed;
}

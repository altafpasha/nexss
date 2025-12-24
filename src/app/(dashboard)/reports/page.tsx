'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Eye,
    Archive,
    Trash2,
    AlertTriangle,
    Shield,
    Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSettings } from '@/lib/settings-context';

// Reuse the visual logic from Dashboard but applied to Reports
interface Report {
    id: string;
    uri: string | null;
    origin: string | null;
    user_agent: string | null;
    ip: string | null;
    triggered_at: string;
    read: boolean;
    archived: boolean;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function ReportsPage() {
    const { formatDate } = useSettings();
    const [reports, setReports] = useState<Report[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; report: Report | null }>({ open: false, report: null });
    const [deleting, setDeleting] = useState(false);

    const fetchReports = async (page = 1) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/reports?page=${page}&limit=20&archived=${showArchived}`);
            if (res.ok) {
                const data = await res.json();
                setReports(data.reports);
                setPagination(data.pagination);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [showArchived]);

    const handleArchive = async (id: string, archived: boolean) => {
        const res = await fetch(`/api/reports/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archived }),
        });
        if (res.ok) {
            fetchReports(pagination.page);
        }
    };

    const handleDelete = async () => {
        if (!deleteModal.report) return;
        setDeleting(true);
        const res = await fetch(`/api/reports/${deleteModal.report.id}`, { method: 'DELETE' });
        if (res.ok) {
            setDeleteModal({ open: false, report: null });
            fetchReports(pagination.page);
        }
        setDeleting(false);
    };

    const openDeleteModal = (report: Report) => {
        setDeleteModal({ open: true, report });
    };

    const filteredReports = reports.filter((report) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            report.origin?.toLowerCase().includes(term) ||
            report.uri?.toLowerCase().includes(term) ||
            report.ip?.toLowerCase().includes(term)
        );
    });

    return (
        <div className="space-y-6 pb-10">
            {/* Delete Modal */}
            {deleteModal.open && deleteModal.report && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[#18181c] rounded-lg border border-[#27272a] w-full max-w-sm mx-4 p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-red-500/10">
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                            </div>
                            <h3 className="text-white font-medium">Delete Report</h3>
                        </div>
                        <p className="text-muted-foreground text-sm mb-5">
                            Are you sure you want to delete this report? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={() => setDeleteModal({ open: false, report: null })} 
                                className="px-3 py-1.5 text-sm text-white hover:bg-white/5 rounded transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleDelete} 
                                disabled={deleting}
                                className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50"
                            >
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header + Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Reports</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">{pagination.total} items</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-full sm:w-56">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#18181c] text-sm text-white placeholder-muted-foreground/70 rounded py-1.5 pl-9 pr-3 border border-[#27272a] focus:ring-1 focus:ring-[#3f3f46] focus:outline-none"
                        />
                    </div>
                    <Button
                        variant={showArchived ? "secondary" : "outline"}
                        onClick={() => setShowArchived(!showArchived)}
                        className={cn("rounded text-xs px-3 py-1 h-8", showArchived ? "bg-orange-500/10 text-orange-500 border-orange-500/20" : "bg-[#18181c] text-muted-foreground border border-[#27272a] hover:text-white")}
                    >
                        <Archive className="w-4 h-4 mr-1.5" />
                        {showArchived ? 'Archived' : 'Archive'}
                    </Button>
                </div>
            </div>

            {/* Custom Table Implementation to Match Reference Image */}
            <div className="bg-[#18181c] rounded-lg overflow-hidden p-4 border border-[#27272a]">
                {/* Table Header */}
                <div className="grid grid-cols-[50px_minmax(200px,1fr)_120px_80px_120px_70px] gap-4 mb-4 px-3">
                    <span className="text-muted-foreground/50 text-xs uppercase tracking-wider font-semibold">ID</span>
                    <span className="text-muted-foreground/50 text-xs uppercase tracking-wider font-semibold">Origin</span>
                    <span className="text-muted-foreground/50 text-xs uppercase tracking-wider font-semibold hidden sm:block">IP Address</span>
                    <span className="text-muted-foreground/50 text-xs uppercase tracking-wider font-semibold">Status</span>
                    <span className="text-muted-foreground/50 text-xs uppercase tracking-wider font-semibold">Date</span>
                    <span className="text-muted-foreground/50 text-xs uppercase tracking-wider font-semibold text-right">Action</span>
                </div>

                <div className="space-y-1">
                    {loading ? (
                        <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
                    ) : filteredReports.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground text-sm">No reports found</div>
                    ) : (
                        filteredReports.map((report, idx) => (
                            <div key={report.id} className="grid grid-cols-[50px_minmax(200px,1fr)_120px_80px_120px_70px] gap-4 py-2.5 px-3 hover:bg-white/5 rounded transition-colors items-center">
                                <span className="text-white/30 text-sm font-mono">#{(pagination.page - 1) * pagination.limit + idx + 1}</span>

                                <Link href={`/reports/${report.id}`} className="flex items-center gap-2 overflow-hidden group cursor-pointer">
                                    <div className="h-7 w-7 rounded min-w-[28px] bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                        <Shield className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="flex flex-col truncate">
                                        <span className="text-white font-medium truncate text-sm group-hover:text-indigo-400 transition-colors">{report.origin || 'Unknown'}</span>
                                        <span className="text-xs text-muted-foreground font-mono truncate">{report.uri}</span>
                                    </div>
                                </Link>

                                <span className="text-white/70 text-sm font-mono hidden sm:block truncate">{report.ip || '::1'}</span>

                                <div>
                                    {report.archived ? (
                                        <span className="px-2 py-0.5 rounded bg-[#2e241d] text-[#fbbf24] text-xs font-medium">Archived</span>
                                    ) : !report.read ? (
                                        <span className="px-2 py-0.5 rounded bg-[#1c2e26] text-[#34d399] text-xs font-medium">New</span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded bg-[#251e36] text-[#a78bfa] text-xs font-medium">Viewed</span>
                                    )}
                                </div>

                                <span className="text-white/50 text-sm font-mono">
                                    {formatDate(report.triggered_at)}
                                </span>

                                <div className="flex justify-end gap-1">
                                    <Link href={`/reports/${report.id}`} className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-white hover:bg-white/10 transition-colors">
                                        <Eye className="h-4 w-4" />
                                    </Link>
                                    <button
                                        onClick={() => openDeleteModal(report)}
                                        className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Minimal Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="mt-6 flex justify-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => fetchReports(pagination.page - 1)} disabled={pagination.page === 1} className="rounded border-[#27272a] bg-transparent text-white text-sm h-8 px-3">Previous</Button>
                        <Button variant="outline" size="sm" onClick={() => fetchReports(pagination.page + 1)} disabled={pagination.page === pagination.totalPages} className="rounded border-[#27272a] bg-transparent text-white text-sm h-8 px-3">Next</Button>
                    </div>
                )}
            </div>
        </div>
    );
}

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

interface StatsRow {
    count: string;
}

interface TimeSeriesRow {
    date: string;
    count: string;
}

interface TopOriginRow {
    origin: string;
    count: string;
}

// GET - Dashboard statistics
export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Total reports count
        const totalReports = await query<StatsRow>(
            'SELECT COUNT(*) as count FROM reports'
        );

        // Unread reports count
        const unreadReports = await query<StatsRow>(
            'SELECT COUNT(*) as count FROM reports WHERE read = FALSE'
        );

        // Reports today
        const reportsToday = await query<StatsRow>(
            `SELECT COUNT(*) as count FROM reports 
             WHERE triggered_at >= CURRENT_DATE`
        );

        // Reports this week
        const reportsThisWeek = await query<StatsRow>(
            `SELECT COUNT(*) as count FROM reports 
             WHERE triggered_at >= CURRENT_DATE - INTERVAL '7 days'`
        );

        // Reports per day (last 14 days)
        const reportsPerDay = await query<TimeSeriesRow>(
            `SELECT TO_CHAR(DATE(triggered_at), 'YYYY-MM-DD') as date, COUNT(*) as count 
             FROM reports 
             WHERE triggered_at >= CURRENT_DATE - INTERVAL '14 days'
             GROUP BY DATE(triggered_at) 
             ORDER BY DATE(triggered_at) ASC`
        );

        // Top 5 origins
        const topOrigins = await query<TopOriginRow>(
            `SELECT origin, COUNT(*) as count 
             FROM reports 
             WHERE origin IS NOT NULL AND origin != ''
             GROUP BY origin 
             ORDER BY count DESC 
             LIMIT 5`
        );

        // Recent reports (last 5)
        const recentReports = await query(
            `SELECT id, origin, uri, ip, triggered_at, read
             FROM reports 
             ORDER BY triggered_at DESC 
             LIMIT 5`
        );

        return NextResponse.json({
            stats: {
                totalReports: parseInt(totalReports[0]?.count || '0', 10),
                unreadReports: parseInt(unreadReports[0]?.count || '0', 10),
                reportsToday: parseInt(reportsToday[0]?.count || '0', 10),
                reportsThisWeek: parseInt(reportsThisWeek[0]?.count || '0', 10),
            },
            charts: {
                reportsPerDay: reportsPerDay.map(row => ({
                    date: row.date,
                    count: parseInt(row.count, 10),
                })),
                topOrigins: topOrigins.map(row => ({
                    origin: row.origin,
                    count: parseInt(row.count, 10),
                })),
            },
            recentReports,
        });
    } catch (error) {
        console.error('[Dashboard] Stats error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

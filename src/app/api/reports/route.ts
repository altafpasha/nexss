import { NextRequest, NextResponse } from 'next/server';
import { query, Report } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET - List all reports
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
        const archived = searchParams.get('archived') === 'true';
        const search = searchParams.get('search') || '';

        const offset = (page - 1) * limit;

        let whereClause = 'WHERE archived = $1';
        const params: (boolean | number | string)[] = [archived];
        let paramIndex = 2;

        if (search) {
            whereClause += ` AND (origin ILIKE $${paramIndex} OR uri ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        const reports = await query<Report>(
            `SELECT * FROM reports 
             ${whereClause}
             ORDER BY triggered_at DESC 
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        const countResult = await query<{ count: string }>(
            `SELECT COUNT(*) as count FROM reports ${whereClause}`,
            params
        );

        const total = parseInt(countResult[0]?.count || '0', 10);

        return NextResponse.json({
            reports,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('[Reports] List error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

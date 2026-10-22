import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export interface WatchlistDoc {
  ticker: string;
  name: string;
  addedAt: string;
  notes?: string;
}

// Fallback in-memory storage jika user belum mengatur MONGODB_URI di .env
let memoryWatchlist: WatchlistDoc[] = [
  { ticker: 'BBCA', name: 'Bank Central Asia Tbk', addedAt: new Date().toISOString() },
  { ticker: 'BBRI', name: 'Bank Rakyat Indonesia (Persero) Tbk', addedAt: new Date().toISOString() },
];

export async function GET() {
  try {
    if (clientPromise) {
      const client = await clientPromise;
      const db = client.db('idx_valuation');
      const items = await db.collection<WatchlistDoc>('watchlist').find().sort({ addedAt: -1 }).toArray();
      return NextResponse.json({
        storage: 'mongodb',
        items: items.map(({ ticker, name, addedAt, notes }) => ({ ticker, name, addedAt, notes })),
      });
    }

    return NextResponse.json({
      storage: 'memory',
      message: 'MONGODB_URI belum dikonfigurasi. Menyimpan sementara di memori server.',
      items: memoryWatchlist,
    });
  } catch (error: any) {
    console.error('Error in GET /api/watchlist:', error);
    return NextResponse.json({ storage: 'memory', items: memoryWatchlist, error: error?.message });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ticker = (body.ticker || '').trim().toUpperCase().replace('.JK', '');
    const name = body.name || ticker;

    if (!ticker) {
      return NextResponse.json({ error: 'Kode ticker saham diperlukan' }, { status: 400 });
    }

    const doc: WatchlistDoc = {
      ticker,
      name,
      addedAt: new Date().toISOString(),
      notes: body.notes || '',
    };

    if (clientPromise) {
      const client = await clientPromise;
      const db = client.db('idx_valuation');
      await db.collection('watchlist').updateOne(
        { ticker },
        { $set: doc },
        { upsert: true }
      );
      return NextResponse.json({ success: true, item: doc, storage: 'mongodb' });
    }

    // Fallback memory
    const existingIndex = memoryWatchlist.findIndex((w) => w.ticker === ticker);
    if (existingIndex >= 0) {
      memoryWatchlist[existingIndex] = doc;
    } else {
      memoryWatchlist.unshift(doc);
    }

    return NextResponse.json({ success: true, item: doc, storage: 'memory' });
  } catch (error: any) {
    console.error('Error in POST /api/watchlist:', error);
    return NextResponse.json({ error: error?.message || 'Gagal menyimpan ke watchlist' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = (searchParams.get('ticker') || '').trim().toUpperCase().replace('.JK', '');

    if (!ticker) {
      return NextResponse.json({ error: 'Kode ticker saham diperlukan' }, { status: 400 });
    }

    if (clientPromise) {
      const client = await clientPromise;
      const db = client.db('idx_valuation');
      await db.collection('watchlist').deleteOne({ ticker });
      return NextResponse.json({ success: true, ticker, storage: 'mongodb' });
    }

    // Fallback memory
    memoryWatchlist = memoryWatchlist.filter((w) => w.ticker !== ticker);
    return NextResponse.json({ success: true, ticker, storage: 'memory' });
  } catch (error: any) {
    console.error('Error in DELETE /api/watchlist:', error);
    return NextResponse.json({ error: error?.message || 'Gagal menghapus dari watchlist' }, { status: 500 });
  }
}

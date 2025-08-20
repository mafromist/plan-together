import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { Event } from '../types';
import { Card, Button, TextInput, Spinner, Alert } from 'flowbite-react';

const PAGE_SIZE = 20;

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [q, setQ] = useState('');

  async function load(p = 0, append = false) {
    setLoading(true);
    setError(null);
    const from = p * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('events')
      .select('id,slug,title,host_name,created_at')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const list = data || [];
    setHasMore(list.length === PAGE_SIZE);
    setEvents((prev) => (append ? [...prev, ...list] : list));
    setLoading(false);
  }

  useEffect(() => {
    load(0, false);
  }, []);

async function deleteEvent(id: string) {
  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) {
    console.error("Silme hatası:", error.message);
    alert("Silme hatası: " + error.message);
    return;
  }

  // Frontend state’ten de kaldır
  setEvents(prev => prev.filter(ev => ev.id !== id));
}

  const filtered = q
    ? events.filter((e) =>
        (e.title + ' ' + e.slug).toLowerCase().includes(q.toLowerCase())
      )
    : events;

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>Etkinlikler</h1>
        <Link to='/new'>
          <Button color='purple'>Yeni Etkinlik</Button>
        </Link>
      </div>

      {/* Search */}
      <TextInput
        type='text'
        placeholder='Ara (başlık veya link)...'
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className='w-full'
      />

      {/* Error */}
      {error && (
        <Alert color='failure'>
          <span>{error}</span>
        </Alert>
      )}

      {/* Event Cards */}
      <div className='grid gap-4 md:grid-cols-2'>
        {filtered.length === 0 && !loading && (
          <Card>
            <p className='text-gray-500 text-sm'>
              Henüz etkinlik yok. İlk etkinliğini{' '}
              <Link to='/new' className='underline'>
                oluştur
              </Link>
              .
            </p>
          </Card>
        )}
        {filtered.map((ev) => (
          <Card key={ev.id} className='hover:shadow-lg transition'>
            <Link to={`/e/${ev.slug}`}>
              <h5 className='text-xl font-semibold tracking-tight text-gray-900'>
                {ev.title}
              </h5>
              <p className='text-sm text-gray-500'>
                /{ev.slug}
                {ev.host_name && ` • Host: ${ev.host_name}`} •{' '}
                {new Date(ev.created_at).toLocaleString()}
              </p>
            </Link>

            <div className='mt-3 flex gap-2'>
              <Link to={`/e/${ev.slug}`}>
                <Button size='xs' color='light'>
                  Aç
                </Button>
              </Link>
              <Button
                size='xs'
                color='failure'
                onClick={() => deleteEvent(ev.id)}
              >
                Sil
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {hasMore && (
        <div className='text-center'>
          <Button
            color='gray'
            onClick={() => {
              const next = page + 1;
              setPage(next);
              load(next, true);
            }}
          >
            {loading ? <Spinner size='sm' /> : 'Daha fazla göster'}
          </Button>
        </div>
      )}
    </div>
  );
}

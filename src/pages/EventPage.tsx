import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Event, Item, Claim } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useDisplayName } from '../hooks/useDisplayName';
import { ensureAnonSession, saveNameToAuth } from '../lib/auth';

export default function EventPage() {
	const { slug } = useParams();
	const { name, save } = useDisplayName();

	const [event, setEvent] = useState<Event | null>(null);
	const [items, setItems] = useState<Item[]>([]);
	const [claims, setClaims] = useState<Claim[]>([]);
	const [myName, setMyName] = useState(name);
	const [editingName, setEditingName] = useState(!name);
	const [newItemLabel, setNewItemLabel] = useState('');
	const [newItemQty, setNewItemQty] = useState<string>('1');
	const [autoClaim] = useState<boolean>(() => {
		const v = localStorage.getItem('potluck_auto_claim');
		return v === null ? true : v === 'true';
	});
	const [copied, setCopied] = useState<boolean>(false);

	async function addItem() {
		if (!event) return;
		const label = newItemLabel.trim();
		const name = myName.trim();
		if (!label || !name) {
			alert('Lütfen adını ve ürünü gir.');
			return;
		}
		const qty = Math.max(1, parseInt(newItemQty || '1', 10) || 1);

		await ensureAnonSession();
		await saveNameToAuth(name);

		const { data: inserted, error } = await supabase
			.from('items')
			.insert({
				event_id: event.id,
				label,
				requested_qty: qty,
				created_by: name,
			})
			.select('id')
			.single();
		if (error || !inserted) {
			alert('Hata: ' + (error?.message || 'Kaydedilemedi'));
			return;
		}

		if (autoClaim) {
			await supabase.from('claims').insert({
				item_id: inserted.id,
				claimer_name: myName.trim(),
				qty,
			});
		}

		setNewItemLabel('');
		setNewItemQty('1');
		await loadAll();
	}

	async function deleteItem(itemId: string) {
		if (!confirm('Bu ürünü silmek istediğine emin misin?')) return;
		const { error } = await supabase.from('items').delete().eq('id', itemId);
		if (error) {
			alert('Hata: ' + error.message);
			return;
		}
		await loadAll();
	}

	useEffect(() => {
		setMyName(name);
		setEditingName(!name);
	}, [name]);

	const loadAll = useCallback(
		async (evSlug?: string) => {
			const { data: ev } = await supabase
				.from('events')
				.select('*')
				.eq('slug', evSlug ?? slug)
				.single();
			if (!ev) return;
			setEvent(ev);
			const [{ data: it }, { data: cl }] = await Promise.all([
				supabase.from('items').select('*').eq('event_id', ev.id).order('created_at'),
				supabase.from('claims').select('*, items!inner(id,event_id)').eq('items.event_id', ev.id).order('created_at'),
			]);
			setItems(it || []);
			setClaims(cl || []);
		},
		[slug]
	);

	useEffect(() => {
		loadAll();
	}, [slug, loadAll]);

	const { mine, contribs } = useMemo(() => {
		const mine = new Map<string, number>();
		const contribs = new Map<string, Record<string, number>>();
		for (const it of items) {
			mine.set(it.id, 0);
			contribs.set(it.id, {});
		}
		for (const c of claims) {
			const bag = contribs.get(c.item_id)!;
			bag[c.claimer_name] = (bag[c.claimer_name] || 0) + c.qty;
			if (c.claimer_name === myName) mine.set(c.item_id, (mine.get(c.item_id) || 0) + c.qty);
		}
		return { mine, contribs };
	}, [items, claims, myName]);

	const copyLink = async () => {
		await navigator.clipboard.writeText(window.location.href);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const saveName = async () => {
		if (!myName.trim()) return;
		save(myName.trim());
		await saveNameToAuth(myName);
		setEditingName(false);
	};

	async function increment(itemId: string) {
		if (!myName.trim()) {
			alert('Lütfen önce adını gir.');
			return;
		}
		await supabase.from('claims').insert({ item_id: itemId, claimer_name: myName.trim(), qty: 1 });
		await reloadClaimsForEvent();
	}

	async function decrement(itemId: string) {
		if (!myName.trim()) return;
		const { data: last } = await supabase
			.from('claims')
			.select('id, qty')
			.eq('item_id', itemId)
			.eq('claimer_name', myName.trim())
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle();
		if (!last) return;
		if ((last.qty ?? 1) > 1) {
			await supabase
				.from('claims')
				.update({ qty: (last.qty ?? 1) - 1 })
				.eq('id', last.id);
		} else {
			await supabase.from('claims').delete().eq('id', last.id);
		}
		await reloadClaimsForEvent();
	}

	async function reloadClaimsForEvent() {
		if (!event) return;
		const { data: cl } = await supabase
			.from('claims')
			.select('*, items!inner(id,event_id)')
			.eq('items.event_id', event.id)
			.order('created_at');
		setClaims(cl || []);
	}

	if (editingName) {
		return (
			<div className='max-w-md mx-auto mt-10 p-6 rounded-xl border bg-white shadow'>
				<h2 className='text-lg font-semibold mb-3'>Adın nedir?</h2>
				<div className='flex items-center gap-2'>
					<input
						autoFocus
						className='flex-1 rounded-lg border px-3 py-2 text-sm'
						placeholder='Adını yaz...'
						value={myName}
						onChange={(e) => setMyName(e.target.value)}
					/>
					<button onClick={saveName} className='rounded-lg border px-4 py-2 text-sm font-medium'>
						Kaydet
					</button>
				</div>
			</div>
		);
	}

	if (!event) return <div>Yükleniyor…</div>;

	return (
		<div className='space-y-4'>
			<div className='flex flex-col sm:flex-row items-center justify-between gap-3'>
				<div>
					<h1 className='text-xl font-bold'>{event.title}</h1>
					<button onClick={copyLink} className='rounded-lg border px-2 py-1 text-xs'>
						{copied ? 'Kopyalandı ✓' : 'Event Linkini Kopyala'}
					</button>
				</div>
				<div className='shrink-0 flex items-center gap-2'>
					<p>Adın: </p>
					<span className='rounded-full bg-gray-900 text-white px-3 py-1 text-sm'>{myName}</span>
					<button onClick={() => setEditingName(true)} className='text-sm underline'>
						Adını Değiştir
					</button>
				</div>
			</div>

			<div className='space-y-3'>
				{items.map((it, idx) => {
					const mineCount = Math.max(0, mine.get(it.id) || 0);
					const list = contribs.get(it.id) || {};
					const contributors = Object.entries(list)
						.filter(([, q]) => (q || 0) > 0)
						.map(([n, q]) => `${n} x${q}`)
						.join(', ');

					return (
						<div key={it.id} className='w-full rounded-xl border bg-white p-3 shadow-sm'>
							{/* Üst satır: ürün adı + sil butonu */}
							<div className='flex justify-between items-center'>
								<span className='font-medium'>
									{idx + 1}. {it.label}
								</span>
								<button onClick={() => deleteItem(it.id)} className='text-xs rounded-lg border px-2 py-1'>
									Sil
								</button>
							</div>

							{/* Alt satır: mobilde dikey, genişte yatay */}
							<div className='mt-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-sm'>
								{/* Sol: + / - kontrolleri */}
								<div className='flex items-center gap-2'>
									<button
										onClick={() => decrement(it.id)}
										disabled={mineCount <= 0}
										className={`h-7 w-7 rounded border text-lg leading-none ${
											mineCount <= 0 ? 'opacity-50 cursor-not-allowed' : ''
										}`}>
										−
									</button>
									<span>{mineCount}</span>
									<button onClick={() => increment(it.id)} className='h-7 w-7 rounded border text-lg leading-none'>
										+
									</button>
								</div>

								{/* Orta: katkıda bulunanlar */}
								<div className='flex-1'>Katkıda: {contributors || <span className='text-gray-400'>—</span>}</div>

								{/* Sağ: ekleyen */}
								<div className='text-right sm:text-left'>
									Ekleyen: {it.created_by || <span className='text-gray-400'>—</span>}
								</div>
							</div>
						</div>
					);
				})}

				{/* Yeni ürün ekleme kartı */}
				<div className='w-full rounded-xl border bg-gray-50 p-3'>
					<div className='flex flex-col sm:flex-row gap-2'>
						<input
							className='flex-1 rounded-lg border px-3 py-1.5'
							placeholder='Yeni ürün (örn: Şakşuka)'
							value={newItemLabel}
							onChange={(e) => setNewItemLabel(e.target.value)}
						/>
						<input
							type='number'
							min={1}
							step={1}
							className='w-full sm:w-20 rounded-lg border px-2 py-1'
							value={newItemQty}
							onChange={(e) => setNewItemQty(e.target.value)}
						/>
						<button onClick={addItem} className='w-full sm:w-auto rounded-lg border px-3 py-1.5 text-sm font-medium'>
							Ekle
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

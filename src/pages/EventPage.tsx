import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Event, Item, Claim } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useDisplayName } from '../hooks/useDisplayName';
import { ensureAnonSession, saveNameToAuth } from '../lib/auth';

export default function EventPage() {
	const { slug } = useParams();
	const navigate = useNavigate();
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
	// const [copied, setCopied] = useState<boolean>(false);

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
			const { error: clErr } = await supabase.from('claims').insert({
				item_id: inserted.id,
				claimer_name: myName.trim(),
				qty,
			});
			if (clErr) console.error(clErr);
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
				.maybeSingle(); // ✅ single yerine maybeSingle

			if (!ev) {
				navigate('/'); // ✅ bulunamazsa ana sayfa
				return;
			}

			setEvent(ev);

			const [{ data: it }, { data: cl }] = await Promise.all([
				supabase.from('items').select('*').eq('event_id', ev.id).order('created_at'),
				supabase.from('claims').select('*, items!inner(id,event_id)').eq('items.event_id', ev.id).order('created_at'),
			]);

			setItems(it || []);
			setClaims(cl || []);
		},
		[slug, navigate]
	);

	useEffect(() => {
		loadAll();
	}, [slug, loadAll]);

	// Aggregations
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
			if (c.claimer_name === myName) {
				mine.set(c.item_id, (mine.get(c.item_id) || 0) + c.qty);
			}
		}
		return { mine, contribs };
	}, [items, claims, myName]);

	// const copyLink = async () => {
	// 	await navigator.clipboard.writeText(window.location.href);
	// 	setCopied(true);
	// 	setTimeout(() => setCopied(false), 2000);
	// };

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
		const { error } = await supabase.from('claims').insert({ item_id: itemId, claimer_name: myName.trim(), qty: 1 });
		if (error) {
			alert('Hata: ' + error.message);
			return;
		}
		await reloadClaimsForEvent();
	}

	async function decrement(itemId: string) {
		if (!myName.trim()) return;
		const { data: last, error } = await supabase
			.from('claims')
			.select('id, qty')
			.eq('item_id', itemId)
			.eq('claimer_name', myName.trim())
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		if (error || !last) return;

		if ((last.qty ?? 1) > 1) {
			const { error: upErr } = await supabase
				.from('claims')
				.update({ qty: (last.qty ?? 1) - 1 })
				.eq('id', last.id);
			if (upErr) {
				alert('Hata: ' + upErr.message);
				return;
			}
		} else {
			const { error: delErr } = await supabase.from('claims').delete().eq('id', last.id);
			if (delErr) {
				alert('Hata: ' + delErr.message);
				return;
			}
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
			{/* Üst bar */}
			<div className='flex flex-col sm:flex-row items-center justify-between gap-3'>
				<div>
					<h1 className='text-xl font-bold text-gray-900 dark:text-gray-100'>{event.title}</h1>
				</div>
				<div className='shrink-0 flex items-center gap-2'>
					<p className='text-gray-700 dark:text-gray-300'>Adın: </p>
					<span className='rounded-full bg-purple-600 text-white px-3 py-1 text-sm dark:bg-purple-400 dark:text-gray-900'>
						{myName}
					</span>
					<button
						onClick={() => setEditingName(true)}
						className='text-sm text-purple-600 dark:text-purple-400 hover:underline'>
						Adını Değiştir
					</button>
				</div>
			</div>

			{/* Tablo */}
			<div className='overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'>
				<table className='w-full text-sm'>
					<thead className='bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300'>
						<tr>
							<th className='p-2 text-left'>#</th>
							<th className='p-2 text-left'>Gönülden Kopanlar</th>
							<th className='p-2 text-left'>Ekle / Çıkar (+/−)</th>
							<th className='p-2 text-left'>Yaparım Diyoooo</th>
							<th className='p-2 text-left'>Ekleyen Yüce Gönül</th>
						</tr>
					</thead>
					<tbody>
						{items.map((it, idx) => {
							const mineCount = Math.max(0, mine.get(it.id) || 0);
							const list = contribs.get(it.id) || {};
							const contributors = Object.entries(list)
								.filter(([, q]) => (q || 0) > 0)
								.map(([n, q]) => `${n} x${q}`)
								.join(', ');
							return (
								<tr key={it.id} className='border-t border-gray-200 dark:border-gray-700'>
									<td className='p-2 font-semibold text-gray-900 dark:text-gray-100'>{idx + 1}</td>
									<td className='p-2 flex items-center justify-between gap-2'>
										<span className='text-gray-800 dark:text-gray-200'>{it.label}</span>
										<button
											onClick={() => deleteItem(it.id)}
											className='shrink-0 rounded-lg border px-2 py-1 text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/30'>
											Sil
										</button>
									</td>
									<td className='p-2'>
										<div className='inline-flex items-center gap-2'>
											<button
												onClick={() => decrement(it.id)}
												disabled={mineCount <= 0}
												className={`h-8 w-8 rounded-lg border text-lg leading-none 
                      border-gray-300 dark:border-gray-600 
                      text-gray-800 dark:text-gray-200
                      hover:bg-purple-50 dark:hover:bg-purple-900/30
                      ${mineCount <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
												−
											</button>
											<span className='min-w-6 text-center text-gray-900 dark:text-gray-100'>{mineCount}</span>
											<button
												onClick={() => increment(it.id)}
												className='h-8 w-8 rounded-lg border text-lg leading-none
                      border-gray-300 dark:border-gray-600 
                      text-gray-800 dark:text-gray-200
                      hover:bg-purple-50 dark:hover:bg-purple-900/30'>
												+
											</button>
										</div>
									</td>
									<td className='p-2 text-gray-700 dark:text-gray-300'>
										{contributors || <span className='text-gray-400'>—</span>}
									</td>
									<td className='p-2 text-gray-700 dark:text-gray-300'>
										{it.created_by || <span className='text-gray-400'>—</span>}
									</td>
								</tr>
							);
						})}
						{/* Yeni ürün ekleme satırı */}
						<tr className='border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'>
							<td className='p-2 text-gray-500 dark:text-gray-400'>—</td>
							<td className='p-2'>
								<input
									className='w-full rounded-lg border px-3 py-1.5 border-gray-300 dark:border-gray-600 
                         bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 
                         placeholder-gray-400 dark:placeholder-gray-500'
									placeholder='Yeni ürün (örn: Börek)'
									value={newItemLabel}
									onChange={(e) => setNewItemLabel(e.target.value)}
								/>
							</td>
							<td className='p-2'>
								<div className='inline-flex items-center gap-2'>
									<input
										type='number'
										min={1}
										step={1}
										inputMode='numeric'
										className='w-20 rounded-lg border px-2 py-1 border-gray-300 dark:border-gray-600 
                           bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100'
										value={newItemQty}
										onChange={(e) => setNewItemQty(e.target.value)}
									/>
									<button
										onClick={addItem}
										className='rounded-lg border px-3 py-1.5 text-sm font-medium 
                           border-purple-500 text-purple-600 dark:border-purple-400 dark:text-purple-400 
                           hover:bg-purple-50 dark:hover:bg-purple-900/30'>
										Ekle
									</button>
								</div>
							</td>
							<td className='p-2 text-gray-500 dark:text-gray-400'>—</td>
							<td className='p-2 text-gray-500 dark:text-gray-400'>—</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}

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

		// 🔑 RLS için kritik: oturum + meta.name
		await ensureAnonSession();
		await saveNameToAuth(name);

		// 1) Ürünü ekle
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

		// 2) Opsiyonel otomatik claim: ekleyen kişi eklediği miktar kadar katkı yazılsın
		if (autoClaim) {
			const { error: clErr } = await supabase.from('claims').insert({
				item_id: inserted.id,
				claimer_name: myName.trim(),
				qty,
			});
			if (clErr) {
				console.error(clErr); /* Claim eklenemezse ürün yine kalır */
			}
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

	const loadAll = useCallback(async (evSlug?: string) => {
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
	}, [slug]);

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
		save(myName.trim()); // localStorage
		await saveNameToAuth(myName); // Supabase auth meta
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
		// kendi son claim'ini bul
		console.log('item', itemId);
		const { data: last, error } = await supabase
			.from('claims')
			.select('id, qty')
			.eq('item_id', itemId)
			.eq('claimer_name', myName.trim())
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		if (error || !last) return; // düşecek bir kayıt yok

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
			{/* Üst bar: başlık + isim */}
			<div className='flex items-center justify-between gap-3'>
				<div>
					<h1 className='text-xl font-bold'>{event.title}</h1>
					<button onClick={copyLink} className='rounded-lg border px-2 py-1 text-xs'>
						{copied ? 'Kopyalandı ✓' : 'Linki Kopyala'}
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

			{/* Tablo */}
			<div className='overflow-x-auto rounded-xl border bg-white'>
				<table className='w-full table-fixed text-sm'>
					<colgroup>
						<col className='w-16' />
						<col />
						<col className='w-40' />
						<col className='w-56' />
					</colgroup>
					<thead className='bg-gray-50 text-gray-600'>
						<tr>
							<th className='p-2 text-left'>Toplam</th>
							<th className='p-2 text-left'>Ürün</th>
							<th className='p-2 text-left'>Senin (+/−)</th>
							<th className='p-2 text-left'>Katkıda Bulunanlar</th>
							<th className='p-2 text-left'>Ekleyen</th>
						</tr>
					</thead>
					<tbody>
						{items.map((it, idx) => {
							const mineCount = Math.max(0, mine.get(it.id) || 0);
							const list = contribs.get(it.id) || {};
							const contributors = [
								...Object.entries(list)
									.filter(([, q]) => (q || 0) > 0)
									.map(([n, q]) => `${n} x${q}`),
							]
								.filter(Boolean)
								.join(', ');
							const creators = it.created_by;
							return (
								<tr key={it.id} className='border-t'>
									<td className='p-2 font-semibold'>{idx + 1}</td>
									<td className='p-2 flex items-center justify-between gap-2'>
										<span>{it.label}</span>
										<button onClick={() => deleteItem(it.id)} className='shrink-0 rounded-lg border px-2 py-1 text-xs'>
											Sil
										</button>
									</td>
									<td className='p-2'>
										<div className='inline-flex items-center gap-2'>
											<button
												onClick={() => decrement(it.id)}
												disabled={mineCount <= 0}
												className={`h-8 w-8 rounded-lg border text-lg leading-none ${
													mineCount <= 0 ? 'opacity-50 cursor-not-allowed' : ''
												}`}
												aria-label='Azalt'>
												−
											</button>
											<span className='min-w-6 text-center'>{mineCount}</span>
											<button
												onClick={() => increment(it.id)}
												className='h-8 w-8 rounded-lg border text-lg leading-none'
												aria-label='Arttır'>
												+
											</button>
										</div>
									</td>
									<td className='p-2 text-gray-700'>{contributors || <span className='text-gray-400'>—</span>}</td>
									<td className='p-2 text-gray-700'>{creators || <span className='text-gray-400'>—</span>}</td>
								</tr>
							);
						})}
						{/* Yeni ürün satırı */}
						<tr className='border-t bg-gray-50/50'>
							<td className='p-2 text-gray-500'>—</td>
							<td className='p-2'>
								<input
									className='w-full rounded-lg border px-3 py-1.5'
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
										className='w-20 rounded-lg border px-2 py-1'
										value={newItemQty}
										onChange={(e) => setNewItemQty(e.target.value)}
									/>
									<button onClick={addItem} className='rounded-lg border px-3 py-1.5 text-sm font-medium'>
										Ekle
									</button>
								</div>
							</td>
							<td className='p-2 text-gray-500'>—</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}

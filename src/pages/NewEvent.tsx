import { useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { slugify } from "../lib/slugify";
import { useNavigate } from "react-router-dom";

const DEFAULT_ITEMS = [
  { label: "Salata", requested_qty: 1 },
  { label: "Tatlı", requested_qty: 1 },
  { label: "İçecek (2L)", requested_qty: 2 },
  { label: "Atıştırmalık", requested_qty: 2 },
];

export default function NewEvent() {
  const [title, setTitle] = useState("");
  const [hostName, setHostName] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const navigate = useNavigate();

  const slug = useMemo(() => customSlug ? slugify(customSlug) : slugify(title), [title, customSlug]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title || !slug) return;

    const { data: ev, error } = await supabase
      .from("events")
      .insert({ title, slug, host_name: hostName })
      .select()
      .single();

    if (error || !ev) { console.error(error); return; }

    // default items
    const items = DEFAULT_ITEMS.map(i => ({ ...i, event_id: ev.id }));
    const { error: itemErr } = await supabase.from("items").insert(items);
    if (itemErr) console.error(itemErr);

    navigate(`/e/${slug}`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Yeni Etkinlik</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input
          className="w-full rounded-xl border px-3 py-2"
          placeholder="Etkinlik başlığı (örn: Cuma Rakısı)"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <input
          className="w-full rounded-xl border px-3 py-2"
          placeholder="Host adı (opsiyonel)"
          value={hostName}
          onChange={e => setHostName(e.target.value)}
        />
        <input
          className="w-full rounded-xl border px-3 py-2"
          placeholder="Özel link (opsiyonel)"
          value={customSlug}
          onChange={e => setCustomSlug(e.target.value)}
        />
        <p className="text-sm text-gray-500">Link: <span className="font-mono">/e/{slug || "slug"}</span></p>
        <button className="w-full rounded-xl bg-gray-900 text-white py-2 font-semibold">Oluştur</button>
      </form>
    </div>
  );
}
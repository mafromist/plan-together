export type Event = {
  id: string;
  slug: string;
  title: string;
  host_name?: string | null;
  created_at: string;
};

export type Item = {
  id: string;
  event_id: string;
  label: string;
  requested_qty: number;
  created_at: string;
  created_by: string;
};

export type Claim = {
  id: string;
  item_id: string;
  claimer_name: string;
  qty: number;
  created_at: string;
};
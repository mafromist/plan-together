import { useEffect, useState } from "react";
const KEY = "potluck_display_name";

export function useDisplayName() {
  const [name, setName] = useState<string>("");
  useEffect(() => { setName(localStorage.getItem(KEY) || ""); }, []);
  const save = (n: string) => { localStorage.setItem(KEY, n); setName(n); };
  return { name, save };
}
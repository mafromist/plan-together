import { useEffect } from "react";
import { ensureAnonSession } from "../lib/auth";

export function useAnonSession() {
  useEffect(() => {
    ensureAnonSession();
  }, []);
}
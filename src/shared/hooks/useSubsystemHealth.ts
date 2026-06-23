import { useEffect, useState } from "react";
import type { ApiFetch } from "../../types";
import { onAppEvent } from "../lib/appEvents";

export type SubsystemHealth = Record<string, { status: string; error?: string; reason?: string; [key: string]: unknown }>;

export function useSubsystemHealth(api: ApiFetch | null) {
  const [subsystems, setSubsystems] = useState<SubsystemHealth | null>(null);

  useEffect(() => {
    if (!api) {
      setSubsystems(null);
      return;
    }
    let stopped = false;
    const load = async () => {
      try {
        const response = await api("/api/v1/health/subsystems", { timeoutMs: 10000 });
        if (!response.ok) return;
        const payload = await response.json();
        if (!stopped) setSubsystems(payload);
      } catch {
        if (!stopped) setSubsystems(null);
      }
    };
    load();
    const timer = window.setInterval(load, 30000);
    const offSubsystemsRefresh = onAppEvent("subsystems-refresh", load);
    return () => {
      stopped = true;
      offSubsystemsRefresh();
      window.clearInterval(timer);
    };
  }, [api]);

  return subsystems;
}

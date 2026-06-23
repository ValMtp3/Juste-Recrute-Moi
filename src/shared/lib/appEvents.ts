import type { Lead } from "../../types";

export type AppEventMap = {
  "backend-status": { scanning?: boolean; reevaluating?: boolean };
  "cleanup-done": undefined;
  "graph-refresh": undefined;
  "hot-x-lead": unknown;
  "lead-updated": Partial<Lead> & { job_id: string };
  "leads-refresh": undefined;
  "profile-export": undefined;
  "profile-refresh": undefined;
  "reevaluate-done": undefined;
  "scan-done": undefined;
  "subsystems-refresh": undefined;
};

type AppEventName = keyof AppEventMap;

export function emitAppEvent<Name extends AppEventName>(
  name: Name,
  ...args: AppEventMap[Name] extends undefined ? [] : [detail: AppEventMap[Name]]
) {
  window.dispatchEvent(new CustomEvent(name, { detail: args[0] }));
}

export function onAppEvent<Name extends AppEventName>(
  name: Name,
  handler: (detail: AppEventMap[Name]) => void,
) {
  const listener = (event: Event) => {
    handler((event as CustomEvent<AppEventMap[Name]>).detail);
  };
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}

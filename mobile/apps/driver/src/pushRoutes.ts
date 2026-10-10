// Pure push/notification → screen mapping. Kept free of expo-notifications so
// screens can import it without loading the native module at boot.
export type DriverPushData = {
  booking_id?: unknown;
  job_id?: unknown;
  doc_id?: unknown;
  doc_types?: unknown;
  target?: unknown;
  title?: string | null;
  [k: string]: unknown;
};

export type DriverRoute =
  | { name: "BookingDetail"; params: { bookingId: string; initialTab?: "messages" | "pod" } }
  | { name: "JobDetail"; params: { jobId: string } }
  | { name: "Documents" }
  | { name: "Notifications" };

// Explicit backend `target` wins; otherwise infer from title (older notifications).
function resolveTab(target: unknown, title?: string | null): "messages" | "pod" | undefined {
  if (target === "chat") return "messages";
  if (target === "pod") return "pod";
  if (typeof title === "string") {
    if (title.startsWith("Message from")) return "messages";
    if (title.startsWith("Delivery complete")) return "pod";
  }
  return undefined;
}

export function resolveDriverRoute(data: DriverPushData): DriverRoute {
  const title = data.title ?? undefined;
  if (typeof data.booking_id === "string" && data.booking_id) {
    const initialTab = resolveTab(data.target, title);
    return {
      name: "BookingDetail",
      params: initialTab ? { bookingId: data.booking_id, initialTab } : { bookingId: data.booking_id },
    };
  }
  if (typeof data.job_id === "string" && data.job_id) {
    return { name: "JobDetail", params: { jobId: data.job_id } };
  }
  if (data.doc_id || data.doc_types || title === "You're approved!") {
    return { name: "Documents" };
  }
  return { name: "Notifications" };
}

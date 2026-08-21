export async function pedirPermissaoPush(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

export async function notificarVendaPWA(titulo: string, corpo: string, tag: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null;
    if (reg?.showNotification) {
      await reg.showNotification(titulo, {
        body: corpo,
        icon: "/favicon.png",
        badge: "/favicon.png",
        tag,
        silent: true,
        data: { url: "/dono" },
      } as NotificationOptions);
      return;
    }
    const n = new Notification(titulo, { body: corpo, icon: "/favicon.png", tag, silent: true });
    setTimeout(() => n.close(), 9000);
  } catch {
    try {
      new Notification(titulo, { body: corpo, icon: "/favicon.png", tag, silent: true });
    } catch { /* ignore */ }
  }
}

export async function pedirPermissaoPush(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

export async function notificarVendaPWA(titulo: string, corpo: string, tag: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const logo = `${window.location.origin}/favicon.png`;
  const opts: NotificationOptions = {
    body: corpo,
    icon: logo,
    badge: logo,
    tag,
    silent: true,
    data: { url: "/dono" },
  };
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null;
    if (reg?.showNotification) {
      await reg.showNotification(titulo, opts);
      return;
    }
    const n = new Notification(titulo, opts);
    setTimeout(() => n.close(), 9000);
  } catch {
    try {
      new Notification(titulo, { body: corpo, icon: logo, tag });
    } catch { /* ignore */ }
  }
}

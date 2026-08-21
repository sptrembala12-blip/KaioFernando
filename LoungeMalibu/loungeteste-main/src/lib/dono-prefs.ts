const KEY = "loungemalibu.dono.prefs";

export type DonoPrefs = {
  som: boolean;
  push: boolean;
};

const padrao: DonoPrefs = { som: true, push: true };

export function lerPrefs(): DonoPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...padrao };
    return { ...padrao, ...JSON.parse(raw) };
  } catch {
    return { ...padrao };
  }
}

export function salvarPrefs(p: DonoPrefs) {
  localStorage.setItem(KEY, JSON.stringify(p));
}



export function loadJson<T>(key: string, def: T): T {
  try {
    const r = localStorage.getItem(key);
    return r ? (JSON.parse(r) as T) : def;
  } catch {
    return def;
  }
}

export function saveJson(key: string, v: unknown) {
  localStorage.setItem(key, JSON.stringify(v));
}

export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-5' : 'left-1'}`} />
    </button>
  );
}

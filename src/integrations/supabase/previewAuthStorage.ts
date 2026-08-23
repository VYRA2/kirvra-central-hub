/**
 * A brokered storage implementation that allows the preview environment to
 * maintain the user's Supabase session across reloads.
 */
export function brokeredPreviewStorage(): Storage {
  return {
    getItem: (key) => {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(key);
    },
    setItem: (key, value) => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(key, value);
    },
    removeItem: (key) => {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(key);
    },
    clear: () => {
      if (typeof window === "undefined") return;
      window.localStorage.clear();
    },
    key: (index) => {
      if (typeof window === "undefined") return null;
      return window.localStorage.key(index);
    },
    get length() {
      if (typeof window === "undefined") return 0;
      return window.localStorage.length;
    },
  };
}

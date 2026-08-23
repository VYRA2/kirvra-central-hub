import { supabase } from "@/integrations/supabase/client";

/**
 * Custom storage for keeping track of authenticated session in preview
 */
export const previewAuthStorage = {
  getItem: (key: string) => {
    return window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    window.localStorage.setItem(key, value);
    
    // Auto-refresh logic for the preview environment
    if (key.includes('auth-token')) {
      try {
        const session = JSON.parse(value);
        if (session && session.expires_at) {
          const expiresAt = session.expires_at * 1000;
          const now = Date.now();
          const buffer = 1000 * 60 * 5; // 5 minutes buffer
          
          if (expiresAt - now < buffer) {
            // If expiring soon, trigger a refresh
            console.log("Session expiring soon, refreshing...");
            supabase.auth.refreshSession();
          }
          
          // Set a timer for the next check
          const timeout = expiresAt - now - buffer;
          if (timeout > 0) {
            const timer = setTimeout(() => {
              supabase.auth.refreshSession();
            }, timeout);
            // We don't need to store the timer id as we're not clearing it
          }
        }
      } catch (e) {
        console.error("Error parsing auth token for refresh logic", e);
      }
    }
  },
  removeItem: (key: string) => {
    window.localStorage.removeItem(key);
  },
};

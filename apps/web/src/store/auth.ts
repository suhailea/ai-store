import { create } from "zustand";

interface AuthState {
  token: string | null;
  userId: string | null;
  businessId: string | null;
  isDemo: boolean;
  setAuth: (token: string, userId: string, businessId: string, isDemo?: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("staffroom_token"),
  userId: localStorage.getItem("staffroom_userId"),
  businessId: localStorage.getItem("staffroom_businessId"),
  isDemo: localStorage.getItem("staffroom_demo") === "true",

  setAuth: (token, userId, businessId, isDemo = false) => {
    localStorage.setItem("staffroom_token", token);
    localStorage.setItem("staffroom_userId", userId);
    localStorage.setItem("staffroom_businessId", businessId);
    localStorage.setItem("staffroom_demo", String(isDemo));
    set({ token, userId, businessId, isDemo });
  },

  logout: () => {
    localStorage.removeItem("staffroom_token");
    localStorage.removeItem("staffroom_userId");
    localStorage.removeItem("staffroom_businessId");
    localStorage.removeItem("staffroom_demo");
    set({ token: null, userId: null, businessId: null, isDemo: false });
  },
}));

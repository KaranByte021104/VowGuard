import { create } from 'zustand'

export interface User {
  id: string;
  email: string;
  role: string;
  publicKey?: string; // base64 SPKI
  encryptedPrivateKey?: string;
}

interface SessionState {
  user: User | null;
  isAuthenticated: boolean;
  privateKey: CryptoKey | null;
  publicKey: CryptoKey | null;
  setUser: (user: User) => void;
  setKeys: (privateKey: CryptoKey, publicKey: CryptoKey) => void;
  clearUser: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  isAuthenticated: false,
  privateKey: null,
  publicKey: null,
  setUser: (user) => set({ user, isAuthenticated: true }),
  setKeys: (privateKey, publicKey) => set({ privateKey, publicKey }),
  clearUser: () => set({ user: null, isAuthenticated: false, privateKey: null, publicKey: null }),
}))

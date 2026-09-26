"use client";

import { useSyncExternalStore } from "react";

// Demo mode shows the app with sample data and no account. It lasts for the browser tab
// (sessionStorage) so a reload stays in the demo, and nothing in it is ever saved.
const STORAGE_KEY = "home-loan-compass:demo";
const listeners = new Set<() => void>();
let demo = readStored();
let signupRequested = false;

function readStored() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setDemo(next: boolean) {
  demo = next;
  try {
    if (next) window.sessionStorage.setItem(STORAGE_KEY, "1");
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private windows; the demo then lasts until reload.
  }
  listeners.forEach((listener) => listener());
}

export function isDemoMode() {
  return demo;
}

export function enterDemo() {
  setDemo(true);
}

// `signup` opens the sign-up form next, for "Create your account" from the demo.
export function exitDemo({ signup = false }: { signup?: boolean } = {}) {
  signupRequested = signup;
  setDemo(false);
}

// Lets the sign-in screen open straight in sign-up mode after "Create your account" in the demo.
// Reading doesn't clear it (state initialisers can run twice); signing in clears it.
export function signupRequestedFromDemo() {
  return signupRequested;
}

export function clearSignupRequest() {
  signupRequested = false;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDemoMode() {
  return useSyncExternalStore(subscribe, () => demo, () => false);
}

export const DEMO_SAVE_MESSAGE = "This is a demo, so changes can't be saved. Create an account to track your own loan.";

// Defence in depth: every write path calls this, so demo mode can never reach the database
// even if a button were left enabled.
export function assertNotDemo() {
  if (demo) throw new Error(DEMO_SAVE_MESSAGE);
}

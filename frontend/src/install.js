import { useSyncExternalStore } from "react";

// Chrome/Edge/Android fire "beforeinstallprompt" when the site can be installed.
// We keep the event so our own button can open the install dialog later, instead of the browser's popup.
let deferredPrompt = null;
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener());
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  notify();
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  notify();
});

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function canPrompt() {
  return deferredPrompt !== null;
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// iPhone/iPad Safari never fires beforeinstallprompt, so iOS users get instructions instead of a button.
function isIos() {
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1);
}

async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return outcome === "accepted";
}

export function useInstall() {
  const canInstall = useSyncExternalStore(subscribe, canPrompt);
  return { canInstall, installed: isInstalled(), ios: isIos(), install: promptInstall };
}

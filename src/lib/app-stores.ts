// Keep aligned with fondeka-website/src/lib/appStores.js.
export const playStoreUrl = "https://play.google.com/store/apps/details?id=com.fondeka.app";
export const appStoreUrl = "https://apps.apple.com/cd/app/fondeka/id6757371679";
export type DevicePlatform = "android" | "ios" | "other";
export function devicePlatform(device?: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}): DevicePlatform {
  if (!device) return "other";
  if (/Android/i.test(device.userAgent)) return "android";
  if (
    /iPhone|iPad|iPod/i.test(device.userAgent) ||
    (device.platform === "MacIntel" && device.maxTouchPoints > 1)
  )
    return "ios";
  return "other";
}
export function registrationStore(device?: Parameters<typeof devicePlatform>[0]) {
  const platform = devicePlatform(device);
  return platform === "android" ? playStoreUrl : platform === "ios" ? appStoreUrl : undefined;
}

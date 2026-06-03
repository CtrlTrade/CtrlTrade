export const DOWNLOAD_LINKS = {
  ios: (import.meta.env.VITE_IOS_DOWNLOAD_URL as string | undefined) || null,
  android: (import.meta.env.VITE_ANDROID_DOWNLOAD_URL as string | undefined) || null,
} satisfies { ios: string | null; android: string | null };

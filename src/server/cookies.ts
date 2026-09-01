export function cookieSettings(appBaseUrl: string, maxAge: number) {
  return {
    httpOnly: true as const,
    path: "/",
    sameSite: "Lax" as const,
    secure: appBaseUrl.startsWith("https://"),
    maxAge,
  };
}

import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isCreatePage = req.nextUrl.pathname.startsWith("/create");
  const isSettingsPage = req.nextUrl.pathname.startsWith("/settings");
  const isAdminPage = req.nextUrl.pathname.startsWith("/admin");
  const isNotificationsPage = req.nextUrl.pathname.startsWith("/notifications");
  const isAffiliatePage = req.nextUrl.pathname.startsWith("/affiliate");

  if ((isCreatePage || isSettingsPage || isAdminPage || isNotificationsPage || isAffiliatePage) && !isLoggedIn) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(signInUrl);
  }

  return undefined;
});

export const config = {
  matcher: ["/create/:path*", "/settings/:path*", "/admin/:path*", "/notifications/:path*", "/affiliate/:path*"],
};

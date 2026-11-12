import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

// Pages anyone may open. Everything else needs a signed-in user. This is only the first gate: the layout checks the
// person's record and role, and every server action checks again (see lib/auth.ts).
const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/forgot-password", "/not-invited"];

// Temporarily disabled: menu entry hidden in lib/sidebar-menu.ts, any request here redirected away.
const DISABLED_PATHS = ["/dashboard/admin/simulate"];

export default clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname;
  if (DISABLED_PATHS.some((p) => path === p || path.startsWith(p + "/"))) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  if (!isPublic) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

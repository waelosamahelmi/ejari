import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|print|share|_next|_vercel|sw.js|swe-worker|.*\\..*).*)"],
};

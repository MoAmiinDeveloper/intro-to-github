import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api/auth|api/branding|_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:png|jpg|svg|ico)$).*)"],
};

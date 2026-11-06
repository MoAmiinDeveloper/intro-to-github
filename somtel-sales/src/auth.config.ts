import type { NextAuthConfig } from "next-auth";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

/** Edge-safe part of the auth config (used by middleware). No database access here. */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
      if (isPublic) return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
} satisfies NextAuthConfig;

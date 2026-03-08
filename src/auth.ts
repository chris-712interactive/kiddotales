import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [Google],
  trustHost: true,
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isCreatePage = nextUrl.pathname.startsWith("/create");
      if (isCreatePage && !isLoggedIn) {
        return false;
      }
      return true;
    },
    jwt({ token, user, account, profile }) {
      // Preserve existing ID on subsequent requests (account only exists on first sign-in)
      if (token.id) return token;
      // Use providerAccountId as source of truth - Google's unique user ID, consistent across sign-ins
      if (account?.providerAccountId) {
        token.id = account.providerAccountId as string;
      } else if (user?.id) {
        token.id = user.id;
      } else if (profile?.sub) {
        token.id = profile.sub as string;
      } else if (token.sub) {
        token.id = token.sub;
      }
      return token;
    },
    session({ session, token }) {
      const id = token.id ?? token.sub;
      if (session.user && id) {
        (session.user as { id?: string }).id = String(id);
      }
      return session;
    },
  },
});

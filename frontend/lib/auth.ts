import { cookies, headers } from "next/headers";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import type { Provider } from "next-auth/providers/index";
import { z } from "zod";
import env from "@/env";
import { assertDefined } from "@/utils/assert";

const otpLoginSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export const lastSignInProvider = {
  set: async (provider: string) => {
    const cookieStore = await cookies();
    cookieStore.set("last_sign_in_provider", provider, {
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  },
  get: async (): Promise<string | undefined> => {
    const cookieStore = await cookies();
    return cookieStore.get("last_sign_in_provider")?.value;
  },
};

function withTestHelper(provider: Provider): Provider {
  if (process.env.RAILS_ENV !== "test") {
    return provider;
  }

  // create a test provider to bypass Oauth flow and mock login
  // refer to @test/helpers/auth#mockLogin
  return CredentialsProvider({
    id: provider.id,
    name: provider.name,
    credentials: {
      email: {
        label: "Email",
        type: "email",
      },
    },
    authorize(credentials) {
      return credentials ? { email: credentials.email, jwt: "", id: "", name: "" } : null;
    },
  });
}

export const authOptions = {
  providers: [
    withTestHelper(
      GoogleProvider({
        clientId: env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
      }),
    ),
    CredentialsProvider({
      id: "otp",
      name: "Email OTP",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "Enter your email",
        },
        otp: {
          label: "OTP Code",
          type: "text",
          placeholder: "Enter 6-digit OTP",
        },
      },
      async authorize(credentials, req) {
        const validation = otpLoginSchema.safeParse(credentials);

        if (!validation.success) throw new Error("Invalid email or OTP");

        try {
          const response = await fetch(`${assertDefined(req.headers?.origin)}/internal/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: validation.data.email,
              otp_code: validation.data.otp,
              token: env.API_SECRET_TOKEN,
            }),
          });

          if (!response.ok) {
            throw new Error(
              z.object({ error: z.string() }).safeParse(await response.json()).data?.error ||
                "Authentication failed, please try again.",
            );
          }

          const data = z
            .object({
              user: z.object({
                id: z.number(),
                email: z.string(),
                name: z.string().nullable(),
                legal_name: z.string().nullable(),
                preferred_name: z.string().nullable(),
              }),
              jwt: z.string(),
            })
            .parse(await response.json());

          return {
            ...data.user,
            id: data.user.id.toString(),
            name: data.user.name ?? "",
            legalName: data.user.legal_name ?? "",
            preferredName: data.user.preferred_name ?? "",
            jwt: data.jwt,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account) return true;

      await lastSignInProvider.set(account.provider);
      if (account.provider === "otp") {
        return true;
      }

      try {
        const data = await requestSignIn("/internal/oauth", {
          email: user.email,
        });

        user.id = data.user.id.toString();
        user.email = data.user.email;
        user.name = data.user.name ?? "";
        user.legalName = data.user.legal_name ?? "";
        user.preferredName = data.user.preferred_name ?? "";
        user.jwt = data.jwt;
        return true;
      } catch {
        return false;
      }
    },
    jwt({ token, user }) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- next-auth types are wrong
      if (!user) return token;
      token.jwt = user.jwt;
      token.legalName = user.legalName ?? "";
      token.preferredName = user.preferredName ?? "";
      return token;
    },
    session({ session, token }) {
      return { ...session, user: { ...session.user, ...token, id: token.sub } };
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: env.NEXTAUTH_SECRET,
} satisfies NextAuthOptions;

const userDataSchema = z.object({
  user: z.object({
    id: z.number(),
    email: z.string(),
    name: z.string().nullable(),
    legal_name: z.string().nullable(),
    preferred_name: z.string().nullable(),
  }),
  jwt: z.string(),
});

async function requestSignIn(path: string, body: Record<string, string>): Promise<z.infer<typeof userDataSchema>> {
  const baseURL = assertDefined((await headers()).get("origin"));
  const response = await fetch(`${baseURL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      token: env.API_SECRET_TOKEN,
    }),
  });

  if (!response.ok) {
    if (response.headers.get("Content-Type")?.includes("text/html")) {
      throw new Error(`Unexpected server response: ${await response.text()}`);
    } else {
      throw new Error(z.object({ error: z.string() }).safeParse(await response.json()).data?.error || "Oauth failed");
    }
  }

  return userDataSchema.parse(await response.json());
}

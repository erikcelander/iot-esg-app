"use server";

import { SessionData, sessionOptions } from "./lib/session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const get = async () => {};

export const getSession = async () => {
  let session = await getIronSession<SessionData>(cookies(), sessionOptions);

  const now = Date.now();
  const refreshExpires = new Date(session?.refreshExpires!).getTime() - 3600000;

  if (
    Object.keys(session).length === 0 ||
    now >= refreshExpires ||
    !session?.accessToken ||
    !session?.refreshToken ||
    !session?.expires ||
    !session?.refreshExpires
  ) {
    return undefined;
  }

  return session;
};

export const login = async () => {
  const session = await getSession();
  if (session !== undefined) session!.destroy();

  const redirectUri = encodeURIComponent(
    `${process.env.NEXT_PUBLIC_YGGIO_REDIRECT_URI}`,
  );
  const clientId = encodeURIComponent(
    `${process.env.NEXT_PUBLIC_YGGIO_CLIENT_ID}`,
  );
  const url = `${process.env.NEXT_PUBLIC_AUTHORIZATION_ENDPOINT}/?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid`;

  redirect(url);
};

export const logout = async () => {
  const session = await getSession();
  session!.destroy();
  redirect("/");
};

export const getNodes = async (token: string) => {
  let response;
  let nodes;

  try {
    response = await fetch("https://staging.yggio.net/api/iotnodes", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    nodes = await response.json();
  } catch (e) {
    console.log(e);
    return undefined;
  }

  return nodes;
};

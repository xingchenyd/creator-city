import { supabase } from "../lib/supabase";

export type DemoSession = {
  email: string;
  displayName: string;
  signedInAt: string;
  mode?: "account" | "guest";
};

const SESSION_KEY = "creator-city-session";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function passwordFor(rawPassword: string) {
  const hash = await sha256Hex(`creator-city-password:${rawPassword}`);
  return `Cc-${hash}`;
}

function displayNameFor(nameOrEmail: string) {
  const value = nameOrEmail.trim();
  const localName = value.includes("@") ? value.split("@")[0] : value;
  return (localName || "creator").replace(/[._-]+/g, " ");
}

function persistSession(session: DemoSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function isGuestSession(session = loadSession()): boolean {
  return session?.mode === "guest";
}

export function loadSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as DemoSession) : null;
  } catch {
    return null;
  }
}

function makeSession(email: string, displayName?: string): DemoSession {
  return {
    email: normalizeEmail(email),
    displayName: displayName?.trim() || displayNameFor(email),
    signedInAt: new Date().toISOString(),
    mode: "account",
  };
}

export async function createGuestSession(): Promise<DemoSession> {
  await supabase?.auth.signOut();
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem("creator-city-profile:guest");
  const session: DemoSession = {
    email: "",
    displayName: "游客",
    signedInAt: new Date().toISOString(),
    mode: "guest",
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function signInSession(emailInput: string, password = ""): Promise<DemoSession> {
  const email = normalizeEmail(emailInput);
  const cloudPassword = await passwordFor(password);
  let displayName = displayNameFor(email);

  if (supabase) {
    const login = await supabase.auth.signInWithPassword({ email, password: cloudPassword });
    if (login.error) throw new Error("账号或密码不正确，请先注册或重新输入。");
    displayName = String(login.data.user?.user_metadata?.display_name || login.data.user?.user_metadata?.full_name || displayName);
  }

  const session = makeSession(email, displayName);
  persistSession(session);
  return session;
}

export async function registerSession(emailInput: string, password = ""): Promise<DemoSession> {
  const email = normalizeEmail(emailInput);
  const cloudPassword = await passwordFor(password);
  const displayName = displayNameFor(email);

  if (supabase) {
    const signup = await supabase.auth.signUp({
      email,
      password: cloudPassword,
      options: { data: { display_name: displayName, full_name: displayName } },
    });
    if (signup.error) {
      const message = signup.error.message.toLowerCase();
      if (message.includes("already") || message.includes("registered")) {
        throw new Error("这个账号已经注册过了，请直接登录。");
      }
      throw signup.error;
    }
    if (signup.data.user && signup.data.user.identities?.length === 0) {
      throw new Error("这个账号已经注册过了，请直接登录。");
    }
    if (!signup.data.session) {
      throw new Error("Supabase 邮箱确认已开启。演示时请先关闭邮箱确认，或到邮箱里确认账号。");
    }
  }

  const session = makeSession(email, displayName);
  persistSession(session);
  return session;
}

export const createSession = signInSession;

export async function clearSession(): Promise<void> {
  if (typeof window === "undefined") return;
  await supabase?.auth.signOut();
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export async function hydrateSession(): Promise<DemoSession | null> {
  if (typeof window === "undefined") return null;
  const storedSession = loadSession();
  if (isGuestSession(storedSession)) return storedSession;
  if (!supabase) return loadSession();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) return loadSession();
  const displayName = String(user.user_metadata?.display_name || user.user_metadata?.username || user.email.split("@")[0]);
  const session = { email: user.email, displayName, signedInAt: new Date().toISOString(), mode: "account" as const };
  persistSession(session);
  return session;
}

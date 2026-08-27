export interface AuthUser {
  email: string;
  isPro: boolean;
  plan: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = "imagechopper_auth_token";

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);

export const setStoredToken = (token: string | null) => {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
};

const parseJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const loginWithPassword = async (
  email: string,
  password: string
): Promise<AuthSession> => {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Sign-in failed.");
  }
  if (!data?.token || !data?.user) {
    throw new Error("Unexpected sign-in response.");
  }
  setStoredToken(data.token);
  return { token: data.token, user: data.user as AuthUser };
};

export const fetchCurrentUser = async (token = getStoredToken()): Promise<AuthUser | null> => {
  if (!token) return null;
  const response = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    setStoredToken(null);
    return null;
  }
  const data = await parseJson(response);
  return (data?.user as AuthUser) || null;
};

export const logoutSession = async () => {
  const token = getStoredToken();
  setStoredToken(null);
  if (!token) return;
  try {
    await fetch("/api/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // ignore network errors on logout
  }
};

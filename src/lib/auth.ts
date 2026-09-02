export interface AuthUser {
  phone: string;
  last4: string | null;
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

const apiFetch = (url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers || {});
  const token = getStoredToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, { ...init, credentials: "include", headers });
};

export const sendLoginCode = async (phone: string): Promise<void> => {
  const response = await apiFetch("/api/auth/otp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Could not send the login code.");
  }
};

export const verifyLoginCode = async (phone: string, code: string): Promise<AuthSession> => {
  const response = await apiFetch("/api/auth/otp/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Could not sign in.");
  }
  if (!data?.token || !data?.user) {
    throw new Error("Unexpected sign-in response.");
  }
  setStoredToken(data.token);
  return { token: data.token, user: data.user as AuthUser };
};

export const displayName = (user: AuthUser | null) => {
  if (!user) return null;
  return user.last4 ? `••${user.last4}` : user.phone || null;
};

export const fetchCurrentUser = async (): Promise<AuthUser | null> => {
  const response = await apiFetch("/api/me");
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
  try {
    await apiFetch("/api/logout", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    // ignore network errors on logout
  }
};

export interface AutoSelectZone {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export const requestAutoSelect = async (payload: {
  imageDataUrl: string;
  imageWidth: number;
  imageHeight: number;
}): Promise<AutoSelectZone[]> => {
  const response = await apiFetch("/api/auto-select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Auto Select failed.");
  }
  if (!Array.isArray(data?.zones) || data.zones.length === 0) {
    throw new Error("No zones found.");
  }
  return data.zones as AutoSelectZone[];
};

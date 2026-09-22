// The only user fields the app chrome needs (a plain value, safe to pass to client components).
export type ShellUser = {
  name: string | null;
  email: string;
  role: string;
};

export const displayName = (u: ShellUser) => u.name || u.email;
export const initialOf = (u: ShellUser) => displayName(u).charAt(0).toUpperCase();

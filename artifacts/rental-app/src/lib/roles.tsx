import { createContext, useContext } from "react";

export type UserRole = "admin" | "limpieza";

type RoleContextType = {
  role: UserRole;
  email: string;
};

export function getRoleFromEmail(email: string | undefined | null): UserRole {
  if (!email) return "admin";
  return email.toLowerCase().includes("limpieza") ? "limpieza" : "admin";
}

export function filterPropiedadesPorRol<T extends { nombre: string }>(
  propiedades: T[],
  role: UserRole
): T[] {
  if (role !== "limpieza") return propiedades;
  return propiedades.filter(p => {
    const n = p.nombre.toLowerCase();
    return n.includes("roatán") || n.includes("roatan") || n.includes("las palmas");
  });
}

const RoleContext = createContext<RoleContextType>({ role: "admin", email: "" });

export function RoleProvider({ role, email, children }: { role: UserRole; email: string; children: React.ReactNode }) {
  return <RoleContext.Provider value={{ role, email }}>{children}</RoleContext.Provider>;
}

export function useRole(): UserRole {
  return useContext(RoleContext).role;
}

export function useUserEmail(): string {
  return useContext(RoleContext).email;
}

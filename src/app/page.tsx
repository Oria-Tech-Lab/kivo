import { redirect } from "next/navigation";

/**
 * Raíz de la app: redirige inmediatamente al dashboard.
 * El middleware de auth interceptará la ruta si no hay sesión activa
 * y redirigirá a /login.
 */
export default function RootPage() {
  redirect("/inicio");
}

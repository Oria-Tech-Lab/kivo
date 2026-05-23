import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases de Tailwind de forma segura (shadcn/ui convention)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un monto en centavos a string en soles peruanos
 * Todos los montos internos son INTEGER (centavos) para evitar errores de punto flotante
 */
export function formatMoney(centavos: number): string {
  const soles = centavos / 100;
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(soles);
}

/**
 * Convierte soles (input del usuario) a centavos (almacenamiento)
 */
export function solesToCentavos(soles: number): number {
  return Math.round(soles * 100);
}

/**
 * Convierte centavos (almacenamiento) a soles (display/input)
 */
export function centavosToSoles(centavos: number): number {
  return centavos / 100;
}

/**
 * Formatea una fecha en hora de Lima (America/Lima, UTC-5)
 * Las fechas se almacenan en UTC internamente
 */
export function formatDate(date: Date | string, format: "short" | "long" | "time" = "short"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "America/Lima",
    ...(format === "short" && { day: "2-digit", month: "2-digit", year: "numeric" }),
    ...(format === "long" && {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    ...(format === "time" && {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
  return new Intl.DateTimeFormat("es-PE", options).format(d);
}

/**
 * Formatea un porcentaje para display
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Calcula días hábiles entre dos fechas (excluye sábados y domingos)
 */
export function diasHabiles(desde: Date, hasta: Date): number {
  let count = 0;
  const current = new Date(desde);
  while (current < hasta) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Calcula el 5to día hábil del mes siguiente (fecha límite SPOT detracciones)
 */
export function fechaLimiteSpot(fechaOperacion: Date): Date {
  const siguienteMes = new Date(fechaOperacion);
  siguienteMes.setMonth(siguienteMes.getMonth() + 1, 1); // 1ro del mes siguiente

  let diasHabilesCount = 0;
  while (diasHabilesCount < 5) {
    const day = siguienteMes.getDay();
    if (day !== 0 && day !== 6) diasHabilesCount++;
    if (diasHabilesCount < 5) siguienteMes.setDate(siguienteMes.getDate() + 1);
  }
  return siguienteMes;
}

/**
 * Trunca un RUC para display seguro (nunca exponer completo en logs)
 */
export function maskRuc(ruc: string): string {
  if (ruc.length < 4) return "****";
  return `***${ruc.slice(-4)}`;
}

/**
 * Genera un color de badge según nivel de alerta
 */
export function alertaColorClass(nivel: "critico" | "advertencia" | "informativo"): string {
  const map = {
    critico: "alert-critico",
    advertencia: "alert-advertencia",
    informativo: "alert-informativo",
  };
  return map[nivel];
}

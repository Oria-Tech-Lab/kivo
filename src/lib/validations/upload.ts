/**
 * Validación de archivos adjuntos — Kivo
 *
 * Seguridad: validar por magic bytes (firma real del archivo),
 * NO por extensión ni Content-Type del cliente (ambos son falsificables).
 */

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Magic bytes de cada tipo permitido
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

export type AllowedMimeType = keyof typeof MAGIC_BYTES;

/**
 * Valida un archivo por tamaño, MIME type y firma de bytes reales.
 * Lanza Error con mensaje en español si la validación falla.
 */
export async function validateFile(file: File): Promise<void> {
  // 1. Tamaño máximo
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("El archivo es demasiado grande. El tamaño máximo es 10 MB.");
  }

  // 2. Tipo MIME declarado por el cliente
  const allowedTypes = Object.keys(MAGIC_BYTES) as AllowedMimeType[];
  if (!allowedTypes.includes(file.type as AllowedMimeType)) {
    throw new Error(
      "Tipo de archivo no permitido. Solo se aceptan JPEG, PNG y PDF."
    );
  }

  // 3. Validación real: magic bytes del contenido
  const buffer = await file.slice(0, 8).arrayBuffer();
  const bytes = Array.from(new Uint8Array(buffer));
  const validSignatures = MAGIC_BYTES[file.type];
  const isValid = validSignatures.some((sig) =>
    sig.every((byte, i) => bytes[i] === byte)
  );

  if (!isValid) {
    throw new Error(
      "El contenido del archivo no coincide con su tipo. Por favor, verifica el archivo."
    );
  }
}

/**
 * Genera la ruta de almacenamiento en Supabase Storage.
 * NUNCA usar el nombre original del usuario (XSS / path traversal).
 * Formato: {org_id}/{proyecto_id}/{gasto_id}/{timestamp}.{ext}
 */
export function generateStoragePath(
  orgId: string,
  proyectoId: string,
  gastoId: string,
  mimeType: string
): string {
  const ext =
    mimeType === "application/pdf"
      ? "pdf"
      : mimeType === "image/png"
      ? "png"
      : "jpg";
  const timestamp = Date.now();
  return `${orgId}/${proyectoId}/${gastoId}/${timestamp}.${ext}`;
}

/**
 * Valida el tamaño de un buffer en el servidor (para Route Handlers)
 */
export function validateFileSize(sizeBytes: number): void {
  if (sizeBytes > MAX_SIZE_BYTES) {
    throw new Error("El archivo excede el tamaño máximo de 10 MB.");
  }
}

/**
 * Valida magic bytes en el servidor desde un Buffer/ArrayBuffer
 */
export function validateMagicBytes(
  buffer: Uint8Array,
  declaredMimeType: string
): void {
  const allowedTypes = Object.keys(MAGIC_BYTES);
  if (!allowedTypes.includes(declaredMimeType)) {
    throw new Error("Tipo de archivo no permitido.");
  }

  const bytes = Array.from(buffer.slice(0, 8));
  const validSignatures = MAGIC_BYTES[declaredMimeType];
  const isValid = validSignatures.some((sig) =>
    sig.every((byte, i) => bytes[i] === byte)
  );

  if (!isValid) {
    throw new Error("El contenido del archivo no coincide con su tipo declarado.");
  }
}

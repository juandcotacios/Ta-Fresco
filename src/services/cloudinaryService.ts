const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/**
 * Sube una imagen (data URI en base64) a Cloudinary y devuelve la URL pública.
 * Se usa para la foto de perfil, ya que Firebase Storage requiere plan Blaze.
 */
export async function subirImagenCloudinary(base64DataUri: string): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary no está configurado. Revisa el archivo .env");
  }

  const formData = new FormData();
  formData.append("file", base64DataUri);
  formData.append("upload_preset", UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok || !data.secure_url) {
    console.log("Respuesta de Cloudinary:", data);
    throw new Error(data?.error?.message || "No se pudo subir la imagen.");
  }

  return data.secure_url as string;
}
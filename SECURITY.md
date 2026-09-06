# Seguridad de Ta-Fresco

## Configuración y secretos

- Copia `.env.example` como `.env` en cada entorno. Nunca subas `.env`.
- La clave de Firebase que estuvo en el repositorio debe revocarse y reemplazarse en Google Cloud Console. Después, configura la nueva clave solo en el proveedor de variables de entorno y en los equipos autorizados.
- Restringe la nueva API key al proyecto Firebase y a las APIs mínimas necesarias. Para Android usa la firma SHA-1/SHA-256 de la app; para web, los dominios de producción.
- Configura Firebase App Check para Firestore, Authentication y cualquier servicio público antes de producción.
- El `upload preset` de Cloudinary usado por una app móvil no es secreto. Debe ser unsigned, limitado a imágenes, con tamaño máximo, carpeta fija y sin transformaciones arbitrarias. Para una protección completa, reemplázalo por cargas firmadas desde un backend.

## Firestore

Las reglas de `firestore.rules` son parte del código fuente. Antes de desplegar, revísalas con el emulador y publícalas usando Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

Los roles solo pueden modificarse desde una cuenta administradora. Los usuarios normales crean una solicitud de tienda; no pueden otorgarse el rol de tendero desde el cliente.

## Operaciones de pago

La app actual registra pedidos desde el cliente. Antes de procesar dinero real, la creación de pedidos, el cálculo de precios, el stock y la confirmación de pagos deben moverse a una Cloud Function o backend autenticado. El cliente nunca debe ser la fuente de verdad para esos valores.

## Alerta ya emitida en GitHub

Quitar la clave del código no elimina copias existentes en el historial. Tras rotarla, marca la alerta de GitHub como revocada. Reescribir y forzar el historial compartido requiere coordinación explícita con todas las personas que usan el repositorio.

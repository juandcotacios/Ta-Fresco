# Frescapp

This is an app created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app) called Frescapp, in which the interprice will sell products through the app. 
## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

## Instalar en iPhone sin App Store

El proyecto ya genera una app nativa con Expo; para iPhone se necesita una compilación firmada, no Expo Go. Antes de compilar:

1. Registra en Firebase una app iOS con el identificador `com.juandcotacios.tafresco` y habilita Google en Authentication.
2. Crea un cliente OAuth de tipo iOS para ese mismo identificador. Copia su Client ID a `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` en `.env` y al entorno `preview` de EAS. El esquema inverso requerido por Google se genera automáticamente desde ese Client ID.
3. Carga también en EAS `preview` las variables Firebase y Cloudinary que aparecen en `.env.example`.
4. Registra el iPhone para distribución interna y compila:

   ```bash
   npx eas-cli@latest device:create
   npx eas-cli@latest build --platform ios --profile preview
   ```

   Instala el `.ipa` desde el enlace/QR que entrega EAS. En iOS 16 o posterior, activa Modo de desarrollador cuando el teléfono lo solicite.

La distribución interna de iOS requiere firma ad hoc y un Apple Developer Program activo; cada iPhone debe estar registrado para instalar la compilación. No es necesario publicar la app en App Store.

### Probar en un iPhone físico desde Windows con MobAI

También puedes instalar un IPA sin membresía paga usando MobAI para volver a firmar la compilación durante la instalación con una cuenta Apple gratuita. Esta firma de prueba vence cada 7 días, así que luego hay que volver a firmar e instalar la app.

1. Instala MobAI para Windows y iTunes (necesario para que MobAI detecte iPhones). Conecta el iPhone por USB, desbloquéalo y acepta **Confiar en este ordenador**.
2. En MobAI, detén cualquier dispositivo de **CI Devices** y confirma que el iPhone físico aparezca en **Devices**. Inicia su bridge.
3. Desde PowerShell, en la carpeta del proyecto, genera el IPA:

   ```powershell
   builder ios build
   ```

   El build usa `Release`, toma los cambios locales no confirmados y descarga el IPA en `dist`. Las variables de Firebase, Google y Cloudinary se leen de los **Repository secrets** de GitHub configurados para el workflow. `.env` se mantiene fuera del repositorio y del snapshot.

4. Instálalo en el iPhone conectado:

   ```powershell
   $ipa = Get-ChildItem .\dist\*.ipa | Sort-Object LastWriteTime -Descending | Select-Object -First 1
   builder mobai install $ipa.FullName
   ```

   Si MobAI solicita una cuenta Apple para volver a firmar la app, puedes usar una cuenta gratuita dedicada a pruebas. No se publica en App Store. La alternativa EAS anterior sí requiere membresía paga para distribución ad hoc.

## Mostrar Ta Fresco en un simulador iOS desde Windows

Para una demostración en un simulador, puedes usar [ios-builder](https://github.com/MobAI-App/ios-builder) con GitHub Actions y MobAI. La app se compila en un runner macOS de GitHub y el simulador aparece en MobAI; no instala la app en el iPhone ni publica nada en App Store. El simulador de MobAI es gratis con una cuenta gratuita. Los minutos de macOS sí usan la cuota de GitHub Actions y pueden generar cobros si se agota la cuota gratuita y tienes sobrecostos habilitados.

1. Instala [MobAI para Windows](https://mobai.run/download) e inicia sesión con el plan gratuito.
2. Descarga `builder-windows-amd64.exe` desde [Releases de ios-builder](https://github.com/MobAI-App/ios-builder/releases), renómbralo a `builder.exe` y agrégalo al `PATH` de Windows.
3. En una terminal abierta en la carpeta de este proyecto, autentica GitHub y genera los flujos de iOS:

   ```powershell
   builder auth github
   builder init
   ```

   Revisa los archivos que genera antes de confirmarlos y subirlos. No inicies una compilación hasta completar los secretos del paso siguiente.
4. En MobAI, crea una clave en **Account → API Keys**. En GitHub, abre el repositorio **Settings → Secrets and variables → Actions → New repository secret** y guárdala como `MOBAI_API_KEY`.
5. El flujo debe recibir la configuración que normalmente está en `.env`, porque `.env` se ignora y no se envía a GitHub. Guarda en los secretos del repositorio los valores de Firebase y Cloudinary listados en `.env.example`, además de `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. En el archivo generado `.github/workflows/ios-share.yml`, mapea esas variables como `env` del trabajo `simulator`, por ejemplo:

   Añade este bloque dentro de `jobs.simulator`, conservando el `runs-on` y los `steps` que genera ios-builder:

   ```yaml
   env:
     EXPO_PUBLIC_FIREBASE_API_KEY: ${{ secrets.EXPO_PUBLIC_FIREBASE_API_KEY }}
     EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: ${{ secrets.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN }}
     EXPO_PUBLIC_FIREBASE_PROJECT_ID: ${{ secrets.EXPO_PUBLIC_FIREBASE_PROJECT_ID }}
     EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: ${{ secrets.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET }}
     EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID }}
     EXPO_PUBLIC_FIREBASE_APP_ID: ${{ secrets.EXPO_PUBLIC_FIREBASE_APP_ID }}
     EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: ${{ secrets.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID }}
     EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: ${{ secrets.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID }}
     EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME: ${{ secrets.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME }}
     EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET: ${{ secrets.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET }}
   ```

   El paso generado ya configura `MOBAI_API_KEY` para compartir el simulador. Conserva ese bloque. No pegues los valores de `.env` en el YAML ni en el chat.
6. Sube a GitHub `builder.json`, los flujos generados y el mapeo de variables. Luego, desde la carpeta del proyecto, inicia una sesión corta:

   ```powershell
   builder ios share --duration 10m
   ```

7. En MobAI, abre **CI Devices** para ver e interactuar con el simulador. Libéralo al terminar para detener el runner y dejar de consumir minutos.

Esta opción verifica la app nativa en un simulador iOS, incluido el flujo de Google si las variables de entorno están configuradas. Para instalarla en el iPhone físico se necesita una compilación firmada, un proceso distinto al simulador.

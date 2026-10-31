/**
 * The native Google Sign-In plugin needs the reversed iOS OAuth client ID as
 * a URL scheme. Derive it from the same iOS client ID used by the app so the
 * two values cannot drift apart.
 */
module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const iosUrlScheme = iosClientId
    ? `com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, "")}`
    : "com.googleusercontent.apps.TU_IOS_CLIENT_ID";

  const plugins = (config.plugins || []).map((plugin) => {
    if (
      Array.isArray(plugin) &&
      plugin[0] === "react-native-nitro-google-signin"
    ) {
      return [plugin[0], { ...plugin[1], iosUrlScheme }];
    }
    return plugin;
  });

  return { ...config, plugins };
};

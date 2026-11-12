/**
 * The native Google Sign-In plugin needs the reversed iOS OAuth client ID as
 * a URL scheme. Derive it from the same iOS client ID used by the app so the
 * two values cannot drift apart.
 */
module.exports = ({ config }) => {
  const iosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    "799200713865-9s1m9do6an0pc7l0qn0hqi3grd6dqogu.apps.googleusercontent.com";
  const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace(
    /\.apps\.googleusercontent\.com$/,
    ""
  )}`;

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

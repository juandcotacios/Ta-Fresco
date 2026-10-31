export const GOOGLE_AUTH = {
  webClientId: "799200713865-nca4dm471ocs4klvlhpohkkkq465kjpp.apps.googleusercontent.com",
  androidClientId: "799200713865-j9ehsgj1am30d08upua8buj04jejmr9g.apps.googleusercontent.com",
  // Replace this with the iOS OAuth client ID created for the bundle ID in
  // app.json. It is public app configuration, not a client secret.
  iosClientId:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    "799200713865-9s1m9do6an0pc7l0qn0hqi3grd6dqogu.apps.googleusercontent.com",
};

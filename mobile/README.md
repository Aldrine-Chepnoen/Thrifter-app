# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Building for app stores

App identity is set in `app.json`: display name "Thrifter", bundle identifier / package name `com.thrifterug.app` (placeholder — confirm before the first EAS build, since it becomes permanent once registered with Apple/Google). `eas.json` has `development`/`preview`/`production` build profiles scaffolded; `EXPO_PUBLIC_API_URL` in the `preview`/`production` profiles is a placeholder pointing at `https://your-backend-domain.example` and must be replaced with the real backend URL before building for real.

Still blocked on having Apple Developer / Google Play accounts:
- `eas login` / `eas init` (needs a free Expo account — separate from Apple/Google — to create the EAS project and fill in `cli.version`/`extra.eas.projectId`)
- `eas submit` credentials: Apple Team ID + App Store Connect API key, and a Google Play service account JSON
- Real app icon / splash / adaptive-icon assets — currently the default Expo template placeholders in `assets/images/`, which build fine but aren't final branding. The web app's `apple-touch-icon.png` is a photo of the wordmark, not square icon artwork, so it isn't a drop-in replacement.
- Privacy policy URL for the store listings — the web app already has one hosted at `/thrifter-privacy-policy.pdf` on production; reuse that once the production domain is confirmed.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

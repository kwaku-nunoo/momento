<div align="center">

</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/1e7fd67a-a48b-4cda-ad17-297af18411e3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

To test QR codes with a phone on the same Wi-Fi network, open the app on your computer at `http://localhost:3000`. The QR code automatically uses your computer's local network address. Keep the phone and computer on the same Wi-Fi network, and allow incoming connections if macOS asks.

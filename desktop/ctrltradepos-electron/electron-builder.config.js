// electron-builder configuration.
//
// Windows code signing is what stops Defender SmartScreen from warning users
// that the installer is from an "unknown publisher". Signing is enabled
// automatically when the relevant credentials are present in the environment,
// and skipped (producing an unsigned build) otherwise — so local builds and
// builds made before a certificate is purchased keep working unchanged.
//
// Two Windows signing paths are supported (pick whichever the certificate uses):
//
//   1. Azure Trusted Signing (cloud — no hardware token, works in CI).
//      Set these environment variables:
//        AZURE_CODE_SIGNING_ENDPOINT   e.g. https://eus.codesigning.azure.net/
//        AZURE_CODE_SIGNING_ACCOUNT    Trusted Signing account name
//        AZURE_CERTIFICATE_PROFILE     certificate profile name
//        WINDOWS_PUBLISHER_NAME        (optional) display name, defaults to CtrlTrade
//      plus the standard Azure auth vars read by the signing tool:
//        AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
//
//   2. A PFX / .p12 certificate file (OV or EV exported to a file).
//      Set CSC_LINK (path or base64 of the .pfx) and CSC_KEY_PASSWORD.
//      electron-builder reads these automatically — no config needed below.
//
// See README.md → "Code signing & notarisation" for full setup steps.

/** @type {import("electron-builder").Configuration} */
const config = {
  appId: "com.ctrltrade.pos",
  productName: "CtrlTradePos",
  icon: "assets/icon",
  directories: {
    output: "dist",
  },
  files: ["src/main.js", "www/**", "assets/**"],
  win: {
    target: "nsis",
  },
  mac: {
    target: "dmg",
  },
};

const azureEndpoint = process.env.AZURE_CODE_SIGNING_ENDPOINT;
const azureAccount = process.env.AZURE_CODE_SIGNING_ACCOUNT;
const azureProfile = process.env.AZURE_CERTIFICATE_PROFILE;

if (azureEndpoint && azureAccount && azureProfile) {
  config.win.azureSignOptions = {
    publisherName: process.env.WINDOWS_PUBLISHER_NAME || "CtrlTrade",
    endpoint: azureEndpoint,
    codeSigningAccountName: azureAccount,
    certificateProfileName: azureProfile,
  };
}

module.exports = config;

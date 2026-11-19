# Cross-Net Mobile

An Expo React Native multi-chain wallet app with a built-in dapp browser
and WalletConnect support.

Cross-Net Mobile creates or imports Ethereum and Polygon wallets, shows
native and token balances through Alchemy, sends transactions and connects
to dapps from an in-app WebView browser over WalletConnect. Navigation is
file-based with expo-router.

- **Wallet management.** Create a random wallet or import by private key
  or mnemonic, per chain, backed by ethers v5.
- **Ethereum and Polygon.** Mainnet providers plus Goerli and Mumbai
  testnet entries in `services/WalletService.ts`; Solana and Binance are
  declared in the `ChainType` enum but not wired up.
- **Portfolio.** Native balance plus ERC-20 token balances and metadata
  fetched with the Alchemy SDK.
- **Send and sign.** Simple ETH sends and message signing from the wallet
  tab.
- **Dapp browser.** The home tab embeds a WebView and initialises
  WalletConnect `Web3Wallet`/`SignClient` for session requests.
- **Expo throughout.** Expo SDK 52, React Native 0.76, typed routes and
  the new architecture enabled.

## Run it

### Prerequisites

- Node.js and npm
- Expo Go on a device, or an Android emulator / iOS simulator
- An Alchemy API key and a WalletConnect Cloud project ID

### Configure

Two placeholders must be replaced before the wallet features work:

- `services/WalletService.ts` - `YOUR_ALCHEMY_API_KEY` in `setupProviders`
- `app/(tabs)/index.tsx` - `YOUR_PROJECT_ID` for WalletConnect

### Start

```sh
npm install
npm start          # expo start --tunnel
```

Other targets:

```sh
npm run android    # expo start --android
npm run ios        # expo start --ios --tunnel
npm run web        # expo start --web --tunnel
npm test           # jest --watchAll (jest-expo preset)
npm run lint       # expo lint
```

The `--tunnel` flags suit environments such as Project IDX (a `.idx/`
workspace config is included); remove them for plain local development.

## Project structure

```
app/
  (tabs)/
    index.tsx       # Dapp browser tab (WebView + WalletConnect)
    wallet.tsx      # Wallet, balances and sends
    explore.tsx     # Placeholder template screen
    settings.tsx    # Settings rows (partly placeholder)
  _layout.tsx       # Root layout
components/         # Themed view/text, tab bar, UI primitives
services/
  WalletService.ts  # Singleton: keys, providers, Alchemy, sends
hooks/              # Colour scheme and theme helpers
constants/          # Colour tokens
```

## Security notes

- Private keys are stored unencrypted in AsyncStorage under
  `wallet_<chain>`. Treat this build as development grade and use test
  accounts.
- The Alchemy key and WalletConnect project ID are compiled into the app
  bundle once set.

## License

Apache-2.0 - see [LICENSE](LICENSE) and [NOTICE](NOTICE).

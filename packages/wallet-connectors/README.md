# `@concordium/wallet-connectors`

Interfaces for interacting with wallets along with implementations for Browser Wallet and WalletConnect (v2).
It’s written in TypeScript and has no dependencies to any UI framework.

The library takes away the complexity involved with interacting with both Browser Wallet and Mobile Wallets (via WalletConnect)
such that dApps only need to interact with interfaces that abstract away the underlying protocol.

## Interfaces

### `WalletConnector`

Wraps a low-level client for the underlying protocol and handle events emitted by this client.
A delegate object is passed to the connector on construction to receive events in a standardized format.
The implementation may support multiple connections being instantiated from a single connector.

### `WalletConnection`

A connection obtained by invoking `connect` on the connector. It may be used to send transactions to the wallet for approval and submission.

## Build

Run

```shell
yarn
yarn build
```

to compile the TypeScript files into `./dist` along with type declarations and source maps.

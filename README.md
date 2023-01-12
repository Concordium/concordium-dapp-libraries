# Concordium dApp Libraries

A collection of libraries to make it easy for dApp developers to create robust dApps that do interesting things
on the Concordium blockchain.
The aim is:

1. Provide a coherent set of building blocks for making it as easy as possible for developers to build web-based dApps.
2. Identify common patterns and wrap them into flexible components that work nicely together.

## Contents

The project includes the following libraries:

- [`@concordium/wallet-connectors`](./packages/wallet-connectors):
  Interfaces for interacting with wallets along with implementations for Browser Wallet and WalletConnect (v2).
  It’s written in TypeScript and has no dependencies to any UI framework.

- [`@concordium/react-components`](./packages/react-components):
  React components and hooks for implementing common behaviors.
  The component only manage React state and pass data to application components.
  They don’t render any HTML nor do styling.

The project also includes a sample dApp [`concordium-dapp-contractupdate`](./samples/contractupdate) as an example
of how to integrate the libraries.
It allows the user to invoke any method on any smart contract on the chain either via the Browser Wallet or WalletConnect.

## Why use these libraries?

It takes away the complexity of interacting with both Browser Wallet and Mobile Wallets (via WalletConnect).
Instead, the dApps only interact with an interface that abstracts away the underlying protocol.
The implementations of this interface also handle the entire lifecycle of the lower level clients and do error handling.

The components do as much as possible to help make sure that the dApp is connected to a wallet/account on the expected network.
They expect/allow the dApp to change between networks and handle it gracefully.

The libraries are layered in order to reduce their dependencies as much as possible:
The lowest layers don’t depend on any UI frameworks and are therefore applicable anywhere.
The higher ones provide components that are ready for use with supported frameworks (currently only React).

## Build

Run

```shell
yarn
yarn build
```

to build all the libraries into the `dist` subfolder of their respective paths.

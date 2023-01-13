# `@concordium/react-components`

React components and hooks for implementing common behaviors.
The component only manage React state and pass data to application components.
They don’t render any HTML nor do styling.

## Components

### [`WithWalletConnector`](./src/WithWalletConnector.ts)

Component that bridges [`@concordium/wallet-connectors`](../wallet-connectors) into a React context by
managing active connector, connection, connected account, network information, errors, etc. in its internal state.
This component significantly reduces the complexity of integrating with wallets,
even if one only need to support a single protocol and network.

## Hooks

### [`useWalletConnectorSelector`](./src/useWalletConnectorSelector.ts)

Hook for managing a connector button; connecting/disconnecting when clicked and computing its selected/connected/disabled state.

### [`useContractSelector`](./src/useContractSelector.ts)

Hook for managing the state of an input field and lookup smart contract info by its index.

## Build

Run

```shell
yarn
yarn build
```

to compile the TypeScript files into `./dist` along with type declarations and source maps.

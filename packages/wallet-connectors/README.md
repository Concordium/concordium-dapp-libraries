# `@concordium/wallet-connectors`

Interfaces for interacting with wallets along with implementations for Browser Wallet and WalletConnect (v2).
It’s written in TypeScript and has no dependencies to any UI framework.

The library takes away the complexity involved with interacting with both Browser Wallet and Mobile Wallets (via WalletConnect)
such that dApps only need to interact with interfaces that abstract away the underlying protocol.

## Interfaces

### `WalletConnector`

Wraps some low-level client for the underlying protocol that it represents and handles events emitted by this client.
A delegate object is passed to the connector on construction to receive events in a standardized format.
Implementations may support multiple connections being instantiated from a single connector.

### `WalletConnection`

A connection obtained by invoking `connect` on the connector. It may be used to send transactions to the wallet for approval and submission.

## Usage Example

First define a delegate `MyDelegate` for keeping track of the connected account and chain for each connection:

```typescript
import {
    BrowserWalletConnector,
    WalletConnectConnector,
    WalletConnection,
    WalletConnectionDelegate,
} from '@concordium/wallet-connectors';

class MyDelegate implements WalletConnectionDelegate {
    accounts = new Map<WalletConnection, string | undefined>();
    chains = new Map<WalletConnection, string | undefined>();

    onAccountChanged = (connection: WalletConnection, address: string | undefined) => {
        this.accounts.set(connection, address);
    };

    onChainChanged = (connection: WalletConnection, genesisHash: string) => {
        this.chains.set(connection, genesisHash);
    };

    onDisconnect = (connection: WalletConnection) => {
        this.accounts.delete(connection);
        this.chains.delete(connection);
    };
}
```

Then write some application code that only references the connection through the generic `WalletConnection` interface:

```typescript
async function doSomethingInteresting(connection: WalletConnection, account: string, ...) {
    ...
    const txHash = await connection.signAndSendTransaction(account, ...);
    ...
}
```

In the appropriate context, set up connectors for both Browser Wallet and WalletConnect
(adding appropriate values of `walletConnectOpts` and `network`) and open connections to both of them:

```typescript
const delegate = new MyDelegate();
const browserWalletConnector = await BrowserWalletConnector.create(delegate);
const walletConnectConnector = await WalletConnectConnector.create(walletConnectOpts, network, delegate);

const browserWalletConnection = await browserWalletConnector.connect();
const walletConnectConnection = await walletConnectConnector.connect();
```

The current state of all connections is available in the fields of `delegate`.
This is used when invoking the application function above:

```typescript
doSomethingInteresting(connection, delegate.accounts.get(connection)!, ...)
```

where `connection` is either `browserWalletConnection` or `walletConnectConnection`.

## Build

Run

```shell
yarn
yarn build
```

to compile the TypeScript files into `./dist` along with type declarations and source maps.

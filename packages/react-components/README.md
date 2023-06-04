# `@concordium/react-components`

React components and hooks for implementing features commonly needed by dApps.
The components only manage React state and pass data to application components - no actual HTML is being rendered.

As much as possible is done to help make sure that the dApp is connected to a wallet/account
on the expected network while taking into account that the user may decide to switch network.

## Components

### [`WithWalletConnector`](./src/WithWalletConnector.ts)

Component that bridges [`@concordium/wallet-connectors`](../wallet-connectors) into a React context by
managing connection state and network information.
This component significantly reduces the complexity of integrating with wallets,
even if one only need to support a single protocol and network.

The interface for managing the connectors is exposed through [`WalletConnectionProps`](./src/WithWalletConnector.ts#WalletConnectionProps)
which is passed to the child component.

_Example: Interact with wallets connected to Testnet:_

Initialize the network configuration and wrap the component `MyAppComponent` that needs to do wallet interaction
in `WithWalletConnector`:

```typescript jsx
import { Network, WalletConnectionProps, WithWalletConnector } from '@concordium/react-components';

const testnet: Network = {
    name: 'testnet',
    genesisHash: '4221332d34e1694168c2a0c0b3fd0f273809612cb13d000d5c2e00e85f50f796',
    jsonRpcUrl: 'https://json-rpc.testnet.concordium.com',
    ccdScanBaseUrl: 'https://testnet.ccdscan.io',
};

function MyRootComponent() {
    return <WithWalletConnector network={network}>{(props) => <MyAppComponent {...props} />}</WithWalletConnector>;
}

function MyAppComponent(props: WalletConnectionProps) {
    // TODO Manage connections using the interface exposed through WalletConnectionProps
    //      (usually using the helper hooks described below)...
}
```

Use `props.setActiveConnectorType(...)` from within `MyAppComponent` to set up a connector,
and make it available on `props.activeConnector`.
This is most easily done using [`useConnectorTypeStatus`](#useconnectortypestatus).

Connector types for the Browser Wallet and WalletConnect connectors are usually initialized like so:

```typescript
export const BROWSER_WALLET = ephemeralConnectorType(BrowserWalletConnector.create);
export const WALLET_CONNECT = ephemeralConnectorType(
    WalletConnectConnector.create.bind(undefined, WALLET_CONNECT_OPTS)
);
```

Initiate a connection by invoking `connect` on a connector.
This is most easily done using the helper hooks `useConnection`, `useConnect`, and `useDisconnect`:

```typescript
const { activeConnector, network, connectedAccounts, genesisHashes, ... } = props;
const { connection, setConnection, account, genesisHash } = useConnection(activeConnector, connectedAccounts, genesisHashes);
const [connectionError, setConnectionError] = useState('');
const { connect, isConnecting } = useConnect(activeConnector, setConnection, setConnectionError);
const { disconnect, isDisconnecting } = useDisconnect(connection, setConnectionError);
```

First `useConnection` maintains an "active" connection and extracts the available properties for this connection.
The hooks `useConnect` and `useDisconnect` wrap the actions of establishing and tearing down connections
for a given (in this case "active") connector.
They may share an error handling function to ensure that the errors don't "stick around" indefinitely:
They're easily dismissed, explicitly or implicitly, like for example when a connection is successfully established:

```typescript
useEffect(() => {
    if (connection) {
        setConnectionError('');
    }
}, [connection]);
```

While the two hook appear as companions in this example,
one could also place the "disconnect" button in a sub-component with its own error handling, if so desired.

With these hooks in place, the app uses the `connect` function to open a new connection from `activeConnector`
and `disconnect` to close it.
The fields `isConnecting`, `isDisconnecting`, and `connectionError` are used to render the connection status.
Once established, the connection and its state are exposed in the following fields:

-   `connection`: The `WalletConnection` object that the app uses to interact with the wallet.
    Is `undefined` if there is no established connection.
-   `account`: The account that `connection` is associated with in the wallet
    or the empty string if the connection isn't associated with an account.
-   `genesisHash`: The hash of the genesis block for the chain that `account` lives on
    if this value has been reported by the wallet or `undefined` otherwise.
    This may for instance be used to check that `account` lives on the expected network.
    Use with care as some wallets don't provide this value reliably.

All the fields hold the value `undefined` until the connection has been established and again after it's been disconnected.

See [the sample dApp](../../samples/contractupdate/src/Root.tsx) for a complete example.

## Hooks

### [`useConnectorTypeStatus`](./src/useConnectorTypeStatus.ts)

Helper hook for computing the selected/connected/disabled state of a given connector type.

_Example: Create a button for toggling a connector_

The button accepts all the `props` exposed by `WithWalletConnector`
as well as the particular `ConnectorType` that it manages:

```typescript jsx
import { ConnectorType, useConnectorTypeStatus, WalletConnectionProps } from '@concordium/react-components';

interface Props extends WalletConnectionProps {
    connectorType: ConnectorType;
    connectorName: string;
}

export function WalletConnectorButton(props: Props) {
    const { connectorType, connectorName, connection, activeConnectorType, activeConnector, setActiveConnectorType } = props;
    const { isActive, isConnected, isOtherConnected } = useConnectorTypeStatus(
        connectorType,
        connection,
        activeConnectorType,
        activeConnector,
    );
    return (
        // TODO Render button based on the computed properties and invoke `setActiveConnectorType` etc. on click...
    );
}
```

It's important that the `ConnectorType` reference passed to the hook is fixed.

See [the sample dApp](../../samples/contractupdate/src/WalletConnectorButton.tsx) for a complete example.

### [`useContractSelector`](./src/useContractSelector.ts)

Hook for managing the state of an input field and lookup smart contract info by its index.

_Example: Look up the info of a smart contract by its index specified in an input field_

```typescript jsx
import React, { useState } from 'react';
import { Network, useContractSelector, WalletConnection } from '@concordium/react-components';
import { ConcordiumGRPCClient } from '@concordium/web-sdk';

interface Props {
    rpc: ConcordiumGRPCClient | undefined;
}

export function ContractStuff({ rpc }: Props) {
    const [input, setInput] = useState('');
    const { selected, isLoading, validationError } = useContractSelector(rpc, input);
    return (
        // TODO Render a text input using `input`/`setInput`.
        // TODO Render the selected contract, if present.
    );
}
```

Use the hook [`useGrpcClient`](#usegrpcclient) below to obtain a `ConcordiumGRPCClient` instance.
See [the sample dApp](../../samples/contractupdate/src/App.tsx) for a complete example.

### [`useGrpcClient`](./src/useGrpcClient.ts)

React hook that obtains a gRPC Web client for interacting with a node on the appropriate network.

_Example: Periodically fetch height of "best block"_

```typescript
const rpc = useGrpcClient(network);
const [height, setHeight] = useState<bigint>();
useEffect(() => {
    const t = setInterval(() => {
        if (rpc) {
            rpc.getConsensusStatus()
                .then((s) => s.bestBlockHeight)
                .then(setHeight)
                .catch(console.error);
        }
    }, intervalMs);
    return () => clearTimeout(t);
}, [rpc]);
```

The client is also used as an input to the hook [`useContractSelector`](#usecontractselector) above.

## Build

Run

```shell
yarn
yarn build
```

to compile the TypeScript files into `./dist` along with type declarations and source maps.

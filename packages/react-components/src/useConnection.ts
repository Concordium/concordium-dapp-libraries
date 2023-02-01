import { WalletConnection, WalletConnector } from '@concordium/wallet-connectors';
import { useEffect, useState } from 'react';

interface Connection {
    /**
     * The current connection.
     */
    connection: WalletConnection | undefined;

    /**
     * Function for setting or resetting {@link connection}.
     * @param connection The wallet connection.
     */
    setConnection: (connection: WalletConnection | undefined) => void;

    /**
     * The selected account of the connection.
     */
    account: string | undefined;

    /**
     * The hash of the genesis block for the chain that {@link account} lives on.
     */
    genesisHash: string | undefined;
}

export function useConnection(
    connector: WalletConnector | undefined,
    connectedAccounts: Map<WalletConnection, string | undefined>,
    genesisHashes: Map<WalletConnection, string | undefined>
): Connection {
    const [connection, setConnection] = useState<WalletConnection>();
    useEffect(() => {
        setConnection(undefined);
        if (connector) {
            // When changing connector, select the first of any existing connections.
            const cs = connector.getConnections();
            if (cs.length) {
                setConnection(cs[0]);
            }
        }
    }, [connector]);
    useEffect(() => {
        // Unset disconnected connection.
        if (connection && !connectedAccounts.has(connection)) {
            setConnection(undefined);
        }
    }, [connectedAccounts]);
    return {
        connection,
        setConnection,
        genesisHash: connection && genesisHashes.get(connection),
        account: connection && connectedAccounts.get(connection),
    };
}

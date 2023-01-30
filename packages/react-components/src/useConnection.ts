import { WalletConnection, WalletConnector } from '@concordium/wallet-connectors';
import { useEffect, useState } from 'react';

interface ActiveConnection {
    /**
     * The currently active connection.
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
): ActiveConnection {
    const [connection, setConnection] = useState<WalletConnection>();
    useEffect(() => {
        setConnection(undefined);
        if (connector) {
            const cs = connector.getConnections();
            if (cs.length) {
                setConnection(cs[0]);
            }
        }
    }, [connector]);
    return {
        connection,
        setConnection,
        genesisHash: connection && genesisHashes.get(connection),
        account: connection && connectedAccounts.get(connection),
    };
}

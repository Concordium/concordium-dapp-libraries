import { WalletConnection } from '@concordium/wallet-connectors';
import { useCallback, useEffect, useState } from 'react';
import { errorString } from './error';

/**
 * The state of the a {@link useDisconnect} instance.
 */
export interface Disconnect {
    /**
     * Function for closing a connection.
     */
    disconnect: () => void;

    /**
     * Indicator on whether we're waiting for a connection to be terminated.
     */
    isDisconnecting: boolean;
}

/**
 * Hook for managing the action of disconnecting a connection.
 * @param connection The connection that the returned function may disconnect.
 * @param setError Setter function to which connection errors is passed.
 * @return The disconnect action and indicator of whether the connection is being terminated.
 */
export function useDisconnect(connection: WalletConnection | undefined, setError: (err: string) => void): Disconnect {
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    useEffect(() => {
        if (connection) {
            setError('');
        }
    }, [connection]);
    const disconnect = useCallback(() => {
        if (!connection) {
            return setError('no connection to disconnect');
        }
        setIsDisconnecting(true);
        connection
            .disconnect()
            .catch((e) => setError(errorString(e)))
            .finally(() => setIsDisconnecting(false));
    }, [connection]);
    return { disconnect, isDisconnecting };
}

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

    /**
     * Error terminating the connection. This will be automatically cleared once a new connection has been established.
     */
    disconnectError: string;
}

// TODO Take function 'setError' instead of keeping error state inside.

/**
 * Hook for managing the action of disconnecting a connection.
 * @param connection TODO
 */
export function useDisconnect(connection: WalletConnection | undefined): Disconnect {
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [disconnectError, setDisconnectError] = useState('');
    useEffect(() => {
        if (connection) {
            setDisconnectError('')
        }
    }, [connection]);
    const disconnect = useCallback(() => {
        if (!connection) {
            return setDisconnectError('no connection to disconnect');
        }
        setIsDisconnecting(true);
        connection
            .disconnect()
            .catch((e) => setDisconnectError(errorString(e)))
            .finally(() => setIsDisconnecting(false));
    }, [connection]);
    return { disconnect, isDisconnecting, disconnectError };
}

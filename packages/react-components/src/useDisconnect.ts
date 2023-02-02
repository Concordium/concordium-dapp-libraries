import { WalletConnection } from '@concordium/wallet-connectors';
import { useCallback, useEffect, useState } from 'react';
import { errorString } from './error';

export interface Disconnect {
    disconnect: () => void;
    isDisconnecting: boolean;
    disconnectError: string;
}

export function useDisconnect(connection: WalletConnection | undefined): Disconnect {
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [disconnectError, setDisconnectError] = useState('');
    useEffect(() => setDisconnectError(''));
    const disconnect = useCallback(() => {
        if (!connection) {
            throw new Error('no connection to disconnect');
        }
        setIsDisconnecting(true);
        connection
            .disconnect()
            .catch((e) => setDisconnectError(errorString(e)))
            .finally(() => setIsDisconnecting(false));
    }, [connection]);
    return { disconnect, isDisconnecting, disconnectError };
}

import { WalletConnection, WalletConnector } from '@concordium/wallet-connectors';
import { useCallback, useState } from 'react';
import { errorString } from './error';

interface Connect {
    connect: () => void;
    isConnecting: boolean;
    connectionError: string;
}

export function useConnect(connector: WalletConnector | undefined, setConnection: (c: WalletConnection) => void): Connect {
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState('');
    const connect = useCallback(() => {
        if (connector) {
            setIsConnecting(true);
            connector
                .connect()
                .then((c) => {
                    if (c) {
                        setConnection(c);
                        setConnectionError('');
                    }
                })
                .catch(e => setConnectionError(errorString(e)))
                .finally(() => setIsConnecting(false));
        }
    }, [connector, setConnection]);
    return { connect, isConnecting, connectionError };
}

import React, { useCallback, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { WalletConnection, WalletConnector } from '@concordium/react-components';

interface Props {
    connector: WalletConnector;
    setConnection: (connection: WalletConnection | undefined) => void;
    children: (isConnecting: boolean) => JSX.Element;
}

export function WalletConnectionButton({ connector, setConnection, children }: Props) {
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');
    const connect = useCallback(() => {
        if (connector) {
            setIsConnecting(true);
            connector
                .connect()
                .then((c) => {
                    setConnection(c);
                    setError('');
                })
                .catch((e) => setError((e as Error).message))
                .finally(() => setIsConnecting(false));
        }
    }, [connector, setConnection]);
    return (
        <>
            {error && <Alert variant="danger">Error: {error}.</Alert>}
            <Button type="button" onClick={connect} disabled={isConnecting}>
                {children(isConnecting)}
            </Button>
        </>
    );
}

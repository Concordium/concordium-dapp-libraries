import React, { useCallback } from 'react';
import { Button } from 'react-bootstrap';
import {
    ConnectorType,
    useWalletConnectorActivation,
    WalletConnection,
    WalletConnectionProps,
} from '@concordium/react-components';

interface Props extends WalletConnectionProps {
    connection: WalletConnection | undefined;
    connectorType: ConnectorType;
    connectorName: string;
    connect: () => void;
    isConnecting: boolean;
    disconnect: () => void;
    isDisconnecting: boolean;
}

export function WalletConnectorButton(props: Props) {
    const {
        activeConnectorType,
        setActiveConnectorType,
        activeConnector,
        connection,
        connectorType,
        connectorName,
        isDisconnecting,
        connect,
        disconnect,
    } = props;
    const { isActive, isConnected, isOtherConnected } = useWalletConnectorActivation(
        connectorType,
        connection,
        activeConnectorType,
        activeConnector
    );

    // TODO Add 'isConnecting'.
    const verb = !isActive ? 'Use' : isConnected ? 'Disconnect' : activeConnector ? 'Connect' : 'Initializing';
    const handleClick = useCallback(() => {
        if (!isActive) {
            setActiveConnectorType(connectorType);
        } else if (isConnected) {
            // Best to disconnect before unsetting the connector type as that (depending on the connector type variant used)
            // may also disconnect as a side effect.
            disconnect();
            setActiveConnectorType(undefined);
        } else if (activeConnector) {
            connect();
        } else {
            // initializing (i.e. it's active but not connected and there's no active connector)
        }
    }, [isConnected, isActive, setActiveConnectorType, activeConnector, connectorType, connect, disconnect]);
    return (
        <Button
            className="w-100"
            disabled={isOtherConnected || (isActive && isDisconnecting)}
            variant={isConnected ? 'danger' : isActive ? 'primary' : 'light'}
            onClick={handleClick}
        >
            {`${verb} ${connectorName}`}
        </Button>
    );
}

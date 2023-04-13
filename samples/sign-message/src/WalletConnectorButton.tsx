import React, { useCallback } from 'react';
import { Button } from 'react-bootstrap';
import {
    ConnectorType,
    useConnectorTypeStatus,
    WalletConnection,
    WalletConnectionProps,
} from '@concordium/react-components';

interface Props extends WalletConnectionProps {
    connection: WalletConnection | undefined;
    connectorType: ConnectorType;
    connectorName: string;
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
        disconnect,
    } = props;
    const { isActive, isConnected, isOtherConnected } = useConnectorTypeStatus(
        connectorType,
        connection,
        activeConnectorType,
        activeConnector
    );

    const verb = isConnected ? 'Disconnect' : isActive ? 'Using' : 'Use';
    const handleClick = useCallback(() => {
        // Best to disconnect before unsetting the connector type as that (depending on the connector type variant used)
        // may also disconnect as a side effect.
        if (isConnected) {
            disconnect();
        }
        setActiveConnectorType(isActive ? undefined : connectorType);
    }, [isConnected, isActive, setActiveConnectorType, connectorType, disconnect]);
    return (
        <Button
            className="w-100"
            disabled={isOtherConnected || (isActive && isDisconnecting)}
            variant={isConnected ? 'danger' : isActive ? 'dark' : 'light'}
            onClick={handleClick}
        >
            {`${verb} ${connectorName}`}
        </Button>
    );
}

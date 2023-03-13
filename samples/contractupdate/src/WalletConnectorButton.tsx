import React, { useCallback } from 'react';
import { Button } from 'react-bootstrap';
import {
    ConnectorType,
    useWalletConnectorSelector,
    WalletConnection,
    WalletConnectionProps,
} from '@concordium/react-components';

// TODO Stop extending (pass 'select' function instead)?
interface Props extends WalletConnectionProps {
    connection: WalletConnection | undefined;
    connectorType: ConnectorType;
    connectorName: string;
    disconnect: ()  => void;
    isDisconnecting: boolean;
}

export function WalletConnectorButton(props: Props) {
    const { connection, connectorType, connectorName, isDisconnecting, disconnect, setActiveConnectorType } = props;
    const { isActive, isConnected, isDisabled } = useWalletConnectorSelector(
        connectorType,
        connection,
        props.activeConnectorType,
        props.activeConnector,
    );

    const verb = isConnected ? 'Disconnect' : isActive ? 'Using' : 'Use';
    const handleClick = useCallback(() => {
        // Depending on the connector type, this might also disconnect the connection.
        setActiveConnectorType(isActive ? undefined : connectorType);
        if (isConnected) {
            disconnect();
        }
    }, [isConnected, isActive, setActiveConnectorType, connectorType, disconnect]);
    return (
        <Button
            className="w-100"
            disabled={isDisabled || isDisconnecting}
            variant={isConnected ? 'danger' : isActive ? 'dark' : 'light'}
            onClick={handleClick}
        >
            {`${verb} ${connectorName}`}
        </Button>
    );
}

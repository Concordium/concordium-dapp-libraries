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
    const { isSelected, isConnected, isDisabled } = useWalletConnectorSelector(
        connectorType,
        connection,
        props
    );

    const verb = isConnected ? 'Disconnect' : isSelected ? 'Using' : 'Use';
    const handleClick = useCallback(() => {
        if (isConnected) {
            disconnect();
        }
        setActiveConnectorType(isSelected ? undefined : connectorType);
    }, [isConnected, isSelected, setActiveConnectorType, connectorType, disconnect]);
    return (
        <Button
            className="w-100"
            disabled={isDisabled || isDisconnecting}
            variant={isConnected ? 'danger' : isSelected ? 'dark' : 'light'}
            onClick={handleClick}
        >
            {`${verb} ${connectorName}`}
        </Button>
    );
}

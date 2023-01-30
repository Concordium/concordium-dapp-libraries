import React from 'react';
import { Button } from 'react-bootstrap';
import {
    ConnectorType,
    useWalletConnectorSelector,
    WalletConnection,
    WalletConnectionProps,
} from '@concordium/react-components';

interface Props extends WalletConnectionProps {
    activeConnection: WalletConnection | undefined;
    connectorType: ConnectorType;
    connectorName: string;
}

export function WalletConnectorButton(props: Props) {
    const { activeConnection, connectorType, connectorName } = props;
    const { isSelected, isConnected, isDisabled, select } = useWalletConnectorSelector(
        connectorType,
        activeConnection,
        props
    );

    const verb = isConnected ? 'Disconnect' : isSelected ? 'Using' : 'Use';
    return (
        <Button
            className="w-100"
            disabled={isDisabled}
            variant={isConnected ? 'danger' : isSelected ? 'dark' : 'light'}
            onClick={select}
        >
            {`${verb} ${connectorName}`}
        </Button>
    );
}

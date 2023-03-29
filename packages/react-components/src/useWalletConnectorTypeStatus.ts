import { ConnectorType } from './WithWalletConnector';
import { WalletConnection, WalletConnector } from '@concordium/wallet-connectors';

/**
 * The state of the a {@link useWalletConnectorTypeStatus} instance.
 */
// TODO Rename to 'ConnectorStatus'.
export interface WalletConnectorTypeStatus {
    /**
     * Indicator of whether the connector type is active.
     */
    isActive: boolean;

    /**
     * Indicator of whether the connector is connected (i.e. it's active and has at least one open connection).
     */
    isConnected: boolean;

    /**
     * Indicator of whether another connector is connected (i.e. is active and has at least one open connection).
     */
    isOtherConnected: boolean;
}

/**
 * Hook for computing the "status" of a given connector type, defined as follows:
 *
 * - The status is {@link WalletConnectorTypeStatus.isActive active} if the {@link activeConnector active connector}'s type is {@link connectorType}.
 * - The status is {@link WalletConnectorTypeStatus.isConnected connected} if it is active and the {@link connection} was created by the active connector.
 * - The status is {@link WalletConnectorTypeStatus.isOtherConnected disabled} if it there is another connector type with status "connected".
 *
 * @param connectorType The connector type that we're deriving the status of.
 * @param connection The connection that, if present and originating from the selected connector, causes that connector to be considered "connected".
 * @param activeConnectorType The active connector type.
 * @param activeConnector The active connector.
 * @return The resolved status.
 */
// TODO Rename to 'useConnectorStatus'.
export function useWalletConnectorTypeStatus(
    connectorType: ConnectorType,
    connection: WalletConnection | undefined,
    activeConnectorType: ConnectorType | undefined,
    activeConnector: WalletConnector | undefined
): WalletConnectorTypeStatus {
    const isActive = activeConnectorType === connectorType;
    const isConnected = Boolean(isActive && connection && connection.getConnector() === activeConnector);
    const isOtherConnected = Boolean(!isActive && activeConnectorType && connection);
    return { isActive, isConnected, isOtherConnected };
}

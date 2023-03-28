import { ConnectorType } from './WithWalletConnector';
import { WalletConnection, WalletConnector } from '@concordium/wallet-connectors';

/**
 * The state of the a {@link useWalletConnectorSelector} instance.
 */
export interface WalletConnectorSelector {
    /**
     * Indicator of whether the connector type controlled by this selector is active.
     */
    isActive: boolean;

    /**
     * Indicator of whether the selector is connected (i.e. it's active and has an open connection).
     */
    isConnected: boolean;

    /**
     * Indicator of whether the selector is disabled (i.e. there is another connected selector).
     */
    isOtherConnected: boolean;
}

// TODO Rename now that this doesn't expose 'select' anymore?
//      All it does is compute a little derived state to tell the state of a selector to figure out how it should be rendered.

/**
 * Hook for managing a connector selector (usually a button in the UI).
 *
 * The hook derives the following state {@link WalletConnectorSelector} from {@link props}:
 * - The selector is {@link WalletConnectorSelector.isActive active} if the active connector's type is {@link connectorType}.
 * - The selector is {@link WalletConnectorSelector.isConnected connected} if it is active and the current connection was created by the active connector.
 * - The selector is {@link WalletConnectorSelector.isOtherConnected disabled} if it there is another connected selector.
 *
 * @param connectorType The connector type controlled by this selector.
 * @param connection The connection that, if present and originating from the selected connector, causes that connector to be considered "connected".
 * @param activeConnectorType The active connector type.
 * @param activeConnector The active connector.
 * @return The resolved state.
 */
export function useWalletConnectorSelector(
    connectorType: ConnectorType,
    connection: WalletConnection | undefined,
    activeConnectorType: ConnectorType | undefined,
    activeConnector: WalletConnector | undefined
): WalletConnectorSelector {
    const isActive = activeConnectorType === connectorType;
    const isConnected = Boolean(isActive && connection && connection.getConnector() === activeConnector);
    const isOtherConnected = Boolean(!isActive && activeConnectorType && connection);
    return { isActive, isConnected, isOtherConnected };
}

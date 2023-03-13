import { ConnectorType } from './WithWalletConnector';
import { WalletConnection, WalletConnector } from '@concordium/wallet-connectors';

/**
 * The state of the a {@link useWalletConnectorSelector} instance.
 */
export interface WalletConnectorSelector {
    /**
     * Indicator of whether the selector matches the active connector type.
     */
    isActive: boolean;

    /**
     * Indicator of whether the selector is connected (i.e. it's selected and has an active connection).
     */
    isConnected: boolean;

    /**
     * Indicator of whether the selector is disabled (i.e. there is another connected selector).
     */
    isDisabled: boolean; // TODO rename isOtherConnected - or instead have hook return selected/connected connector?!? Or whether the *active* connector is...
}

/**
 * Hook for managing a connector selector (usually a button in the UI).
 *
 * More precisely, the hook computes the derived state {@link WalletConnectorSelector} from {@link props} as follows:
 * - The selector is {@link WalletConnectorSelector.isActive active} if the active connector's type is {@link connectorType}.
 * - The selector is {@link WalletConnectorSelector.isConnected connected} if it is active and the current connection was created by the active connector.
 * - The selector is {@link WalletConnectorSelector.isDisabled disabled} if it there is another connected selector.
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
    activeConnector: WalletConnector | undefined,
): WalletConnectorSelector {
    const isActive = activeConnectorType === connectorType;
    const isConnected = Boolean(isActive && connection && connection.getConnector() === activeConnector);
    const isDisabled = Boolean(!isActive && activeConnectorType && connection);
    return { isActive, isConnected, isDisabled };
}

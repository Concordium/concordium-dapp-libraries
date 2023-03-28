import { ConnectorType } from './WithWalletConnector';
import { WalletConnection, WalletConnector } from '@concordium/wallet-connectors';

/**
 * The state of the a {@link useWalletConnectorActivation} instance.
 */
export interface WalletConnectorActivation {
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

// TODO Rename now that this doesn't expose 'select' anymore?
//      All it does is compute a little derived state to tell the state of a selector to figure out how it should be rendered.

/**
 * Hook for computing a few pieces of state that's relevant to the "controller" of a given connector.
 * The controller is usually a button in the UI.
 * A common approach is to render the button as highlighted when its controller is selected,
 * make it disconnect on click when it's connected, and disable it when another one is connected.
 *
 * The hook derives the following state {@link WalletConnectorActivation} from {@link props}:
 * - The selector is {@link WalletConnectorActivation.isActive active} if the active connector's type is {@link connectorType}.
 * - The selector is {@link WalletConnectorActivation.isConnected connected} if it is active and the current connection was created by the active connector.
 * - The selector is {@link WalletConnectorActivation.isOtherConnected disabled} if it there is another connected selector.
 *
 * @param connectorType The connector type controlled by this selector.
 * @param connection The connection that, if present and originating from the selected connector, causes that connector to be considered "connected".
 * @param activeConnectorType The active connector type.
 * @param activeConnector The active connector.
 * @return The resolved state.
 */
export function useWalletConnectorActivation(
    connectorType: ConnectorType,
    connection: WalletConnection | undefined,
    activeConnectorType: ConnectorType | undefined,
    activeConnector: WalletConnector | undefined
): WalletConnectorActivation {
    const isActive = activeConnectorType === connectorType;
    const isConnected = Boolean(isActive && connection && connection.getConnector() === activeConnector);
    const isOtherConnected = Boolean(!isActive && activeConnectorType && connection);
    return { isActive, isConnected, isOtherConnected };
}

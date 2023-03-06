import { ConnectorType, WalletConnectionProps } from './WithWalletConnector';
import { WalletConnection } from '@concordium/wallet-connectors';

/**
 * The state of the a {@link useWalletConnectorSelector} instance.
 */
export interface WalletConnectorSelector {
    /**
     * Indicator of whether the selector is selected (i.e. it matches the active connector type).
     */
    isSelected: boolean;

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
 * - The selector is {@link WalletConnectorSelector.isSelected selected} if the active connector's type is {@link connectorType}.
 * - The selector is {@link WalletConnectorSelector.isConnected connected} if it is selected and the active connection was created by the active connector.
 * - The selector is {@link WalletConnectorSelector.isDisabled disabled} if it there is another connected selector.
 *
 * It also exposes a {@link WalletConnectorSelector.select handler function} for connecting/disconnecting appropriately
 * when the selector is invoked.
 *
 * @param connectorType The connector type controlled by this selector.
 * @param connection The connection that, if present and originating from the selected connector, causes that connector to be considered "connected".
 * @param props The props exposed by {@link WithWalletConnector} to its child component.
 * @return The resolved state.
 */
export function useWalletConnectorSelector(
    connectorType: ConnectorType,
    connection: WalletConnection | undefined,
    props: WalletConnectionProps // TODO replace with used fields
): WalletConnectorSelector {
    const { activeConnectorType, activeConnector } = props;
    const isSelected = activeConnectorType === connectorType;
    const isConnected = Boolean(isSelected && connection && connection.getConnector() === activeConnector);
    const isDisabled = Boolean(!isSelected && activeConnectorType && connection);
    return { isSelected, isConnected, isDisabled };
}

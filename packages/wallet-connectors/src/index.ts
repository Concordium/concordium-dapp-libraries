export * from './WalletConnection';
export * from './WalletConnect';
export * from './BrowserWallet';

/**
 * ID of the "Mobile Wallets" project in Concordium's WalletConnect Cloud account.
 * dApps must initialize {@link WalletConnectConnector.create WalletConnect client} with the ID of a project within a WalletConnect Cloud account.
 * They can use this one or one create a project in their own WalletConnect Cloud account.
 */
export const CONCORDIUM_WALLET_CONNECT_PROJECT_ID = '76324905a70fe5c388bab46d3e0564dc';

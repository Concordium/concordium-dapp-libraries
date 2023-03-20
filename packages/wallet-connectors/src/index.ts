export * from './WalletConnection';
export * from './WalletConnect';
export * from './BrowserWallet';

/**
 * Project ID of Concordium's WalletConnect Cloud account for mobile wallets.
 * dApps wishing to connect to one of the official Concordium mobile wallets
 * must initialize their {@link WalletConnectConnector.create WalletConnect client} with this project ID.
 */
export const CONCORDIUM_WALLET_CONNECT_PROJECT_ID = '76324905a70fe5c388bab46d3e0564dc';

import { SignClientTypes } from '@walletconnect/types';
import {
    BrowserWalletConnector,
    CONCORDIUM_WALLET_CONNECT_PROJECT_ID,
    Network,
    ephemeralConnectorType,
    WalletConnectConnector,
} from '@concordium/react-components';

const TESTNET_GENESIS_BLOCK_HASH = '4221332d34e1694168c2a0c0b3fd0f273809612cb13d000d5c2e00e85f50f796';
const MAINNET_GENESIS_BLOCK_HASH = '9dd9ca4d19e9393877d2c44b70f89acbfc0883c2243e5eeaecc0d1cd0503f478';

export const TESTNET: Network = {
    name: 'testnet',
    genesisHash: TESTNET_GENESIS_BLOCK_HASH,
    jsonRpcUrl: 'https://json-rpc.testnet.concordium.com',
    ccdScanBaseUrl: 'https://testnet.ccdscan.io',
};
export const MAINNET: Network = {
    name: 'mainnet',
    genesisHash: MAINNET_GENESIS_BLOCK_HASH,
    jsonRpcUrl: 'https://json-rpc.mainnet.concordium.software',
    ccdScanBaseUrl: 'https://ccdscan.io',
};

const WALLET_CONNECT_OPTS: SignClientTypes.Options = {
    projectId: CONCORDIUM_WALLET_CONNECT_PROJECT_ID,
    metadata: {
        name: 'Sign Message',
        description: 'Example dApp for signing an arbitrary message.',
        url: '#',
        icons: ['https://walletconnect.com/walletconnect-logo.png'],
    },
};

export const BROWSER_WALLET = ephemeralConnectorType(BrowserWalletConnector.create);
export const WALLET_CONNECT = ephemeralConnectorType(WalletConnectConnector.create.bind(undefined, WALLET_CONNECT_OPTS));

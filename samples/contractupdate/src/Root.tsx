import React, { useEffect, useState } from 'react';
import { Alert, Col, Container, Row, Spinner } from 'react-bootstrap';
import {
    useConnect,
    useConnection,
    useDisconnect,
    WalletConnectionProps,
    WithWalletConnector,
    withJsonRpcClient,
} from '@concordium/react-components';
import { WalletConnectorButton } from './WalletConnectorButton';
import { ConnectedAccount } from './ConnectedAccount';
import { App } from './App';
import { NetworkSelector } from './NetworkSelector';
import { BROWSER_WALLET, MAINNET, TESTNET, WALLET_CONNECT } from './config';
import { errorString } from './util';

export default function Root() {
    const [network, setNetwork] = useState(TESTNET);
    return (
        <Container>
            <h1>Sample dApp</h1>
            <NetworkSelector selected={network} options={[TESTNET, MAINNET]} select={setNetwork} />
            <WithWalletConnector network={network}>{(props) => <Main {...props} />}</WithWalletConnector>
        </Container>
    );
}

function Main(props: WalletConnectionProps) {
    const { activeConnectorType, activeConnector, activeConnectorError, network, connectedAccounts, genesisHashes } =
        props;
    const { connection, setConnection, account, genesisHash } = useConnection(connectedAccounts, genesisHashes);
    const [connectError, setConnectError] = useState('');
    const { connect, isConnecting } = useConnect(activeConnector, setConnection, setConnectError);
    const { disconnect, isDisconnecting } = useDisconnect(connection, setConnectError);
    useEffect(() => {
        if (connection) {
            setConnectError('');
        }
    }, [connection]);

    const [rpcGenesisHash, setRpcGenesisHash] = useState<string>();
    const [rpcError, setRpcError] = useState('');
    useEffect(() => {
        if (connection) {
            setRpcGenesisHash(undefined);
            withJsonRpcClient(connection, async (rpc) => {
                const status = await rpc.getConsensusStatus();
                return status.genesisBlock;
            })
                .then((hash) => {
                    setRpcGenesisHash(hash);
                    setRpcError('');
                })
                .catch((err) => {
                    setRpcGenesisHash(undefined);
                    setRpcError(errorString(err));
                });
        }
    }, [connection, genesisHash, network]);
    return (
        <>
            <Row className="mt-3 mb-3">
                <Col>
                    <WalletConnectorButton
                        connectorType={BROWSER_WALLET}
                        connectorName="Browser Wallet"
                        connection={connection}
                        isDisconnecting={isDisconnecting}
                        connect={connect}
                        isConnecting={isConnecting}
                        disconnect={disconnect}
                        {...props}
                    />
                </Col>
                <Col>
                    <WalletConnectorButton
                        connectorType={WALLET_CONNECT}
                        connectorName="WalletConnect"
                        connection={connection}
                        isDisconnecting={isDisconnecting}
                        connect={connect}
                        isConnecting={isConnecting}
                        disconnect={disconnect}
                        {...props}
                    />
                </Col>
            </Row>
            <Row className="mt-3 mb-3">
                <Col>
                    {activeConnectorError && <Alert variant="danger">Connector error: {activeConnectorError}.</Alert>}
                    {!activeConnectorError && activeConnectorType && !activeConnector && <Spinner />}
                    {connectError && <Alert variant="danger">Connection error: {connectError}.</Alert>}
                </Col>
            </Row>
            <Row className="mt-3 mb-3">
                <Col>
                    <ConnectedAccount connection={connection} account={account} network={network} />
                </Col>
            </Row>
            <Row className="mt-3 mb-3">
                <Col>
                    {account && (
                        <NetworkInconsistencyReporter
                            rpcGenesisHash={rpcGenesisHash}
                            networkGenesisHash={network.genesisHash}
                            activeConnectionGenesisHash={genesisHash}
                        />
                    )}
                    {rpcError && <Alert variant="warning">RPC error: {rpcError}</Alert>}
                    <App network={network} connection={connection} connectedAccount={account} />
                </Col>
            </Row>
        </>
    );
}

interface NetworkInconsistencyReporterProps {
    rpcGenesisHash: string | undefined;
    activeConnectionGenesisHash: string | undefined;
    networkGenesisHash: string;
}

function NetworkInconsistencyReporter({
    rpcGenesisHash,
    networkGenesisHash,
    activeConnectionGenesisHash,
}: NetworkInconsistencyReporterProps) {
    const rpcMismatch = rpcGenesisHash && rpcGenesisHash !== networkGenesisHash;
    const activeConnectionMismatch = activeConnectionGenesisHash && activeConnectionGenesisHash !== networkGenesisHash;
    return (
        <>
            {(rpcMismatch || activeConnectionMismatch) && (
                <Alert variant="danger">
                    Inconsistent network parameters detected!
                    <ul>
                        <li>
                            Reported by wallet:{' '}
                            {(activeConnectionGenesisHash && <code>{activeConnectionGenesisHash}</code>) || <i>N/A</i>}.
                        </li>
                        <li>Fetched from via RPC: {(rpcGenesisHash && <code>{rpcGenesisHash}</code>) || <i>N/A</i>}</li>
                        <li>
                            Expected for selected network: <code>{networkGenesisHash}</code>
                        </li>
                    </ul>
                </Alert>
            )}
        </>
    );
}

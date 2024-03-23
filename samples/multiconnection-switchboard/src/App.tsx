import { ResultAsync, err, ok } from 'neverthrow';
import React, { SetStateAction, useCallback, useMemo, useState } from 'react';
import { Alert, Button, Col, Container, Dropdown, Form, InputGroup, Row, Spinner } from 'react-bootstrap';
import {
    binaryMessageFromHex,
    BrowserWalletConnector,
    CONCORDIUM_WALLET_CONNECT_PROJECT_ID,
    ConnectorType,
    ephemeralConnectorType, Network,
    persistentConnectorType, stringMessage,
    TESTNET, typeSchemaFromBase64, useConnect, useConnection,
    WalletConnectConnector, WalletConnection,
    WalletConnectionProps, WalletConnector,
    WithWalletConnector,
} from '@concordium/react-components';
import { SignClientTypes } from '@walletconnect/types';
import { errorString } from './util';
import { AccountTransactionSignature } from '@concordium/web-sdk';
import { WalletConnectorButton } from './WalletConnectorButton';

const WALLET_CONNECT_OPTS: SignClientTypes.Options = {
    projectId: CONCORDIUM_WALLET_CONNECT_PROJECT_ID,
    metadata: {
        name: 'Sign Message',
        description: 'Example dApp for signing an arbitrary message.',
        url: '#',
        icons: ['https://walletconnect.com/walletconnect-logo.png'],
    },
};

interface NamedConnectorType {
    name: string;
    type: ConnectorType;
}

interface ConnectorGroup {
    index: number;
    namedTypes: NamedConnectorType[];
}

export default function App() {
    const [groups, setGroups] = useState<ConnectorGroup[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [network, setNetwork] = useState(TESTNET);

    const addGroup = useCallback(() => {
        setGroups((groups) => [...groups, { index: groups.length, namedTypes: [] }]);
    }, []);
    return (
        <Container>
            <h1>Connections</h1>
            {
                groups.map((group) =>
                    <WithWalletConnector network={network}>
                        {(props) =>
                            <Main group={group} setGroups={setGroups} {...props} />
                        }
                    </WithWalletConnector>,
                )
            }
            <hr />
            <div>
                <Button onClick={addGroup}>Add Connector Group</Button>
            </div>
        </Container>
    );
}

// function kindFromKey(key: string) {
//     switch (key) {
//         case 'none':
//             return undefined;
//         case 'ephemeral':
//         case 'persistent':
//             return key;
//         default:
//             throw new Error(`unsupported key '${key}'`);
//     }
// }

interface MainProps extends WalletConnectionProps {
    group: ConnectorGroup;
    setGroups: React.Dispatch<SetStateAction<ConnectorGroup[]>>;
}

function Main(props: MainProps) {
    const {
        group,
        setGroups,
        activeConnectorType,
        activeConnector,
        activeConnectorError,
        connectedAccounts,
        genesisHashes,
    } = props;
    const { connection, setConnection, account } = useConnection(connectedAccounts, genesisHashes);
    const { connect, isConnecting, connectError } = useConnect(activeConnector, setConnection);

    const groupIndex = group.index;
    const addConnectorType = useCallback((t: NamedConnectorType) =>
            setGroups((groups: ConnectorGroup[]) => groups.map((g) => {
                const { index, namedTypes } = g;
                if (index === groupIndex) {
                    return { index, namedTypes: [...namedTypes, t] };
                }
                return g;
            })),
        [groupIndex, setGroups],
    );

    const onSelect = useCallback((key: string | null) =>
            key && addConnectorType(namedConnectorTypeFromDropdownEventKey(key)),
        [addConnectorType],
    );

    return (
        <>
            <Row className='mt-3 mb-3'>
                {
                    group.namedTypes.map((type) =>
                        <Col>
                            <WalletConnectorButton
                                connectorType={type.type}
                                connectorName={type.name}
                                connection={connection}
                                {...props}
                            />
                        </Col>,
                    )
                }
                <Dropdown onSelect={onSelect}>
                    <Dropdown.Toggle variant='success' id='dropdown-basic'>+</Dropdown.Toggle>
                    <Dropdown.Menu>
                        <Dropdown.Item eventKey='bw_e'>Browser Wallet (ephemeral)</Dropdown.Item>
                        <Dropdown.Item eventKey='bw_p'>Browser Wallet (persistent)</Dropdown.Item>
                        <Dropdown.Item eventKey='wc_e'>WalletConnect (ephemeral)</Dropdown.Item>
                        <Dropdown.Item eventKey='wc_p'>WalletConnect (persistent)</Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            </Row>
            <Row className='mt-3 mb-3'>
                <Col>
                    {activeConnectorError && <Alert variant='danger'>Connector error: {activeConnectorError}.</Alert>}
                    {!activeConnectorError && activeConnectorType && !activeConnector && <Spinner />}
                    {connectError && <Alert variant='danger'>Connection error: {connectError}.</Alert>}
                    {connect && !account && (
                        <Button type='button' onClick={connect} disabled={isConnecting}>
                            {isConnecting && 'Connecting...'}
                            {!isConnecting && 'Connect'}
                        </Button>
                    )}
                </Col>
            </Row>
            {account && (
                <Row className='mt-3 mb-3'>
                    <Col>
                        Connected to account <code>{account}</code>.
                    </Col>
                </Row>
            )}
            <SignMessage connection={connection} account={account} />
        </>
    );
}

interface SignMessageProps {
    connection: WalletConnection | undefined;
    account: string | undefined;
}

function SignMessage({ connection, account }: SignMessageProps) {
    const [messageInput, setMessageInput] = useState('');
    const [schemaInput, setSchemaInput] = useState('');

    const schemaResult = useMemo(() => {
        if (!schemaInput) {
            return undefined;
        }
        try {
            return ok(typeSchemaFromBase64(schemaInput));
        } catch (e) {
            return err(errorString(e));
        }
    }, [schemaInput]);

    const messageResult = useMemo(() => {
        if (!messageInput) {
            return undefined;
        }
        if (!schemaResult) {
            // Empty schema implies string message.
            return ok(stringMessage(messageInput));
        }
        try {
            // Map schema result to message with input.
            // Return undefined if schema result is an error to avoid double reporting it.
            return schemaResult.match(
                (s) => ok(binaryMessageFromHex(messageInput, s)),
                () => undefined,
            );
        } catch (e) {
            return err(errorString(e));
        }
    }, [messageInput, schemaResult]);

    const [signature, setSignature] = useState<AccountTransactionSignature>('');
    const [error, setError] = useState('');
    const [isWaiting, setIsWaiting] = useState(false);

    const handleMessageInput = useCallback((e: any) => setMessageInput(e.target.value), []);
    const handleSchemaInput = useCallback((e: any) => setSchemaInput(e.target.value), []);
    const handleSubmit = useCallback(() => {
        if (connection && account && messageResult) {
            messageResult
                .asyncAndThen((msg) => {
                    setError('');
                    setIsWaiting(true);
                    return ResultAsync.fromPromise(connection.signMessage(account, msg), errorString);
                })
                .match(setSignature, setError)
                .finally(() => setIsWaiting(false));
        }
    }, [connection, account, messageResult]);
    return (
        <>
            <Form.Group as={Row} className='mb-3'>
                <Form.Label column sm={3}>
                    Schema (if binary):
                </Form.Label>
                <Col sm={9}>
                    <InputGroup hasValidation={schemaResult?.isErr()}>
                        <Form.Control
                            type='text'
                            value={schemaInput}
                            onChange={handleSchemaInput}
                            placeholder='Leave empty for string message'
                            isInvalid={schemaResult?.isErr()}
                            autoFocus
                        />
                        <InputGroup.Text>Base64</InputGroup.Text>
                        {schemaResult?.match(
                            () => undefined,
                            (e) => (
                                <Form.Control.Feedback type='invalid'>{e}</Form.Control.Feedback>
                            ),
                        )}
                    </InputGroup>
                </Col>
            </Form.Group>
            <Form.Group as={Row} className='mb-3'>
                <Form.Label column sm={3}>
                    Message to sign:
                </Form.Label>
                <Col sm={9}>
                    <InputGroup hasValidation={messageResult?.isErr()}>
                        <Form.Control
                            type='text'
                            value={messageInput}
                            onChange={handleMessageInput}
                            isInvalid={messageResult?.isErr()}
                            autoFocus
                        />
                        <InputGroup.Text>{schemaInput ? 'Hex' : 'String'}</InputGroup.Text>
                        {messageResult?.match(
                            () => undefined,
                            (e) => (
                                <Form.Control.Feedback type='invalid'>{e}</Form.Control.Feedback>
                            ),
                        )}
                    </InputGroup>
                </Col>
            </Form.Group>
            <Form.Group as={Row} className='mb-3'>
                <Form.Label column sm={3} />
                <Col sm={9}>
                    <Button
                        variant='primary'
                        onClick={handleSubmit}
                        disabled={!connection || !messageInput || isWaiting || !messageResult?.isOk()}
                    >
                        {isWaiting ? 'Signing...' : schemaInput ? 'Sign binary message' : 'Sign string message'}
                    </Button>
                </Col>
            </Form.Group>
            <Row>
                {error && <Alert variant='danger'>{error}</Alert>}
                {signature && (
                    <>
                        <Col sm={3}>Signature:</Col>
                        <Col sm={9}>
                            <pre title={`Message: ${messageInput}`}>{JSON.stringify(signature, null, 2)}</pre>
                        </Col>
                    </>
                )}
            </Row>
        </>
    );
}

interface ConnectorTarget {
    name: string;
    create: (c: WithWalletConnector, n: Network) => Promise<WalletConnector>;
}

const browserWalletTarget: ConnectorTarget = {
    name: 'Browser Wallet',
    create: BrowserWalletConnector.create,
};

const walletConnectTarget: ConnectorTarget = {
    name: 'WalletConnect',
    create: WalletConnectConnector.create.bind(undefined, WALLET_CONNECT_OPTS),
};

interface ConnectorKind {
    name: string;
    kind: (create: (c: WithWalletConnector, n: Network) => Promise<WalletConnector>) => ConnectorType;
}

const ephemeralKind: ConnectorKind = {
    name: 'ephemeral',
    kind: ephemeralConnectorType,
};

const persistentKind: ConnectorKind = {
    name: 'persistent',
    kind: persistentConnectorType,
};

function namedConnectorType(target: ConnectorTarget, kind: ConnectorKind): NamedConnectorType {
    return {
        name: `${target.name} (${kind.name})`,
        type: kind.kind(target.create),
    };
}

function namedConnectorTypeFromDropdownEventKey(key: string) {
    switch (key) {
        case 'bw_e':
            return namedConnectorType(browserWalletTarget, ephemeralKind);
        case 'bw_p':
            return namedConnectorType(browserWalletTarget, persistentKind);
        case 'wc_e':
            return namedConnectorType(walletConnectTarget, ephemeralKind);
        case 'wc_p':
            return namedConnectorType(walletConnectTarget, persistentKind);
        default:
            throw new Error(`unsupported dropdown event key '${key}'`);
    }
}

// function ephemeralWalletConnectConnectorType() {
//     return {
//         name: 'WalletConnect (ephemeral)',
//         type: ephemeralConnectorType(WalletConnectConnector.create.bind(undefined, WALLET_CONNECT_OPTS)),
//     };
// }
//
// function persistentBrowserWalletConnectorType() {
//     return {
//         name: 'Browser Wallet (persistent)',
//         type: persistentConnectorType(BrowserWalletConnector.create),
//     };
// }
//
// function persistentWalletConnectConnectorType() {
//     return {
//         name: 'WalletConnect (persistent)',
//         type: persistentConnectorType(WalletConnectConnector.create.bind(undefined, WALLET_CONNECT_OPTS)),
//     };
// }


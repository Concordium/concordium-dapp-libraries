import SignClient from '@walletconnect/sign-client';
import QRCodeModal from '@walletconnect/qrcode-modal';
import { SessionTypes, SignClientTypes, ISignClient } from '@walletconnect/types';
import {
    AccountTransactionPayload,
    AccountTransactionSignature,
    AccountTransactionType,
    HttpProvider,
    InitContractPayload,
    JsonRpcClient,
    SchemaVersion,
    serializeInitContractParameters,
    serializeUpdateContractParameters,
    toBuffer,
    UpdateContractPayload,
} from '@concordium/web-sdk';
import { WalletConnectionDelegate, Network, WalletConnection, WalletConnector } from './WalletConnection';

const WALLET_CONNECT_SESSION_NAMESPACE = 'ccd';

async function connect(client: ISignClient, chainId: string, cancel: () => void) {
    try {
        const { uri, approval } = await client.connect({
            requiredNamespaces: {
                ccd: {
                    methods: ['sign_and_send_transaction'],
                    chains: [chainId],
                    events: ['chain_changed', 'accounts_changed'],
                },
            },
        });
        if (uri) {
            // Open modal as we're not connecting to an existing pairing.
            QRCodeModal.open(uri, cancel);
        }
        return await approval();
    } catch (e) {
        // Ignore falsy errors.
        if (e) {
            console.error(`WalletConnect client error: ${e}`);
        }
        cancel();
    } finally {
        QRCodeModal.close();
    }
}

interface SignAndSendTransactionResult {
    hash: string;
}

interface SignAndSendTransactionError {
    code: number;
    message: string;
}

function isSignAndSendTransactionError(obj: any): obj is SignAndSendTransactionError {
    return 'code' in obj && 'message' in obj;
}

function accountTransactionPayloadToJson(data: AccountTransactionPayload) {
    return JSON.stringify(data, (key, value) => {
        if (value?.type === 'Buffer') {
            // Buffer has already been transformed by its 'toJSON' method.
            return toBuffer(value.data).toString('hex');
        }
        if (typeof value === 'bigint') {
            return Number(value);
        }
        return value;
    });
}

/**
 * Encode parameters into appropriate payload field ('payload.param' for 'InitContract' and 'payload.message' for 'Update').
 * The 'parameters' and 'schema' parameters must be not undefined for these transaction types.
 * The payload field must be not already set as that would indicate that the caller thought that was the right way to pass them.
 * @param type Type identifier of the transaction.
 * @param payload Payload of the transaction. Must not include the fields 'param' and 'message' for transaction types 'InitContract' and 'Update', respectively.
 * @param parameters Contract invocation parameters. Must be provided for 'InitContract' or 'Update' transactions and omitted otherwise.
 * @param schema Schema for the contract invocation parameters. Must be provided for 'InitContract' or 'Update' transactions and omitted otherwise.
 * @param schemaVersion Version of the provided schema.
 */
function encodePayloadParameters(
    type: AccountTransactionType,
    payload: AccountTransactionPayload,
    parameters?: Record<string, unknown>,
    schema?: string,
    schemaVersion?: SchemaVersion
) {
    switch (type) {
        case AccountTransactionType.InitContract: {
            if (parameters === undefined) {
                throw new Error(`parameters provided for 'InitContract' transaction must be not undefined`);
            }
            if (schema === undefined) {
                throw new Error(`schema provided for 'InitContract' transaction must be not undefined`);
            }
            const initContractPayload = payload as InitContractPayload;
            if (initContractPayload.param) {
                throw new Error(`'param' field of 'InitContract' parameters must be empty`);
            }
            return {
                ...payload,
                param: serializeInitContractParameters(
                    initContractPayload.initName,
                    parameters,
                    toBuffer(schema, 'base64'),
                    schemaVersion
                ),
            } as InitContractPayload;
        }
        case AccountTransactionType.Update: {
            if (parameters === undefined) {
                throw new Error(`parameters provided for 'Update' transaction must be not undefined`);
            }
            if (schema === undefined) {
                throw new Error(`schema provided for 'Update' transaction must be not undefined`);
            }
            const updateContractPayload = payload as UpdateContractPayload;
            if (updateContractPayload.message) {
                throw new Error(`'message' field of 'Update' parameters must be empty`);
            }
            const [contractName, receiveName] = updateContractPayload.receiveName.split('.');
            return {
                ...payload,
                message: serializeUpdateContractParameters(
                    contractName,
                    receiveName,
                    parameters,
                    toBuffer(schema, 'base64'),
                    schemaVersion
                ),
            } as UpdateContractPayload;
        }
        default: {
            if (parameters !== undefined) {
                throw new Error(`parameters provided for '${type}' transaction must be undefined`);
            }
            if (schema !== undefined) {
                throw new Error(`schema provided for '${type}' transaction must be undefined`);
            }
            if (schemaVersion !== undefined) {
                throw new Error(`schema version provided for '${type}' transaction must be undefined`);
            }
            return payload;
        }
    }
}

export class WalletConnectConnection implements WalletConnection {
    readonly connector: WalletConnectConnector;

    readonly rpcClient: JsonRpcClient;

    readonly chainId: string;

    session: SessionTypes.Struct;

    constructor(
        connector: WalletConnectConnector,
        rpcClient: JsonRpcClient,
        chainId: string,
        session: SessionTypes.Struct
    ) {
        this.connector = connector;
        this.rpcClient = rpcClient;
        this.chainId = chainId;
        this.session = session;
    }

    getConnector(): WalletConnector {
        return this.connector;
    }

    async getConnectedAccount() {
        // We're only expecting a single account to be connected.
        const fullAddress = this.session.namespaces[WALLET_CONNECT_SESSION_NAMESPACE].accounts[0];
        return fullAddress.substring(fullAddress.lastIndexOf(':') + 1);
    }

    getJsonRpcClient(): JsonRpcClient {
        return this.rpcClient;
    }

    async signAndSendTransaction(
        accountAddress: string,
        type: AccountTransactionType,
        payload: AccountTransactionPayload,
        parameters?: Record<string, unknown>,
        schema?: string,
        schemaVersion?: SchemaVersion
    ) {
        const params = {
            type: AccountTransactionType[type],
            sender: accountAddress,
            payload: accountTransactionPayloadToJson(
                encodePayloadParameters(type, payload, parameters, schema, schemaVersion)
            ),
            schema,
        };
        try {
            const { hash } = (await this.connector.client.request({
                topic: this.session.topic,
                request: {
                    method: 'sign_and_send_transaction',
                    params,
                },
                chainId: this.chainId,
            })) as SignAndSendTransactionResult;
            return hash;
        } catch (e) {
            if (isSignAndSendTransactionError(e) && e.code === 500) {
                throw new Error('transaction rejected in wallet');
            }
            throw e;
        }
    }

    async signMessage(accountAddress: string, message: string) {
        const params = { message };
        const signature = await this.connector.client.request({
            topic: this.session.topic,
            request: {
                method: 'sign_message',
                params,
            },
            chainId: this.chainId,
        });
        return JSON.stringify(signature) as AccountTransactionSignature;
    }

    async disconnect() {
        await this.connector.client.disconnect({
            topic: this.session.topic,
            reason: {
                code: 1,
                message: 'user disconnecting',
            },
        });
        this.connector.onDisconnect(this);
    }
}

export class WalletConnectConnector implements WalletConnector {
    readonly client: ISignClient;

    readonly network: Network;

    readonly delegate: WalletConnectionDelegate;

    readonly connections = new Map<string, WalletConnectConnection>();

    constructor(client: SignClient, network: Network, delegate: WalletConnectionDelegate) {
        this.client = client;
        this.network = network;
        this.delegate = delegate;

        client.on('session_event', ({ topic, params: { chainId, event }, id }) => {
            console.debug('WalletConnect event: session_event', { topic, id, chainId, event });
        });
        client.on('session_update', ({ topic, params }) => {
            console.debug('WalletConnect event: session_update', { topic, params });

            const connection = this.connections.get(topic);
            if (!connection) {
                console.error(`WalletConnect event 'session_update' received for unknown topic '${topic}'.`);
                return;
            }
            const { namespaces } = params;
            // Overwrite session.
            connection.session = { ...connection.session, namespaces };
            connection
                .getConnectedAccount()
                .then((a) => delegate.onAccountChanged(connection, a))
                .catch(console.error);
        });
        client.on('session_delete', ({ topic }) => {
            // Session was deleted: Reset the dApp state, clean up user session, etc.
            console.debug('WalletConnect event: session_delete', { topic });
            const connection = this.connections.get(topic);
            if (!connection) {
                console.error(`WalletConnect event 'session_delete' received for unknown topic '${topic}'.`);
                return;
            }
            this.connections.delete(topic);
            delegate.onDisconnect(connection);
        });
    }

    static async create(
        signClientInitOpts: SignClientTypes.Options,
        network: Network,
        delegate: WalletConnectionDelegate
    ) {
        const client = await SignClient.init(signClientInitOpts);
        return new WalletConnectConnector(client, network, delegate);
    }

    async connect() {
        const chainId = `${WALLET_CONNECT_SESSION_NAMESPACE}:${this.network.name}`;
        const session = await new Promise<SessionTypes.Struct | undefined>((resolve) => {
            connect(this.client, chainId, () => resolve(undefined)).then(resolve);
        });
        if (!session) {
            // Connect was cancelled.
            return undefined;
        }
        const rpcClient = new JsonRpcClient(new HttpProvider(this.network.jsonRpcUrl));
        const connection = new WalletConnectConnection(this, rpcClient, chainId, session);
        this.connections.set(session.topic, connection);
        return connection;
    }

    onDisconnect(connection: WalletConnectConnection) {
        this.connections.delete(connection.session.topic);
        this.delegate.onDisconnect(connection);
    }

    async getConnections() {
        return Array.from(this.connections.values());
    }

    async disconnect() {
        const connections = await this.getConnections();
        return Promise.all(connections.map((c) => c.disconnect())).then(() => {});
    }
}
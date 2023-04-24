import SignClient from '@walletconnect/sign-client';
import QRCodeModal from '@walletconnect/qrcode-modal';
import { ISignClient, SessionTypes, SignClientTypes } from '@walletconnect/types';
import { SmartContractParameters } from '@concordium/browser-wallet-api-helpers';
import {
    AccountTransactionPayload,
    AccountTransactionSignature,
    AccountTransactionType,
    HttpProvider,
    InitContractPayload,
    JsonRpcClient,
    serializeInitContractParameters,
    serializeTypeValue,
    serializeUpdateContractParameters,
    toBuffer,
    UpdateContractPayload,
} from '@concordium/web-sdk';
import { Network, Schema, WalletConnection, WalletConnectionDelegate, WalletConnector } from './WalletConnection';
import { UnreachableCaseError } from './error';

const WALLET_CONNECT_SESSION_NAMESPACE = 'ccd';

async function connect(client: ISignClient, chainId: string, cancel: () => void) {
    try {
        const { uri, approval } = await client.connect({
            requiredNamespaces: {
                ccd: {
                    methods: ['sign_and_send_transaction', 'sign_message'],
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

function serializeInitContractParam(
    initName: string,
    parameters: SmartContractParameters | undefined,
    schema: Schema | undefined
) {
    if (!parameters) {
        if (schema) {
            throw new Error(`schema provided when 'parameters' is undefined`);
        }
        // No parameters provided.
        return toBuffer('');
    }
    if (!schema) {
        throw new Error(`schema not provided when 'parameters' is present`);
    }
    switch (schema.type) {
        case 'module':
            return serializeInitContractParameters(
                initName,
                parameters,
                schemaAsBuffer(schema.valueBase64),
                schema.version
            );
        case 'parameter':
            return serializeTypeValue(parameters, schemaAsBuffer(schema.valueBase64));
        default:
            throw new UnreachableCaseError('schema', schema);
    }
}

function serializeUpdateContractMessage(
    contractName: string,
    entrypointName: string,
    parameters: SmartContractParameters | undefined,
    schema: Schema | undefined
) {
    if (!parameters) {
        if (schema) {
            throw new Error(`schema provided when 'parameters' is undefined`);
        }
        // No parameters provided.
        return toBuffer('');
    }
    if (!schema) {
        throw new Error(`schema not provided when 'parameters' is present`);
    }
    switch (schema.type) {
        case 'module':
            return serializeUpdateContractParameters(
                contractName,
                entrypointName,
                parameters,
                schemaAsBuffer(schema.valueBase64),
                schema.version
            );
        case 'parameter':
            return serializeTypeValue(parameters, schemaAsBuffer(schema.valueBase64));
        default:
            throw new UnreachableCaseError('schema', schema);
    }
}

function schemaAsBuffer(schemaBase64: string) {
    return toBuffer(schemaBase64, 'base64');
}

/**
 * Serialize parameters into appropriate payload field ('payload.param' for 'InitContract' and 'payload.message' for 'Update').
 * This payload field must be not already set as that would indicate that the caller thought that was the right way to pass them.
 * @param type Type identifier of the transaction.
 * @param payload Payload of the transaction. Must not include the fields 'param' and 'message' for transaction types 'InitContract' and 'Update', respectively.
 * @param parameters Contract invocation parameters. May be provided optionally provided for transactions of type 'InitContract' or 'Update'.
 * @param schema Schema for the contract invocation parameters. Must be provided if {@link parameters} is and omitted otherwise.
 */
function serializePayloadParameters(
    type: AccountTransactionType,
    payload: AccountTransactionPayload,
    parameters: SmartContractParameters | undefined,
    schema: Schema | undefined
): AccountTransactionPayload {
    switch (type) {
        case AccountTransactionType.InitContract: {
            const initContractPayload = payload as InitContractPayload;
            if (initContractPayload.param) {
                throw new Error(`'param' field of 'InitContract' parameters must be empty`);
            }
            return {
                ...payload,
                param: serializeInitContractParam(initContractPayload.initName, parameters, schema),
            };
        }
        case AccountTransactionType.Update: {
            const updateContractPayload = payload as UpdateContractPayload;
            if (updateContractPayload.message) {
                throw new Error(`'message' field of 'Update' parameters must be empty`);
            }
            const [contractName, entrypointName] = updateContractPayload.receiveName.split('.');
            return {
                ...payload,
                message: serializeUpdateContractMessage(contractName, entrypointName, parameters, schema),
            };
        }
        default: {
            if (parameters) {
                throw new Error(`'parameters' must not be provided for transaction of type '${type}'`);
            }
            if (schema) {
                throw new Error(`'schema' must not be provided for transaction of type '${type}'`);
            }
            return payload;
        }
    }
}

/**
 * Implementation of {@link WalletConnection} for WalletConnect v2.
 *
 * While WalletConnect doesn't set any restrictions on the amount of accounts and networks/chains
 * that can be associated with a single connection,
 * this implementation assumes that there is at least one and always use only the first one in the list.
 *
 * It also assumes that the network/chain is fixed to the one provided to {@link WalletConnector}.
 */
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

    getConnector() {
        return this.connector;
    }

    async ping() {
        const { topic } = this.session;
        await this.connector.client.ping({ topic });
    }

    /**
     * @return The account that the wallet currently associates with this connection.
     */
    getConnectedAccount() {
        // We're only expecting a single account to be connected.
        const fullAddress = this.session.namespaces[WALLET_CONNECT_SESSION_NAMESPACE].accounts[0];
        return fullAddress.substring(fullAddress.lastIndexOf(':') + 1);
    }

    getJsonRpcClient() {
        return this.rpcClient;
    }

    async signAndSendTransaction(
        accountAddress: string,
        type: AccountTransactionType,
        payload: AccountTransactionPayload,
        parameters?: SmartContractParameters,
        schema?: Schema
    ) {
        const params = {
            type: AccountTransactionType[type],
            sender: accountAddress,
            payload: accountTransactionPayloadToJson(serializePayloadParameters(type, payload, parameters, schema)),
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
        return signature as AccountTransactionSignature;
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

/**
 * Implementation of {@link WalletConnector} for WalletConnect v2.
 *
 * In relation to the interface it implements, this class imposes the restriction that all connections it initiates
 * must live on the chain/network that the connector was created with.
 * The connected wallet is assumed to respect this rule.
 */
export class WalletConnectConnector implements WalletConnector {
    readonly client: ISignClient;

    readonly network: Network;

    readonly delegate: WalletConnectionDelegate;

    readonly connections = new Map<string, WalletConnectConnection>();

    /**
     * Construct a new instance.
     *
     * Use {@link create} to have the sign client initialized from {@link SignClientTypes.Options}
     * to not have to do it manually.
     *
     * The constructor sets up event handling and appropriate forwarding to the provided delegate.
     *
     * @param client The underlying WalletConnect client.
     * @param delegate The object to receive events emitted by the client.
     * @param network The network/chain that connected accounts must live on.
     */
    constructor(client: SignClient, delegate: WalletConnectionDelegate, network: Network) {
        this.client = client;
        this.network = network;
        this.delegate = delegate;

        client.on('session_event', ({ topic, params: { chainId, event }, id }) => {
            console.debug('WalletConnect event: session_event', { topic, id, chainId, event });
            const connection = this.connections.get(topic);
            if (!connection) {
                console.error(`WalletConnect event 'session_event' received for unknown topic '${topic}'.`);
                return;
            }
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
            delegate.onAccountChanged(connection, connection.getConnectedAccount());
        });
        client.on('session_delete', ({ topic }) => {
            // Session was deleted: Reset the dApp state, clean up user session, etc.
            console.debug('WalletConnect event: session_delete', { topic });
            const connection = this.connections.get(topic);
            if (!connection) {
                console.error(`WalletConnect event 'session_delete' received for unknown topic '${topic}'.`);
                return;
            }
            this.onDisconnect(connection);
        });
    }

    /**
     * Convenience function for creating a new instance from WalletConnection configuration instead of an already initialized client.
     *
     * @param signClientInitOpts WalletConnect configuration.
     * The constant {@link CONCORDIUM_WALLET_CONNECT_PROJECT_ID} exported by this library may be used as {@link SignClientTypes.Options.projectId projectID}
     * if the dApp doesn't have its own {@link https://cloud.walletconnect.com WalletConnect Cloud} project.
     * @param delegate The object to receive events emitted by the client.
     * @param network The network/chain that connected accounts must live on.
     */
    static async create(
        signClientInitOpts: SignClientTypes.Options,
        delegate: WalletConnectionDelegate,
        network: Network
    ) {
        const client = await SignClient.init(signClientInitOpts);
        return new WalletConnectConnector(client, delegate, network);
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
        this.delegate.onConnected(connection, connection.getConnectedAccount());
        return connection;
    }

    onDisconnect(connection: WalletConnectConnection) {
        this.connections.delete(connection.session.topic);
        this.delegate.onDisconnected(connection);
    }

    getConnections() {
        return Array.from(this.connections.values());
    }

    /**
     * Disconnect all connections.
     */
    async disconnect() {
        await Promise.all(this.getConnections().map((c) => c.disconnect()));
        // TODO Disconnect the underlying client.
    }
}

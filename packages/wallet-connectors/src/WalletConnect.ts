import {
    SendTransactionInitContractPayload,
    SendTransactionPayload,
    SendTransactionUpdateContractPayload,
} from '@concordium/browser-wallet-api-helpers';
import {
    AccountTransactionPayload,
    AccountTransactionSignature,
    AccountTransactionType,
    BigintFormatType,
    ContractName,
    CredentialStatements,
    EntrypointName,
    InitContractPayload,
    Parameter,
    UpdateContractPayload,
    VerifiablePresentation,
    getTransactionKindString,
    jsonUnwrapStringify,
    serializeInitContractParameters,
    serializeTypeValue,
    serializeUpdateContractParameters,
    toBuffer,
} from '@concordium/web-sdk';
import { WalletConnectModal } from '@walletconnect/modal';
import { MobileWallet } from '@walletconnect/modal-core';
import SignClient from '@walletconnect/sign-client';
import { ISignClient, ProposalTypes, SessionTypes, SignClientTypes } from '@walletconnect/types';
import { CONCORDIUM_WALLET_CONNECT_PROJECT_ID } from '.';
import {
    Network,
    Schema,
    SignableMessage,
    TypedSmartContractParameters,
    WalletConnection,
    WalletConnectionDelegate,
    WalletConnector,
} from './WalletConnection';
import { UnreachableCaseError } from './error';

const WALLET_CONNECT_SESSION_NAMESPACE = 'ccd';

export const enum WalletConnectMethods {
    SignAndSendTransaction = 'sign_and_send_transaction',
    SignMessage = 'sign_message',
    RequestVerifiablePresentation = 'request_verifiable_presentation',
}

export const enum WalletConnectEvents {
    ChainChanged = 'chain_changed',
    AccountsChanged = 'accounts_changed',
}

type WalletConnectMobileWallet = MobileWallet | string;

/**
 * 
 */
export const concordiumWallet = '7dcb0e5eb1b4fc6e2e0b143201c489ea6c618259f49527527d4a349d1a95ba7b';

export const cryptoXWallet: MobileWallet = {
    id: 'CryptoXWallet',
    name: 'CryptoX Wallet',
    links: {
        native: 'cryptox://',
    },
};

async function connect(
    client: ISignClient,
    scope: ProposalTypes.RequiredNamespace,
    cancel: () => void,
    mobileWallets?: WalletConnectMobileWallet[]
) {
    let modal: WalletConnectModal | undefined;
    const { mobile, explorer } = mobileWallets?.reduce<{ mobile: MobileWallet[]; explorer: string[] }>(
        (acc, cur) => {
            if (typeof cur === 'string') {
                acc.explorer.push(cur);
            } else {
                acc.mobile.push(cur);
            }

            return acc;
        },
        { mobile: [], explorer: [] }
    ) ?? {};
    try {
        const { uri, approval } = await client.connect({
            requiredNamespaces: {
                ccd: scope,
            },
        });
        if (uri) {
            modal = new WalletConnectModal({
                projectId: CONCORDIUM_WALLET_CONNECT_PROJECT_ID,
                chains: scope.chains,
                mobileWallets: mobile,
                desktopWallets: [],
                explorerRecommendedWalletIds: explorer,
                explorerExcludedWalletIds: 'ALL',
            });
            // Open modal as we're not connecting to an existing pairing.
            modal.openModal({ uri });
        }
        return await approval();
    } catch (e) {
        // Ignore falsy errors.
        if (e) {
            console.error(`WalletConnect client error: ${e}`);
        }
        cancel();
    } finally {
        if (modal !== undefined) {
            modal.closeModal();
        }
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
    return jsonUnwrapStringify(data, BigintFormatType.Integer, (_key, value) => {
        if (value?.type === 'Buffer') {
            // Buffer has already been transformed by its 'toJSON' method.
            return toBuffer(value.data).toString('hex');
        }
        return value;
    });
}

function serializeInitContractParam(
    contractName: ContractName.Type,
    typedParams: TypedSmartContractParameters | undefined
): Parameter.Type {
    if (!typedParams) {
        return Parameter.empty();
    }
    const { parameters, schema } = typedParams;
    switch (schema.type) {
        case 'ModuleSchema':
            return serializeInitContractParameters(contractName, parameters, schema.value, schema.version);
        case 'TypeSchema':
            return serializeTypeValue(parameters, schema.value);
        default:
            throw new UnreachableCaseError('schema', schema);
    }
}

function serializeUpdateContractMessage(
    contractName: ContractName.Type,
    entrypointName: EntrypointName.Type,
    typedParams: TypedSmartContractParameters | undefined
): Parameter.Type {
    if (!typedParams) {
        return Parameter.empty();
    }
    const { parameters, schema } = typedParams;
    switch (schema.type) {
        case 'ModuleSchema':
            return serializeUpdateContractParameters(
                contractName,
                entrypointName,
                parameters,
                schema.value,
                schema.version
            );
        case 'TypeSchema':
            return serializeTypeValue(parameters, schema.value);
        default:
            throw new UnreachableCaseError('schema', schema);
    }
}

/**
 * Convert schema into the object format expected by the Mobile crypto library (function 'parameter_to_json')
 * which decodes the parameter before presenting it to the user for approval.
 * @param schema The schema object.
 */
function convertSchemaFormat(schema: Schema | undefined) {
    if (!schema) {
        return null;
    }
    switch (schema.type) {
        case 'ModuleSchema':
            return {
                type: 'module',
                value: schema.value.toString('base64'),
                version: schema.version,
            };
        case 'TypeSchema':
            return {
                type: 'parameter',
                value: schema.value.toString('base64'),
            };
        default:
            throw new UnreachableCaseError('schema', schema);
    }
}

/**
 * Serialize parameters into appropriate payload field ('payload.param' for 'InitContract' and 'payload.message' for 'Update').
 * This payload field must be not already set as that would indicate that the caller thought that was the right way to pass them.
 * @param type Type identifier of the transaction.
 * @param payload Payload of the transaction. Must not include the fields 'param' and 'message' for transaction types 'InitContract' and 'Update', respectively.
 * @param typedParams Contract invocation parameters and associated schema. May be provided optionally provided for transactions of type 'InitContract' or 'Update'.
 */
function serializePayloadParameters(
    type: AccountTransactionType,
    payload: SendTransactionPayload,
    typedParams: TypedSmartContractParameters | undefined
): AccountTransactionPayload {
    switch (type) {
        case AccountTransactionType.InitContract: {
            const initContractPayload = payload as InitContractPayload;
            if (initContractPayload.param) {
                throw new Error(`'param' field of 'InitContract' parameters must be empty`);
            }
            return {
                ...payload,
                param: serializeInitContractParam(initContractPayload.initName, typedParams),
            } as InitContractPayload;
        }
        case AccountTransactionType.Update: {
            const updateContractPayload = payload as UpdateContractPayload;
            if (updateContractPayload.message) {
                throw new Error(`'message' field of 'Update' parameters must be empty`);
            }
            const [contractName, entrypointName] = updateContractPayload.receiveName.value.split('.');
            return {
                ...payload,
                message: serializeUpdateContractMessage(
                    ContractName.fromString(contractName),
                    EntrypointName.fromString(entrypointName),
                    typedParams
                ),
            } as UpdateContractPayload;
        }
        default: {
            if (typedParams) {
                throw new Error(`'typedParams' must not be provided for transaction of type '${type}'`);
            }
            return payload as Exclude<
                SendTransactionPayload,
                SendTransactionInitContractPayload | SendTransactionUpdateContractPayload
            >;
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

    readonly chainId: string;

    session: SessionTypes.Struct;

    constructor(connector: WalletConnectConnector, chainId: string, session: SessionTypes.Struct) {
        this.connector = connector;
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

    async signAndSendTransaction(
        accountAddress: string,
        type: AccountTransactionType,
        payload: SendTransactionPayload,
        typedParams?: TypedSmartContractParameters
    ) {
        const params = {
            type: getTransactionKindString(type),
            sender: accountAddress,
            payload: accountTransactionPayloadToJson(serializePayloadParameters(type, payload, typedParams)),
            schema: convertSchemaFormat(typedParams?.schema),
        };
        try {
            const { hash } = (await this.connector.client.request({
                topic: this.session.topic,
                request: {
                    method: 'sign_and_send_transaction',
                    params,
                },
                chainId: this.chainId,
            })) as SignAndSendTransactionResult; // TODO do proper type check
            return hash;
        } catch (e) {
            if (isSignAndSendTransactionError(e) && e.code === 500) {
                throw new Error('transaction rejected in wallet');
            }
            throw e;
        }
    }

    async signMessage(accountAddress: string, msg: SignableMessage) {
        switch (msg.type) {
            case 'StringMessage': {
                const params = { message: msg.value };
                const signature = await this.connector.client.request({
                    topic: this.session.topic,
                    request: {
                        method: 'sign_message',
                        params,
                    },
                    chainId: this.chainId,
                });
                return signature as AccountTransactionSignature; // TODO do proper type check
            }
            case 'BinaryMessage':
                throw new Error(`signing 'BinaryMessage' is not yet supported by the mobile wallets`);
            default:
                throw new UnreachableCaseError('message', msg);
        }
    }

    async requestVerifiablePresentation(
        challenge: string,
        credentialStatements: CredentialStatements
    ): Promise<VerifiablePresentation> {
        const paramsJson = jsonUnwrapStringify({ challenge, credentialStatements });
        const params = { paramsJson };
        const result = await this.connector.client.request<{ verifiablePresentationJson: string }>({
            topic: this.session.topic,
            request: {
                method: 'request_verifiable_presentation',
                params,
            },
            chainId: this.chainId,
        });
        return VerifiablePresentation.fromString(result.verifiablePresentationJson);
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

    /**
     * Connects to wallet connect with the configuration provided by the parameters
     *
     * @param methods - The methods to request permission to use for in the wallet
     * @param events - The events to request permission to read from the wallet
     * @param mobileWallets - The (mobile) wallets to be selectable from the walletconnect modal
     *
     * @returns the {@linkcode WalletConnectConnection}, or `undefined` if rejected from the wallet. 
     */
    async connectWithScope(
        methods: WalletConnectMethods[],
        events: WalletConnectEvents[],
        mobileWallets?: WalletConnectMobileWallet[]
    ) {
        const { name } = this.network;

        const chainId = `${WALLET_CONNECT_SESSION_NAMESPACE}:${name}`;
        const scope: ProposalTypes.RequiredNamespace = {
            chains: [chainId],
            methods: methods,
            events: events,
        };
        const session = await new Promise<SessionTypes.Struct | undefined>((resolve) => {
            connect(this.client, scope, () => resolve(undefined), mobileWallets).then(resolve);
        });
        if (!session) {
            // Connect was cancelled.
            return undefined;
        }
        const connection = new WalletConnectConnection(this, chainId, session);
        this.connections.set(session.topic, connection);
        this.delegate.onConnected(connection, connection.getConnectedAccount());
        return connection;
    }

    /**
     * Like {@linkcode WalletConnectConnector.connectWithScope}, but with permission to use all methods and read all events.
     */
    async connect() {
        return this.connectWithScope(
            [
                WalletConnectMethods.SignAndSendTransaction,
                WalletConnectMethods.SignMessage,
                WalletConnectMethods.RequestVerifiablePresentation,
            ],
            [WalletConnectEvents.AccountsChanged, WalletConnectEvents.ChainChanged],
            [cryptoXWallet, concordiumWallet]
        );
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

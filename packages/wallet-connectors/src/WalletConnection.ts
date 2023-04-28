import {
    AccountTransactionSignature,
    AccountTransactionType,
    JsonRpcClient,
    SchemaVersion,
    toBuffer,
} from '@concordium/web-sdk';
import { Buffer } from 'buffer/';
import { SendTransactionPayload, SmartContractParameters } from '@concordium/browser-wallet-api-helpers';

export type ModuleSchema = {
    type: 'ModuleSchema';
    value: Buffer;
    version?: SchemaVersion;
};
export type ParameterSchema = {
    type: 'ParameterSchema';
    value: Buffer;
};

/**
 * Discriminated union type for contract invocation schemas.
 * Is used to select the correct method for encoding the invocation parameters using the schema.
 */
export type Schema = ModuleSchema | ParameterSchema;

/**
 * {@link Schema} constructor for a module schema.
 * @param schemaBase64 The raw module schema in base64 encoding.
 * @param version The schema spec version. Omit if the version is embedded into the schema.
 * @throws Error if {@link schemaBase64} is not valid base64.
 */
export function moduleSchemaFromBase64(schemaBase64: string, version?: SchemaVersion): ModuleSchema {
    return moduleSchema(schemaAsBuffer(schemaBase64), version);
}

/**
 * {@link Schema} constructor for a module schema.
 * @param schema The raw module schema in binary.
 * @param version The schema spec version. Omit if the version is embedded into the schema.
 */
export function moduleSchema(schema: Buffer, version?: SchemaVersion): ModuleSchema {
    return {
        type: 'ModuleSchema',
        value: schema,
        version: version,
    };
}

/**
 * {@link Schema} constructor for a parameter schema.
 * @param schemaBase64 The raw parameter schema in base64 encoding.
 * @throws Error if {@link schemaBase64} is not valid base64.
 */
export function parameterSchemaFromBase64(schemaBase64: string): ParameterSchema {
    return parameterSchema(schemaAsBuffer(schemaBase64));
}

/**
 * {@link Schema} constructor for a parameter schema.
 * @param schema The raw parameter schema in binary.
 */
export function parameterSchema(schema: Buffer): ParameterSchema {
    return {
        type: 'ParameterSchema',
        value: schema,
    };
}

/**
 * Convenience function for creating
 * @param parameters
 * @param schema
 */
export function typedParams(parameters: SmartContractParameters, schema: Schema | undefined) {
    if (!schema) {
        return undefined;
    }
    return { parameters, schema };
}

function schemaAsBuffer(schemaBase64: string) {
    const res = toBuffer(schemaBase64, 'base64');
    // Check round-trip. This requires the provided schema to be properly padded.
    if (res.toString('base64') !== schemaBase64) {
        throw new Error(`provided schema '${schemaBase64}' is not valid base64`);
    }
    return res;
}

export type TypedSmartContractParameters = {
    parameters: SmartContractParameters,
    schema: Schema
}

/**
 * Interface for interacting with a wallet backend through a connection that's already been established.
 * The connected account (and in turn connected network/chain) is managed by the wallet
 * and should therefore not generally be considered fixed for a given connection.
 * Even though some protocols support connecting to multiple accounts at the same time,
 * this interface assumes that only one of them is active at any given time.
 * To listen for changes to the connection parameters a {@link WalletConnectionDelegate} implementation
 * should be registered on the {@link WalletConnector} responsible for the concrete protocol.
 */
export interface WalletConnection {
    /**
     * @return The connector that instantiated this connection.
     */
    getConnector(): WalletConnector;

    /**
     * Ping the connection.
     */
    ping(): Promise<void>;

    /**
     * Returns a JSON-RPC client that is ready to perform requests against some Concordium Node connected to network/chain
     * that the connected account lives on.
     *
     * This method is included because it's part of the Browser Wallet's API.
     * It should be used with care as it's hard to guarantee that it actually connects to the expected network.
     * The application may easily instantiate its own client and use that instead for more control.
     *
     * Note that this method cannot be moved to {@link WalletConnector} as the Browser Wallet's RPC client doesn't work
     * until a connection has been established.
     *
     * @return Returns a JSON-RPC client for performing requests against a Concordium Node connected
     * to the appropriate network.
     */
    getJsonRpcClient(): JsonRpcClient;

    /**
     * Assembles a transaction and sends it off to the wallet for approval and submission.
     *
     * The returned promise resolves to the hash of the transaction once the request is approved in the wallet and successfully submitted.
     * If this doesn't happen, the promise rejects with an explanatory error message.
     *
     * If the transaction is a contract init/update, then any contract parameters and a corresponding schema
     * must be provided in {@link typeParameters}. The parameters must be omitted from {@link payload}.
     * It's an error to provide {@link typeParameters} for non-contract transactions and for contract transactions with empty
     *
     * @param accountAddress The account whose keys are used to sign the transaction.
     * @param type Type of the transaction (i.e. {@link AccountTransactionType.InitContract} or {@link AccountTransactionType.Update}.
     * @param payload The payload of the transaction *not* including the parameters of the contract invocation.
     * @param typedParams The parameters of the contract invocation and a schema describing how to serialize them. The parameters must be given as a plain JavaScript object.
     * @return A promise for the hash of the submitted transaction.
     */
    signAndSendTransaction(
        accountAddress: string,
        type: AccountTransactionType,
        payload: SendTransactionPayload,
        typedParams?: TypedSmartContractParameters,
    ): Promise<string>;

    /**
     * Request the wallet to sign a message using the keys of the given account.
     *
     * The returned promise resolves to the signatures once the wallet approves the request and successfully signs the message.
     * If this doesn't happen, the promise rejects with an explanatory error message.
     *
     * @param accountAddress The account whose keys are used to sign the message.
     * @param message The message to sign.
     * @return A promise for the signatures of the message.
     */
    signMessage(accountAddress: string, message: string): Promise<AccountTransactionSignature>;

    /**
     * Close the connection and clean up relevant resources.
     * There's no guarantee that the wallet will consider the connection closed
     * even after the returned promise resolves successfully,
     * but it should ensure that the app stops using the connection.
     * See the documentation for the concrete implementations for details on what guarantees they provide.
     *
     * @return A promise that resolves once the disconnect has completed.
     */
    disconnect(): Promise<void>;
}

/**
 * Collection of fields corresponding to a particular network/chain.
 */
export interface Network {
    /**
     * The name of the network (i.e. "testnet", "mainnet", etc.).
     */
    name: string;

    /**
     * The hash of the genesis block.
     */
    genesisHash: string;

    /**
     * The URL of a <a href="https://github.com/Concordium/concordium-json-rpc">Concordium JSON-RPC proxy</a> instance
     * for performing API (v1) queries against a Concordium Node instance connected to this network.
     */
    jsonRpcUrl: string;

    /**
     * The base URL of a <a href="https://github.com/Concordium/concordium-scan">CCDScan</a> instance
     * connected to this network.
     * While CCDScan supports queries against its backend,
     * the main use of this URL is to construct links to the frontend.
     */
    ccdScanBaseUrl: string;
}

/**
 * Interface for receiving events in a standardized set of callbacks.
 * As the relevant {@link WalletConnection} is passed into the callback,
 * apps will usually create a single delegate to be reused across all {@link WalletConnector}s
 * over the entire lifetime of the application.
 * The methods could be called redundantly,
 * so implementations should check the argument values against the current state and only react if they differ.
 */
export interface WalletConnectionDelegate {
    /**
     * Notification that the network/chain of the given {@link WalletConnection} has changed, as reported by the wallet.
     * @param connection Affected connection.
     * @param genesisHash The hash of the genesis block corresponding to the current chain.
     */
    onChainChanged(connection: WalletConnection, genesisHash: string): void;

    /**
     * Notification that the account selected on the given {@link WalletConnection} has changed, as reported by the wallet.
     * @param connection Affected connection.
     * @param address The address of the currently connected account.
     */
    onAccountChanged(connection: WalletConnection, address: string | undefined): void;

    /**
     * Notification that the given {@link WalletConnection} has been established.
     * @param connection Affected connection.
     * @param address The address of the initially connected account.
     */
    onConnected(connection: WalletConnection, address: string | undefined): void;

    /**
     * Notification that the given {@link WalletConnection} has been disconnected.
     * @param connection Affected connection.
     */
    onDisconnected(connection: WalletConnection): void;
}

/**
 * Interface for wrapping a client for a concrete protocol and handle events emitted by this client:
 * A {@link WalletConnectionDelegate} is usually passed to the connector on construction
 * to receive events in a standardized format.
 * The implementation may support multiple connections being instantiated from a single connector.
 */
export interface WalletConnector {
    /**
     * Request a connected to be initiated over the underlying protocol.
     *
     * Once the wallet approves the connection, the returned promise resolves to the connection object.
     * If the user cancels the connection before it's established, then the promise resolves to undefined.
     * Not all connectors support cancellation.
     *
     * If the wallet rejects the connection (or establishing it fails for other reasons),
     * then the promise rejects with an explanatory error message.
     *
     * @return A promise resolving to the resulting connection object.
     */
    connect(): Promise<WalletConnection | undefined>;

    /**
     * Get a list of all connections initiated by this connector that have not been disconnected.
     * @return A promise resolving to all the connector's connections.
     */
    getConnections(): WalletConnection[];

    /**
     * Ensure that all connections initiated by this connector are disconnected
     * and clean up resources associated to the connector.
     * See the documentation for the concrete implementations for details on what guarantees they provide.
     */
    disconnect(): Promise<void>;
}

/**
 * Convenience function for invoking an async function with the JSON-RPC proxy client of the given {@link WalletConnection}.
 *
 * @param connection The connected used to resolve the RPC client.
 * @param f The async function to invoke.
 * @return The promise returned by {@link f}.
 */
export async function withJsonRpcClient<T>(connection: WalletConnection, f: (c: JsonRpcClient) => Promise<T>) {
    return f(connection.getJsonRpcClient());
}

import { WalletConnection, withJsonRpcClient } from '@concordium/wallet-connectors';
import { useEffect, useState } from 'react';
import { ModuleReference } from '@concordium/web-sdk';
import { findSchema, Info, SchemaRpcResult } from './contract';

export function useContractSchemaRpc(connection: WalletConnection, contract: Info) {
    const [result, setResult] = useState<SchemaRpcResult>();
    const [error, setError] = useState('');
    useEffect(() => {
        setResult(undefined);
        setError('');
        withJsonRpcClient(connection, (rpc) => rpc.getModuleSource(new ModuleReference(contract.moduleRef)))
            .then((src) => {
                if (!src) {
                    throw new Error('module source is empty');
                }
                if (src.length < 12) {
                    throw new Error('module source is too short');
                }
                return WebAssembly.compile(src.slice(12));
            })
            .then(findSchema)
            .then((r) => {
                setResult(r);
                setError('');
            })
            .catch((err) => {
                setResult(undefined);
                setError((err as Error).message);
            });
    }, [contract, connection]);
    return [result, error];
}

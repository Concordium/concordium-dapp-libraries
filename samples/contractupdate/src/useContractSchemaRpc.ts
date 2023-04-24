import { err, ok, Result, ResultAsync } from 'neverthrow';
import { Buffer } from 'buffer/';
import { Info, moduleSchema, Schema, WalletConnection, withJsonRpcClient } from '@concordium/react-components';
import { useEffect, useState } from 'react';
import { errorString } from './util';
import { ModuleReference } from '@concordium/web-sdk';

export interface SchemaRpcResult {
    sectionName: string;
    schema: Schema;
}

function findCustomSections(m: WebAssembly.Module) {
    function getCustomSections(sectionName: string, schemaVersion: number) {
        const s = WebAssembly.Module.customSections(m, sectionName);
        return s.length === 0 ? undefined : { sectionName, schemaVersion, contents: s };
    }
    return (
        getCustomSections('concordium-schema-v1', 1) ||
        getCustomSections('concordium-schema-v2', 2) ||
        getCustomSections('concordium-schema', 0)
    );
}

function findSchema(m: WebAssembly.Module): Result<SchemaRpcResult | undefined, string> {
    const sections = findCustomSections(m);
    if (!sections) {
        return ok(undefined);
    }
    const { sectionName, schemaVersion, contents } = sections;
    if (contents.length !== 1) {
        return err(`unexpected size of custom section "${sectionName}"`);
    }
    return ok({ sectionName, schema: moduleSchema(Buffer.from(contents[0]).toString('base64'), schemaVersion) });
}

export function useContractSchemaRpc(connection: WalletConnection, contract: Info) {
    const [result, setResult] = useState<Result<SchemaRpcResult | undefined, string>>();
    useEffect(() => {
        ResultAsync.fromPromise(
            withJsonRpcClient(connection, (rpc) => rpc.getModuleSource(new ModuleReference(contract.moduleRef))),
            errorString
        )
            .andThen((r) => {
                if (!r) {
                    return err('module source is empty');
                }
                if (r.length < 12) {
                    return err(`module source ${r.length} bytes which is less than the header size (12 bytes)`);
                }
                return ResultAsync.fromPromise(WebAssembly.compile(r.slice(12)), errorString);
            })
            .andThen(findSchema)
            .then(setResult);
    }, [contract, connection]);
    return result;
}

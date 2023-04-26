import { err, ok, Result, ResultAsync } from 'neverthrow';
import { Buffer } from 'buffer/';
import { Info, moduleSchema, Schema, WalletConnection, withJsonRpcClient } from '@concordium/react-components';
import { useEffect, useState } from 'react';
import { errorString } from './util';
import { ModuleReference, SchemaVersion } from '@concordium/web-sdk';

export interface SchemaRpcResult {
    sectionName: string;
    schema: Schema;
}

function findCustomSections(m: WebAssembly.Module) {
    function getCustomSections(sectionName: string, schemaVersion: SchemaVersion | undefined) {
        const s = WebAssembly.Module.customSections(m, sectionName);
        return s.length === 0 ? undefined : { sectionName, schemaVersion, contents: s };
    }
    // First look for embedded version, then v1, then v0. The "v"s being off by 1 is not an error.
    return (
        getCustomSections('concordium-schema', undefined) ||
        getCustomSections('concordium-schema-v2', SchemaVersion.V1) ||
        getCustomSections('concordium-schema-v1', SchemaVersion.V0)
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
    return ok({ sectionName, schema: moduleSchema(Buffer.from(contents[0]), schemaVersion) });
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
                    return err(`module source is ${r.length} bytes which is not enough to fit a 12-byte header`);
                }
                // console.log('module', r.length, r.toString('hex'));
                return ResultAsync.fromPromise(WebAssembly.compile(r.slice(12)), errorString);
            })
            .andThen(findSchema)
            .then(setResult);
    }, [contract, connection]);
    return result;
}

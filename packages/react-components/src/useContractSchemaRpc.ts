import { Buffer } from 'buffer/';
import { useEffect, useState } from 'react';
import { Schema, moduleSchema } from '@concordium/wallet-connectors';
import { ConcordiumGRPCClient, ModuleReference, SchemaVersion } from '@concordium/web-sdk';
import { Info } from './useContractSelector';

export interface SchemaRpcResult {
    sectionName: string;
    schema: Schema;
}

function findCustomSections(m: WebAssembly.Module, moduleVersion: number) {
    function getCustomSections(sectionName: string, schemaVersion: SchemaVersion | undefined) {
        const s = WebAssembly.Module.customSections(m, sectionName);
        return s.length === 0 ? undefined : { sectionName, schemaVersion, contents: s };
    }

    // First look for section containing schema with embedded version, then "-v1" or "-v2" depending on the module version.
    // See also comment in 'useContractSchemaRpc'.
    switch (moduleVersion) {
        case 0:
            return (
                getCustomSections('concordium-schema', undefined) || // always v0
                getCustomSections('concordium-schema-v1', SchemaVersion.V0) // v0 (not a typo)
            );
        case 1:
            return (
                getCustomSections('concordium-schema', undefined) || // v1, v2, or v3
                getCustomSections('concordium-schema-v2', SchemaVersion.V1) // v1 (not a typo)
            );
    }
    return getCustomSections('concordium-schema', undefined); // expecting to find this section in future module versions
}

function findSchema(m: WebAssembly.Module, moduleVersion: 0 | 1): SchemaRpcResult | undefined {
    const sections = findCustomSections(m, moduleVersion);
    if (!sections) {
        return undefined;
    }
    const { sectionName, schemaVersion, contents } = sections;
    if (contents.length !== 1) {
        throw new Error(`unexpected size of custom section "${sectionName}"`);
    }
    return { sectionName, schema: moduleSchema(Buffer.from(contents[0]), schemaVersion) };
}

async function fetchSchema(rpc: ConcordiumGRPCClient, contract: Info) {
    const { version, source } = await rpc.getModuleSource(ModuleReference.fromHexString(contract.moduleRef));
    if (source.length === 0) {
        throw new Error('module source is empty');
    }
    // The module can contain a schema in one of two different custom sections.
    // The supported sections depend on the module version.
    // The schema version can be either defined by the section name or embedded into the actual schema:
    // - Both v0 and v1 modules support the section 'concordium-schema' where the schema includes the version.
    //   - For v0 modules this is always a v0 schema.
    //   - For v1 modules this can be a v1, v2, or v3 schema.
    // - V0 modules additionally support section 'concordium-schema-v1' which always contain a v0 schema (not a typo).
    // - V1 modules additionally support section 'concordium-schema-v2' which always contain a v1 schema (not a typo).
    // The section 'concordium-schema' is the most common and is what the current tooling produces.
    const module = await WebAssembly.compile(source);
    return findSchema(module, version);
}

export function useContractSchemaRpc(rpc: ConcordiumGRPCClient, contract: Info, setError: (err: string) => void) {
    const [result, setResult] = useState<SchemaRpcResult | undefined>();
    useEffect(() => {
        fetchSchema(rpc, contract)
            .then((r) => {
                setResult(r);
                setError('');
            })
            .catch((err) => {
                setError(err);
            });
    }, [rpc, contract]);
    return result;
}

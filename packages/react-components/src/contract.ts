import { AccountAddress, CcdAmount } from '@concordium/web-sdk';
import { Buffer } from 'buffer';

/**
 * Data and state of a smart contract.
 */
export interface Info {
    /**
     * Version of the contract's semantics.
     */
    version: number;

    /**
     * The contract's index on the chain.
     */
    index: bigint;

    /**
     * The contract's name without the "init_" prefix.
     */
    name: string;

    /**
     * The contract's balance.
     */
    amount: CcdAmount;

    /**
     * The address of the account that owns the contract.
     */
    owner: AccountAddress;

    /**
     * The contract's invokable methods.
     */
    methods: string[];

    /**
     * The reference identifier of the contract's module.
     */
    moduleRef: string;
}

export interface SchemaRpcResult {
    sectionName: string;
    schema: string;
}

export function findSchema(m: WebAssembly.Module) {
    function getCustomSection(name: string) {
        const s = WebAssembly.Module.customSections(m, name);
        if (s.length === 0) {
            return undefined;
        }
        if (s.length !== 1) {
            throw new Error(`expected non-empty custom section "${name}" to have size 1 but it was ${s.length}`);
        }
        return { sectionName: name, schema: Buffer.from(s[0]).toString('base64') };
    }
    // Return source of first resolved non-empty custom section.
    return (
        getCustomSection('concordium-schema') ||
        getCustomSection('concordium-schema-v2') ||
        getCustomSection('concordium-schema-v1')
    );
}

import { useEffect, useState } from 'react';
import { JsonRpcClient } from '@concordium/web-sdk';
import { Info } from './contract';

async function refresh(rpc: JsonRpcClient, index: bigint) {
    const info = await rpc.getInstanceInfo({ index, subindex: BigInt(0) });
    if (!info) {
        throw new Error(`contract ${index} not found`);
    }

    const { version, name, owner, amount, methods, sourceModule } = info;
    const prefix = 'init_';
    if (!name.startsWith(prefix)) {
        throw new Error(`name "${name}" doesn't start with "init_"`);
    }
    return {
        version,
        index,
        name: name.substring(prefix.length),
        amount,
        owner,
        methods,
        moduleRef: sourceModule.moduleRef,
    };
}

function parseContractIndex(input: string) {
    try {
        return BigInt(input);
    } catch (e) {
        throw new Error(`invalid contract index '${input}'`);
    }
}

async function loadContract(rpc: JsonRpcClient, input: string) {
    const index = parseContractIndex(input);
    return refresh(rpc, index);
}

/**
 * A {@link useContractSelector} instance.
 */
export interface ContractSelector {
    /**
     * The selected contract info, if available.
     * Is undefined if there isn't any index to look up, during lookup, or the lookup failed.
     * In the latter case {@link validationError} will be non-empty.
     */
    selected: Info | undefined;

    /**
     * Indicator of whether the lookup is in progress.
     */
    isLoading: boolean;

    /**
     * Error parsing the input string or RPC error looking up the contract.
     */
    // TODO Rename as it isn't only a validation error.
    validationError: string;
}

/**
 * React hook to look up a smart contract's data and state from its index.
 * @param rpc JSON-RPC proxy client through which to perform the lookup.
 * @param input The index of the contract to look up.
 * @return The resolved contract and related state.
 */
export function useContractSelector(rpc: JsonRpcClient | undefined, input: string): ContractSelector {
    const [selected, setSelected] = useState<Info>();
    const [isLoading, setIsLoading] = useState(false);
    const [validationError, setValidationError] = useState('');
    useEffect(() => {
        setSelected(undefined);
        setValidationError('');
        if (rpc && input) {
            setIsLoading(true);
            loadContract(rpc, input)
                .then(setSelected)
                .catch((err) => {
                    setValidationError((err as Error).message);
                    setSelected(undefined); // prevents race condition against an ongoing successful query
                })
                .finally(() => setIsLoading(false));
        }
    }, [rpc, input]);
    return { selected, isLoading, validationError };
}

import { useEffect, useState } from 'react';
import { Network } from '@concordium/wallet-connectors';
import { ConcordiumGRPCClient } from '@concordium/web-sdk';
import { GrpcWebFetchTransport } from '@protobuf-ts/grpcweb-transport';

export interface GrpcClient {
    grpcClient: ConcordiumGRPCClient | undefined;
}

export function useGrpcClient({ grpcOpts }: Network): GrpcClient {
    const [grpcClient, setGrpcClient] = useState<ConcordiumGRPCClient>();
    useEffect(() => {
        if (!grpcOpts) {
            return setGrpcClient(undefined);
        }
        // No exceptions should be thrown from here.
        setGrpcClient(new ConcordiumGRPCClient(new GrpcWebFetchTransport(grpcOpts)));
    }, [grpcOpts]);
    return { grpcClient };
}

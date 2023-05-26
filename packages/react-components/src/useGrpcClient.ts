import { useEffect, useState } from 'react';
import { Network } from '@concordium/wallet-connectors';
import { ConcordiumGRPCClient } from '@concordium/web-sdk';
import { GrpcWebFetchTransport } from '@protobuf-ts/grpcweb-transport';

export function useGrpcClient({ grpcOpts }: Network): ConcordiumGRPCClient | undefined {
    const [client, setClient] = useState<ConcordiumGRPCClient>();
    useEffect(() => {
        if (!grpcOpts) {
            return setClient(undefined);
        }
        // No exceptions should ever be thrown from here.
        setClient(new ConcordiumGRPCClient(new GrpcWebFetchTransport(grpcOpts)));
    }, [grpcOpts]);
    return client;
}

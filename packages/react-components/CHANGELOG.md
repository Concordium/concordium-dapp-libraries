# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

-   `useDisconnect`: New hook for managing the action of disconnecting a connection.

### Changed

-   `useConnect`: Hook now accepts a function for handling a reported error instead of returning the error from the hook.
    The new `useDisonnect` hook is implemented the same way, allowing them to share error handling.
-   `useWalletConnectorTypeStatus`: Replacement of the hook `useWalletConnectorSelector` with renamed fields and a slightly different purpose:
    It no longer returns a `select` function, leaving the app free to decide what "select" means in different contexts.

## [0.2.1] - 2023-03-17

### Changed

-   Bump and unpin dependency to `wallet-connectors`.

## [0.2.0] - 2023-02-06

### Added

-   Hooks `useConnection` and `useConnect` for managing connections.

### Changed

-   `WithWalletConnector`: Decouple component from concrete connector implementations by constructing instances from the application.
    This also introduces the ability for applications to control the activation/deactivation lifecycle of the connectors.
-   `WithWalletConnector`: Removed method `connectActive` (and child prop `isConnecting`).
    Use the `connect` method directly on `WalletConnector` instead.
-   `WithWalletConnector`: Removed the exposed fields `activeConnection`, `activeConnectedAccount`, `activeConnectionGenesisHash`,
    and `setActiveConnection` (use the new hook `useConnection` instead).
    This gives applications much tighter control on how connections are managed, including the ability to have multiple active connections.
-   `WithWalletConnector`: The field `connectedAccounts` now maps connections to the empty string if they don't have an associated account.
    This means that the key set of this field matches the set of live connections exactly.

## [0.1.0] - 2023-01-17

### Added

-   Initial implementation.

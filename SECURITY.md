# Security Guide

## Fine-grained token

Create a fine-grained personal access token with:

- Resource owner: your GitHub username
- Repository access: only `cardtrack`
- Repository permissions: Contents - Read and write
- Expiration: 30 to 90 days recommended

Do not grant Administration, Secrets, Actions, Workflows, or all-repository access.

## Browser handling

CardTrack does not persist the token. The token field is cleared after repository testing or publishing. Do not modify the application to store the token in localStorage, sessionStorage, cookies, or the repository.

## Device guidance

A token can technically be used on multiple devices, but separate device-specific tokens are safer. If one device is lost, revoke only that device's token.

## Revocation

GitHub profile -> Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens -> select token -> Delete.

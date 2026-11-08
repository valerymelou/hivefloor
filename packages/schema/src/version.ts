/**
 * Version of the Hivefloor data contracts.
 *
 * Every message, event and config file carries this number in its `v` field.
 * Within v1 only additive, optional changes are allowed; a breaking change
 * means a new version (see docs/PRD.md, "Data contracts").
 */
export const CONTRACT_VERSION = 1;

/** The literal type of {@link CONTRACT_VERSION}. */
export type ContractVersion = typeof CONTRACT_VERSION;

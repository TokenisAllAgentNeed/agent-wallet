# agent-wallet

> Multi-chain wallet library for AI agents. Send stablecoins, pay Lightning invoices, manage keys.

agent-wallet gives AI agents programmatic access to on-chain assets across multiple blockchains. BIP-44 HD key derivation, stablecoin transfers, Lightning integration, and dry-run safety checks.

Built by an autonomous AI agent.

## Install

```bash
npm install @token2chat/agent-wallet
```

## Quick Start

```typescript
import { AgentWallet } from '@token2chat/agent-wallet';

// Create from seed (BIP-44 HD derivation)
const wallet = AgentWallet.fromSeed(seedBytes, {
  lightning: {
    nodeUrl: 'http://localhost:9740',
    nodePassword: 'your-password',
    nodeType: 'phoenixd',
  },
});

// Check balances across all chains
const balances = await wallet.getBalances();
console.log(balances);
// { base: { USDC: "142.50", ETH: "0.003" }, lightning: { SAT: "50000" }, ... }

// Send USDC (dry-run first)
const check = await wallet.checkSend({
  chain: 'base',
  token: 'USDC',
  to: '0x...',
  amount: '10.00',
});
console.log(check); // { ok: true, estimatedGas: "0.0001 ETH" }

// Execute
const txHash = await wallet.send({
  chain: 'base',
  token: 'USDC',
  to: '0x...',
  amount: '10.00',
});
```

## API Reference

### AgentWallet

```typescript
// Construction
AgentWallet.fromSeed(seed: Uint8Array, options?: WalletOptions): AgentWallet
AgentWallet.fromPrivateKey(key: string, options?: WalletOptions): AgentWallet

// Read
wallet.getBalances(): Promise<ChainBalances>
wallet.getBalance(chain: string, token?: string): Promise<string>
wallet.getAddress(chain: string): string

// Write
wallet.checkSend(params: SendParams): Promise<CheckResult>
wallet.send(params: SendParams): Promise<string>  // returns tx hash

// Lightning (via wallet.lightning)
wallet.lightning.getBalance(): Promise<{ balanceSat: number }>
wallet.lightning.createInvoice(amount: number, memo?: string): Promise<Invoice>
wallet.lightning.payInvoice(bolt11: string): Promise<PayResult>
wallet.lightning.checkPayment(hash: string): Promise<PaymentStatus>
```

### SendParams

```typescript
interface SendParams {
  chain: string;     // 'base' | 'ethereum' | 'arbitrum' | 'bnb' | 'tron'
  token: string;     // 'USDC' | 'USDT'
  to: string;        // recipient address
  amount: string;    // human-readable amount, e.g. '10.00'
}
```

## Supported Chains

| Chain | Tokens | Native Gas | Address Format |
|-------|--------|------------|----------------|
| **Base** | USDC, USDT | ETH | 0x (EVM) |
| **Ethereum** | USDC, USDT | ETH | 0x (EVM) |
| **Arbitrum** | USDC, USDT | ETH | 0x (EVM) |
| **BNB Chain** | USDC, USDT | BNB | 0x (EVM) |
| **Tron** | USDT | TRX | T... (Base58) |
| **Lightning** | SAT | — | bolt11 invoices |

### Token Addresses

All contract addresses are hardcoded per chain (mainnet). See `src/chains/configs/` for the full list.

| Chain | USDC | USDT |
|-------|------|------|
| Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` |
| Ethereum | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| Arbitrum | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` |
| BNB Chain | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` | `0x55d398326f99059fF775485246999027B3197955` |

## Key Derivation

BIP-44 path: `m/44'/60'/0'/0/0` for EVM chains, with chain-specific derivation for Tron.

```typescript
// Same seed → same addresses on all chains
const wallet = AgentWallet.fromSeed(seed);
wallet.getAddress('base');      // 0x...
wallet.getAddress('ethereum');  // same 0x... (shared EVM key)
wallet.getAddress('tron');      // T... (different derivation)
```

## Safety Features

- **Dry-run check** — `checkSend()` verifies balance, gas, and address validity before sending
- **Address validation** — EVM checksum + Tron base58 validation
- **Amount parsing** — handles decimal precision per token (6 decimals for USDC, 18 for BNB Chain)
- **Error categorization** — distinguishes insufficient balance, insufficient gas, invalid address, network errors

## Integration with token2chat

agent-wallet is designed to work with the token2chat ecosystem:

```typescript
// Agent auto-funds its ecash wallet
const wallet = AgentWallet.fromSeed(seed);

// 1. Check if ecash wallet needs funding
const balance = await checkEcashBalance();
if (balance < threshold) {
  // 2. Send USDC to the mint's deposit address
  await wallet.send({
    chain: 'base',
    token: 'USDC',
    to: MINT_DEPOSIT_ADDRESS,
    amount: '5.00',
  });
  // 3. Mint verifies deposit → issues ecash
  // 4. Agent uses ecash to pay for LLM calls via t2c
}
```

## Testing

```bash
npm test              # 138 tests
npm run test:coverage # with coverage report
```

## License

MIT

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentWallet } from './wallet.js';

// Mock global fetch for Lightning tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock viem
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: vi.fn(),
      getBalance: vi.fn(),
      estimateContractGas: vi.fn(),
      getGasPrice: vi.fn(),
    })),
    createWalletClient: vi.fn(() => ({
      writeContract: vi.fn(),
    })),
  };
});

vi.mock('viem/accounts', async () => {
  const actual = await vi.importActual('viem/accounts');
  return {
    ...actual,
    privateKeyToAccount: vi.fn((key: string) => ({
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f1Eb3B',
    })),
  };
});

describe('AgentWallet', () => {
  describe('creation', () => {
    it('creates wallet from seed', () => {
      const seed = new Uint8Array(32).fill(1);
      const wallet = AgentWallet.fromSeed(seed);
      
      expect(wallet.address).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f1Eb3B');
    });

    it('creates wallet from private key', () => {
      const privateKey = '0x' + '1'.repeat(64);
      const wallet = AgentWallet.fromPrivateKey(privateKey);
      
      expect(wallet.address).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f1Eb3B');
    });

    it('creates wallet from private key without 0x prefix', () => {
      const privateKey = '1'.repeat(64);
      const wallet = AgentWallet.fromPrivateKey(privateKey);
      
      expect(wallet.address).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f1Eb3B');
    });
  });

  describe('export', () => {
    it('exports wallet data', () => {
      const privateKey = '0x' + '1'.repeat(64);
      const wallet = AgentWallet.fromPrivateKey(privateKey);
      const data = wallet.export();
      
      expect(data.privateKey).toBe(privateKey);
      expect(data.address).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f1Eb3B');
    });
  });
});

describe('AgentWallet with mocked RPC', () => {
  let wallet: AgentWallet;
  let mockReadContract: ReturnType<typeof vi.fn>;
  let mockGetBalance: ReturnType<typeof vi.fn>;
  let mockWriteContract: ReturnType<typeof vi.fn>;
  let mockEstimateGas: ReturnType<typeof vi.fn>;
  let mockGetGasPrice: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    
    mockReadContract = vi.fn();
    mockGetBalance = vi.fn();
    mockWriteContract = vi.fn();
    mockEstimateGas = vi.fn();
    mockGetGasPrice = vi.fn();

    vi.doMock('viem', async () => {
      const actual = await vi.importActual('viem');
      return {
        ...actual,
        createPublicClient: vi.fn(() => ({
          readContract: mockReadContract,
          getBalance: mockGetBalance,
          estimateContractGas: mockEstimateGas,
          getGasPrice: mockGetGasPrice,
        })),
        createWalletClient: vi.fn(() => ({
          writeContract: mockWriteContract,
        })),
      };
    });

    const { AgentWallet: FreshWallet } = await import('./wallet.js');
    const privateKey = '0x' + '1'.repeat(64);
    wallet = FreshWallet.fromPrivateKey(privateKey);
  });

  describe('getBalance', () => {
    it('returns formatted balance with humanReadable', async () => {
      mockReadContract.mockResolvedValue(100_000_000n); // 100 USDC

      const result = await wallet.getBalance('base', 'USDC');
      
      expect(result.balance).toBe('100.00');
      expect(result.humanReadable).toContain('100.00 USDC');
      expect(result.humanReadable).toContain('Base');
    });
  });

  describe('checkSend', () => {
    it('returns canSend: true when sufficient balance and gas', async () => {
      mockReadContract.mockResolvedValue(100_000_000n); // 100 USDC
      mockGetBalance.mockResolvedValue(1_000_000_000_000_000_000n); // 1 ETH
      mockEstimateGas.mockResolvedValue(65000n);
      mockGetGasPrice.mockResolvedValue(20_000_000_000n);

      const result = await wallet.checkSend({
        chain: 'base',
        token: 'USDC',
        to: '0x1234567890123456789012345678901234567890',
        amount: '10.00',
      });

      expect(result.canSend).toBe(true);
      expect(result.humanReadable).toContain('OK to send');
    });

    it('returns canSend: false with reason insufficient_balance', async () => {
      mockReadContract.mockResolvedValue(5_000_000n); // 5 USDC
      mockGetBalance.mockResolvedValue(1_000_000_000_000_000_000n); // 1 ETH
      mockEstimateGas.mockResolvedValue(65000n);
      mockGetGasPrice.mockResolvedValue(20_000_000_000n);

      const result = await wallet.checkSend({
        chain: 'base',
        token: 'USDC',
        to: '0x1234567890123456789012345678901234567890',
        amount: '10.00',
      });

      expect(result.canSend).toBe(false);
      expect(result.reason).toBe('insufficient_balance');
      expect(result.humanReadable).toContain('Cannot send');
      expect(result.humanReadable).toContain('5.00');
    });

    it('returns canSend: false with reason insufficient_gas', async () => {
      mockReadContract.mockResolvedValue(100_000_000n); // 100 USDC
      mockGetBalance.mockResolvedValue(1000n); // Almost no ETH
      mockEstimateGas.mockResolvedValue(65000n);
      mockGetGasPrice.mockResolvedValue(20_000_000_000n);

      const result = await wallet.checkSend({
        chain: 'base',
        token: 'USDC',
        to: '0x1234567890123456789012345678901234567890',
        amount: '10.00',
      });

      expect(result.canSend).toBe(false);
      expect(result.reason).toBe('insufficient_gas');
      expect(result.humanReadable).toContain('Cannot send');
      expect(result.humanReadable).toContain('gas');
    });
  });

  describe('send', () => {
    it('returns success with txHash', async () => {
      const txHash = '0xabc123';
      mockWriteContract.mockResolvedValue(txHash);

      const result = await wallet.send({
        chain: 'base',
        token: 'USDC',
        to: '0x1234567890123456789012345678901234567890',
        amount: '10.00',
      });

      expect(result.success).toBe(true);
      expect(result.txHash).toBe(txHash);
      expect(result.humanReadable).toContain('Sent 10.00 USDC');
      expect(result.humanReadable).toContain(txHash);
    });

    it('returns failure with error message', async () => {
      mockWriteContract.mockRejectedValue(new Error('insufficient funds'));

      const result = await wallet.send({
        chain: 'base',
        token: 'USDC',
        to: '0x1234567890123456789012345678901234567890',
        amount: '10.00',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('insufficient funds');
      expect(result.humanReadable).toContain('Failed to send');
    });
  });
});

describe('Address validation', () => {
  let wallet: AgentWallet;
  let mockReadContract: ReturnType<typeof vi.fn>;
  let mockGetBalance: ReturnType<typeof vi.fn>;
  let mockWriteContract: ReturnType<typeof vi.fn>;
  let mockEstimateGas: ReturnType<typeof vi.fn>;
  let mockGetGasPrice: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    mockReadContract = vi.fn();
    mockGetBalance = vi.fn();
    mockWriteContract = vi.fn();
    mockEstimateGas = vi.fn();
    mockGetGasPrice = vi.fn();

    vi.doMock('viem', async () => {
      const actual = await vi.importActual('viem');
      return {
        ...actual,
        createPublicClient: vi.fn(() => ({
          readContract: mockReadContract,
          getBalance: mockGetBalance,
          estimateContractGas: mockEstimateGas,
          getGasPrice: mockGetGasPrice,
        })),
        createWalletClient: vi.fn(() => ({
          writeContract: mockWriteContract,
        })),
      };
    });

    const { AgentWallet: FreshWallet } = await import('./wallet.js');
    const privateKey = '0x' + '1'.repeat(64);
    wallet = FreshWallet.fromPrivateKey(privateKey);
  });

  describe('checkSend with invalid address', () => {
    it('returns canSend: false with reason invalid_address for empty address', async () => {
      const result = await wallet.checkSend({
        chain: 'base',
        token: 'USDC',
        to: '',
        amount: '10.00',
      });

      expect(result.canSend).toBe(false);
      expect(result.reason).toBe('invalid_address');
      expect(result.humanReadable).toContain('Invalid address');
    });

    it('returns canSend: false for EVM address without 0x prefix', async () => {
      const result = await wallet.checkSend({
        chain: 'base',
        token: 'USDC',
        to: '1234567890123456789012345678901234567890',
        amount: '10.00',
      });

      expect(result.canSend).toBe(false);
      expect(result.reason).toBe('invalid_address');
    });

    it('returns canSend: false for EVM address with wrong length', async () => {
      const result = await wallet.checkSend({
        chain: 'base',
        token: 'USDC',
        to: '0x1234',
        amount: '10.00',
      });

      expect(result.canSend).toBe(false);
      expect(result.reason).toBe('invalid_address');
    });

    it('returns canSend: false for EVM address with non-hex characters', async () => {
      const result = await wallet.checkSend({
        chain: 'base',
        token: 'USDC',
        to: '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
        amount: '10.00',
      });

      expect(result.canSend).toBe(false);
      expect(result.reason).toBe('invalid_address');
    });

    it('returns canSend: false for Tron address not starting with T', async () => {
      const result = await wallet.checkSend({
        chain: 'tron',
        token: 'USDT',
        to: 'X1234567890123456789012345678901234',
        amount: '10.00',
      });

      expect(result.canSend).toBe(false);
      expect(result.reason).toBe('invalid_address');
    });

    it('returns canSend: false for Tron address with invalid Base58 chars', async () => {
      const result = await wallet.checkSend({
        chain: 'tron',
        token: 'USDT',
        to: 'T0OIl1234567890123456789012345678', // contains 0, O, I, l which are invalid
        amount: '10.00',
      });

      expect(result.canSend).toBe(false);
      expect(result.reason).toBe('invalid_address');
    });
  });

  describe('send with invalid address', () => {
    it('returns success: false with error invalid_address for empty address', async () => {
      const result = await wallet.send({
        chain: 'base',
        token: 'USDC',
        to: '',
        amount: '10.00',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_address');
      expect(result.humanReadable).toContain('Invalid address');
    });

    it('returns success: false for invalid EVM address', async () => {
      const result = await wallet.send({
        chain: 'base',
        token: 'USDC',
        to: '0x1234',
        amount: '10.00',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_address');
    });

    it('returns success: false for invalid Tron address', async () => {
      const result = await wallet.send({
        chain: 'tron',
        token: 'USDT',
        to: 'invalidaddress',
        amount: '10.00',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_address');
    });
  });
});

describe('AgentWallet with Lightning', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  describe('lightning configuration', () => {
    it('creates wallet without Lightning by default', () => {
      const privateKey = '0x' + '1'.repeat(64);
      const wallet = AgentWallet.fromPrivateKey(privateKey);
      
      expect(wallet.hasLightning).toBe(false);
    });

    it('creates wallet with Lightning when configured', () => {
      const privateKey = '0x' + '1'.repeat(64);
      const wallet = AgentWallet.fromPrivateKey(privateKey, {
        lightning: {
          nodeUrl: 'http://localhost:9740',
          nodePassword: 'test',
          nodeType: 'phoenixd',
        },
      });
      
      expect(wallet.hasLightning).toBe(true);
    });

    it('throws when accessing lightning without configuration', () => {
      const privateKey = '0x' + '1'.repeat(64);
      const wallet = AgentWallet.fromPrivateKey(privateKey);
      
      expect(() => wallet.lightning).toThrow('Lightning not configured');
    });

    it('allows access to lightning wallet when configured', () => {
      const privateKey = '0x' + '1'.repeat(64);
      const wallet = AgentWallet.fromPrivateKey(privateKey, {
        lightning: {
          nodeUrl: 'http://localhost:9740',
          nodePassword: 'test',
          nodeType: 'phoenixd',
        },
      });
      
      expect(wallet.lightning).toBeDefined();
      expect(wallet.lightning.getBalance).toBeDefined();
      expect(wallet.lightning.createInvoice).toBeDefined();
      expect(wallet.lightning.payInvoice).toBeDefined();
      expect(wallet.lightning.checkInvoice).toBeDefined();
    });
  });

  describe('lightning operations', () => {
    it('getBalance returns Lightning balance from node', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ balanceSat: 50000, feeCreditSat: 100 }),
      });

      const privateKey = '0x' + '1'.repeat(64);
      const wallet = AgentWallet.fromPrivateKey(privateKey, {
        lightning: {
          nodeUrl: 'http://localhost:9740',
          nodePassword: 'test',
          nodeType: 'phoenixd',
        },
      });

      const balance = await wallet.lightning.getBalance();
      expect(balance).toBe(50000n);
    });

    it('createInvoice creates a Lightning invoice', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          amountSat: 1000,
          paymentHash: 'testhash123',
          serialized: 'lnbc10n1ptest...',
        }),
      });

      const privateKey = '0x' + '1'.repeat(64);
      const wallet = AgentWallet.fromPrivateKey(privateKey, {
        lightning: {
          nodeUrl: 'http://localhost:9740',
          nodePassword: 'test',
          nodeType: 'phoenixd',
        },
      });

      const invoice = await wallet.lightning.createInvoice({
        amountSats: 1000,
        memo: 'Test payment',
      });

      expect(invoice.invoice).toBe('lnbc10n1ptest...');
      expect(invoice.paymentHash).toBe('testhash123');
    });

    it('payInvoice pays a Lightning invoice', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          recipientAmountSat: 1000,
          routingFeeSat: 5,
          paymentId: 'pay123',
          paymentHash: 'hash123',
          paymentPreimage: 'preimage123',
        }),
      });

      const privateKey = '0x' + '1'.repeat(64);
      const wallet = AgentWallet.fromPrivateKey(privateKey, {
        lightning: {
          nodeUrl: 'http://localhost:9740',
          nodePassword: 'test',
          nodeType: 'phoenixd',
        },
      });

      const result = await wallet.lightning.payInvoice('lnbc10n1p...');

      expect(result.success).toBe(true);
      expect(result.preimage).toBe('preimage123');
      expect(result.feeSats).toBe(5);
    });

    it('checkInvoice checks invoice status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          paymentHash: 'hash456',
          isPaid: true,
          receivedSat: 2000,
          requestedSat: 2000,
        }),
      });

      const privateKey = '0x' + '1'.repeat(64);
      const wallet = AgentWallet.fromPrivateKey(privateKey, {
        lightning: {
          nodeUrl: 'http://localhost:9740',
          nodePassword: 'test',
          nodeType: 'phoenixd',
        },
      });

      const status = await wallet.lightning.checkInvoice('hash456');

      expect(status.paid).toBe(true);
      expect(status.amountSats).toBe(2000);
    });
  });
});

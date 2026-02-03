import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLightningWallet, PhoenixdClient, type LightningConfig } from './lightning.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('PhoenixdClient', () => {
  let client: PhoenixdClient;
  const config = {
    url: 'http://localhost:9740',
    password: 'test-password',
  };

  beforeEach(() => {
    client = new PhoenixdClient(config);
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('strips trailing slash from URL', () => {
      const c = new PhoenixdClient({ url: 'http://localhost:9740/', password: 'p' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ balanceSat: 0, feeCreditSat: 0 }),
      });
      // getBalance will call fetch — verify the URL has no trailing slash
      c.getBalance();
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:9740/getbalance',
        expect.anything()
      );
    });
  });

  describe('getBalance', () => {
    it('returns balance in satoshis', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ balanceSat: 50000, feeCreditSat: 1000 }),
      });

      const balance = await client.getBalance();

      expect(balance).toBe(50000n);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:9740/getbalance',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal server error'),
      });

      await expect(client.getBalance()).rejects.toThrow('Lightning node error: GET /getbalance returned 500');
    });
  });

  describe('createInvoice', () => {
    it('creates invoice with amount and memo', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          amountSat: 1000,
          paymentHash: 'abc123hash',
          serialized: 'lnbc10n1ptest...',
        }),
      });

      const result = await client.createInvoice({
        amountSats: 1000,
        memo: 'Test payment',
      });

      expect(result.invoice).toBe('lnbc10n1ptest...');
      expect(result.paymentHash).toBe('abc123hash');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:9740/createinvoice',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: expect.stringContaining('amountSat=1000'),
        })
      );
    });

    it('creates invoice with expiry', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          amountSat: 1000,
          paymentHash: 'exphash',
          serialized: 'lnbc10n1pexp...',
        }),
      });

      await client.createInvoice({ amountSats: 1000, expirySecs: 3600 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          body: expect.stringContaining('expireInSeconds=3600'),
        })
      );
    });

    it('creates invoice with default memo', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          amountSat: 500,
          paymentHash: 'hash456',
          serialized: 'lnbc5n1ptest...',
        }),
      });

      const result = await client.createInvoice({ amountSats: 500 });

      expect(result.invoice).toBe('lnbc5n1ptest...');
      expect(result.paymentHash).toBe('hash456');
    });
  });

  describe('payInvoice', () => {
    it('pays invoice and returns result', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          recipientAmountSat: 1000,
          routingFeeSat: 5,
          paymentId: 'pay123',
          paymentHash: 'hash789',
          paymentPreimage: 'preimage123',
        }),
      });

      const result = await client.payInvoice('lnbc10n1pinvoice...');

      expect(result.success).toBe(true);
      expect(result.preimage).toBe('preimage123');
      expect(result.feeSats).toBe(5);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:9740/payinvoice',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('invoice=lnbc10n1pinvoice'),
        })
      );
    });

    it('handles payment failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Payment failed: no route'),
      });

      const result = await client.payInvoice('lnbc10n1pbad...');

      expect(result.success).toBe(false);
      expect(result.preimage).toBeUndefined();
    });

    it('returns error message when payment fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Payment failed: no route found'),
      });

      const result = await client.payInvoice('lnbc10n1pfail...');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Lightning node error: POST /payinvoice returned 400');
    });

    it('returns error message for network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await client.payInvoice('lnbc10n1pnetwork...');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('checkInvoice', () => {
    it('returns paid status for completed payment', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          paymentHash: 'hash123',
          isPaid: true,
          receivedSat: 1000,
          requestedSat: 1000,
        }),
      });

      const result = await client.checkInvoice('hash123');

      expect(result.paid).toBe(true);
      expect(result.amountSats).toBe(1000);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:9740/payments/incoming/hash123',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('throws for unknown payment hash', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });

      await expect(client.checkInvoice('badhash')).rejects.toThrow(
        'Lightning node error: GET /payments/incoming/badhash returned 404'
      );
    });

    it('returns unpaid status for pending payment', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          paymentHash: 'hash456',
          isPaid: false,
          receivedSat: 0,
          requestedSat: 500,
        }),
      });

      const result = await client.checkInvoice('hash456');

      expect(result.paid).toBe(false);
      expect(result.amountSats).toBe(500);
    });
  });

  describe('getInfo', () => {
    it('returns node info', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          nodeId: 'node123abc',
          channels: [],
          chain: 'mainnet',
          blockHeight: 800000,
          version: '0.1.0',
        }),
      });

      const info = await client.getInfo();

      expect(info.nodeId).toBe('node123abc');
      expect(info.chain).toBe('mainnet');
    });
  });
});

describe('createLightningWallet', () => {
  const config: LightningConfig = {
    id: 'lightning',
    family: 'lightning',
    name: 'Lightning Network',
    nativeToken: 'SAT',
    nodeUrl: 'http://localhost:9740',
    nodePassword: 'test-password',
    nodeType: 'phoenixd',
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('creates a lightning wallet from config', () => {
    const wallet = createLightningWallet(config);

    expect(wallet).toBeDefined();
    expect(wallet.getBalance).toBeDefined();
    expect(wallet.createInvoice).toBeDefined();
    expect(wallet.payInvoice).toBeDefined();
    expect(wallet.checkInvoice).toBeDefined();
  });

  it('getBalance returns node balance', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ balanceSat: 100000, feeCreditSat: 500 }),
    });

    const wallet = createLightningWallet(config);
    const balance = await wallet.getBalance();

    expect(balance).toBe(100000n);
  });

  it('createInvoice delegates to client', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        amountSat: 2000,
        paymentHash: 'testhash',
        serialized: 'lnbc20n1p...',
      }),
    });

    const wallet = createLightningWallet(config);
    const result = await wallet.createInvoice({
      amountSats: 2000,
      memo: 'Test invoice',
    });

    expect(result.invoice).toBe('lnbc20n1p...');
    expect(result.paymentHash).toBe('testhash');
  });

  it('payInvoice delegates to client', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        recipientAmountSat: 1500,
        routingFeeSat: 3,
        paymentId: 'payid',
        paymentHash: 'payhash',
        paymentPreimage: 'secret',
      }),
    });

    const wallet = createLightningWallet(config);
    const result = await wallet.payInvoice('lnbc15n1p...');

    expect(result.success).toBe(true);
    expect(result.preimage).toBe('secret');
    expect(result.feeSats).toBe(3);
  });

  it('checkInvoice delegates to client', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        paymentHash: 'checkhash',
        isPaid: true,
        receivedSat: 3000,
        requestedSat: 3000,
      }),
    });

    const wallet = createLightningWallet(config);
    const result = await wallet.checkInvoice('checkhash');

    expect(result.paid).toBe(true);
    expect(result.amountSats).toBe(3000);
  });

  it('throws for unsupported node types', () => {
    const badConfig = { ...config, nodeType: 'lnd' as const };

    expect(() => createLightningWallet(badConfig as LightningConfig)).toThrow('Only phoenixd is supported');
  });

  describe('validateConnection', () => {
    it('returns true when node is reachable', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          nodeId: 'node123',
          channels: [],
          chain: 'mainnet',
          blockHeight: 800000,
          version: '0.1.0',
        }),
      });

      const wallet = createLightningWallet(config);
      const connected = await wallet.validateConnection();

      expect(connected).toBe(true);
    });

    it('returns false when node is unreachable', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const wallet = createLightningWallet(config);
      const connected = await wallet.validateConnection();

      expect(connected).toBe(false);
    });

    it('returns false when node returns error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      const wallet = createLightningWallet(config);
      const connected = await wallet.validateConnection();

      expect(connected).toBe(false);
    });
  });
});

/**
 * Lightning Network adapter for agent-wallet.
 * 
 * Lightning is different from on-chain wallets:
 * - No address derivation (invoices are one-time)
 * - Requires connection to a Lightning node
 * - V1 supports Phoenixd only
 */

/** Lightning chain configuration */
export interface LightningConfig {
  id: 'lightning';
  family: 'lightning';
  name: 'Lightning Network';
  nativeToken: 'SAT';
  /** Node API URL */
  nodeUrl: string;
  /** Node API password */
  nodePassword?: string;
  /** Node type (V1 only supports phoenixd) */
  nodeType: 'phoenixd' | 'lnd' | 'cln';
}

/** Lightning wallet interface */
export interface LightningWallet {
  /** Get node balance in satoshis */
  getBalance(): Promise<bigint>;

  /** Create a Lightning invoice (receive payment) */
  createInvoice(params: {
    amountSats: number;
    memo?: string;
    expirySecs?: number;
  }): Promise<{
    invoice: string;
    paymentHash: string;
  }>;

  /** Pay a Lightning invoice */
  payInvoice(invoice: string): Promise<{
    success: boolean;
    preimage?: string;
    feeSats?: number;
    error?: string;
  }>;

  /** Check invoice payment status */
  checkInvoice(paymentHash: string): Promise<{
    paid: boolean;
    amountSats?: number;
  }>;

  /** Validate that the Lightning node is reachable and responding */
  validateConnection(): Promise<boolean>;
}

/** Phoenixd API configuration */
export interface PhoenixdConfig {
  url: string;
  password: string;
}

/** Phoenixd create invoice response */
interface PhoenixdCreateInvoiceResult {
  amountSat: number;
  paymentHash: string;
  serialized: string;
}

/** Phoenixd incoming payment response */
interface PhoenixdIncomingPayment {
  paymentHash: string;
  isPaid: boolean;
  receivedSat: number;
  requestedSat: number;
}

/** Phoenixd pay invoice response */
interface PhoenixdPayInvoiceResult {
  recipientAmountSat: number;
  routingFeeSat: number;
  paymentId: string;
  paymentHash: string;
  paymentPreimage: string;
}

/** Phoenixd node info */
interface PhoenixdNodeInfo {
  nodeId: string;
  channels: unknown[];
  chain: string;
  blockHeight: number;
  version: string;
}

/**
 * Phoenixd Lightning node client.
 * API docs: https://phoenix.acinq.co/server/api
 */
export class PhoenixdClient {
  private url: string;
  private authHeader: string;

  constructor(config: PhoenixdConfig) {
    this.url = config.url.replace(/\/$/, '');
    // Phoenixd uses Basic auth with empty username
    this.authHeader = 'Basic ' + Buffer.from(':' + config.password).toString('base64');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, string>
  ): Promise<T> {
    const opts: RequestInit = {
      method,
      headers: {
        Authorization: this.authHeader,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
    };
    if (body) {
      opts.body = new URLSearchParams(body).toString();
    }
    const res = await fetch(`${this.url}${path}`, opts);
    if (!res.ok) {
      const text = await res.text();
      // Log full error for debugging
      console.error(`Phoenixd error: ${method} ${path} → ${res.status}: ${text}`);
      // Throw sanitized message (no response body leaked)
      throw new Error(`Lightning node error: ${method} ${path} returned ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  /** Get node balance in satoshis */
  async getBalance(): Promise<bigint> {
    const result = await this.request<{ balanceSat: number; feeCreditSat: number }>(
      'GET',
      '/getbalance'
    );
    return BigInt(result.balanceSat);
  }

  /** Create a Lightning invoice */
  async createInvoice(params: {
    amountSats: number;
    memo?: string;
    expirySecs?: number;
  }): Promise<{ invoice: string; paymentHash: string }> {
    const body: Record<string, string> = {
      amountSat: String(params.amountSats),
      description: params.memo ?? 'agent-wallet payment',
    };
    if (params.expirySecs !== undefined) {
      body.expireInSeconds = String(params.expirySecs);
    }

    const result = await this.request<PhoenixdCreateInvoiceResult>(
      'POST',
      '/createinvoice',
      body
    );

    return {
      invoice: result.serialized,
      paymentHash: result.paymentHash,
    };
  }

  /** Pay a Lightning invoice */
  async payInvoice(invoice: string): Promise<{
    success: boolean;
    preimage?: string;
    feeSats?: number;
    error?: string;
  }> {
    try {
      const result = await this.request<PhoenixdPayInvoiceResult>(
        'POST',
        '/payinvoice',
        { invoice }
      );
      return {
        success: true,
        preimage: result.paymentPreimage,
        feeSats: result.routingFeeSat,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Check if an invoice has been paid */
  async checkInvoice(paymentHash: string): Promise<{
    paid: boolean;
    amountSats?: number;
  }> {
    const result = await this.request<PhoenixdIncomingPayment>(
      'GET',
      `/payments/incoming/${paymentHash}`
    );
    return {
      paid: result.isPaid,
      amountSats: result.isPaid ? result.receivedSat : result.requestedSat,
    };
  }

  /** Get node info */
  async getInfo(): Promise<PhoenixdNodeInfo> {
    return this.request<PhoenixdNodeInfo>('GET', '/getinfo');
  }
}

/**
 * Create a Lightning wallet from configuration.
 * V1 only supports Phoenixd nodes.
 */
export function createLightningWallet(config: LightningConfig): LightningWallet {
  if (config.nodeType !== 'phoenixd') {
    throw new Error('Only phoenixd is supported in V1. LND and CLN support coming later.');
  }

  const client = new PhoenixdClient({
    url: config.nodeUrl,
    password: config.nodePassword ?? '',
  });

  return {
    getBalance: () => client.getBalance(),
    createInvoice: (params) => client.createInvoice(params),
    payInvoice: (invoice) => client.payInvoice(invoice),
    checkInvoice: (paymentHash) => client.checkInvoice(paymentHash),
    validateConnection: async () => {
      try {
        await client.getInfo();
        return true;
      } catch {
        return false;
      }
    },
  };
}

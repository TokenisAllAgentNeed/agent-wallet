# agent-wallet Code Review

**审查日期**: 2026-02-03  
**审查版本**: 0.1.0  
**测试状态**: 65 tests passing ✅

---

## ✅ 做得好的地方

### 1. TypeScript 类型质量 - 优秀
- **零 `any` 类型** - 源代码中没有使用 `any`，类型严谨
- 类型定义清晰，`types.ts` 和 `chains/types.ts` 结构分离合理
- 泛型使用恰当，如 `request<T>()` 方法
- 正确使用 `0x${string}` 模板字面量类型约束私钥格式

### 2. API 设计完全符合 RFC
- `fromSeed()` / `fromPrivateKey()` ✅
- `getBalances()` 聚合余额 ✅
- `getBalance(chain, token)` 单链余额 ✅
- `checkSend()` dry run ✅
- `send()` 显式发送 ✅
- `export()` 持久化导出 ✅
- 所有响应都包含 `humanReadable` 字段 ✅

### 3. 架构设计清晰
- **适配器模式** - `ChainAdapter` 接口设计优雅，易于扩展新链
- **关注点分离** - chains/configs/utils 职责清晰
- **缓存机制** - `walletCache` 避免重复创建钱包实例

### 4. 测试覆盖全面
- 65 个测试覆盖核心功能
- 正确使用 mock 隔离外部依赖（viem, TronWeb, fetch）
- 测试场景包括：创建、余额查询、发送、gas 估算、错误情况

### 5. RFC 功能完整度
| RFC 要求 | 实现状态 |
|---------|---------|
| Base, Ethereum, Arbitrum, BNB | ✅ |
| Tron | ✅ |
| USDC, USDT | ✅ |
| Dry run (checkSend) | ✅ |
| 显式广播 | ✅ |
| 人类可读输出 | ✅ |
| **额外实现: Lightning** | ✅ (超出 RFC) |

### 6. 代码风格一致
- 统一使用 ES modules (`import/export`)
- 一致的命名约定（camelCase 变量，PascalCase 类型）
- 注释简洁有效

---

## ⚠️ 建议改进的地方（按优先级排序）

### P1: 地址验证缺失
**位置**: `wallet.ts` - `checkSend()` 和 `send()`

**问题**: 发送前没有验证目标地址格式，可能导致资金发送到无效地址。

**建议**:
```typescript
// checkSend 和 send 应该先验证地址
import { isAddress } from 'viem';

if (!isAddress(to)) {
  return {
    canSend: false,
    reason: 'invalid_address',
    humanReadable: `Invalid address: ${to}`,
    // ...
  };
}
```

RFC 中 `CheckResult.reason` 已经定义了 `'invalid_address'`，但代码中未使用。

---

### P2: Lightning 错误信息不够详细
**位置**: `chains/lightning.ts` - `payInvoice()`

**问题**: 支付失败时只返回 `{ success: false }`，丢失了错误原因。

**当前代码**:
```typescript
async payInvoice(invoice: string) {
  try {
    // ...
  } catch {
    return { success: false };  // 错误原因被丢弃
  }
}
```

**建议**:
```typescript
async payInvoice(invoice: string) {
  try {
    // ...
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
```

---

### P3: 测试中存在类型断言
**位置**: `src/chains/index.test.ts`

**问题**: 测试代码使用 `as any` 访问 `chainId`：
```typescript
expect((adapter.config as any).chainId).toBe(8453);
```

**建议**: 使用类型守卫或扩展接口：
```typescript
import type { EvmChainConfig } from './types.js';

if ('chainId' in adapter.config) {
  expect((adapter.config as EvmChainConfig).chainId).toBe(8453);
}
```

---

### P4: 缺少重要的边缘情况测试
1. **负数金额** - `toBaseUnits('-10', 6)` 会怎样？
2. **超大金额** - 接近 bigint 最大值
3. **空字符串地址** - `send({ to: '', ... })`
4. **网络错误重试** - RPC 调用失败时的行为
5. **并发操作** - 同时发起多个 send 请求

---

### P5: 私钥在内存中的保护
**位置**: `wallet.ts`

**问题**: 私钥以明文存储在类属性中。

**当前**:
```typescript
private readonly privateKey: `0x${string}`;
```

**建议** (长期改进):
- 考虑使用 `Object.freeze()` 防止意外修改
- 文档说明私钥生命周期管理责任由调用方承担
- 可选：添加 `destroy()` 方法清除内存中的敏感数据

---

### P6: formatNativeBalance 输出不一致
**位置**: `utils/format.ts`

**问题**: 小数位数格式不统一：
```typescript
formatNativeBalance(1_000_000_000_000_000_000n, 'ETH')  // "1.0 ETH"
formatNativeBalance(100_000_000_000_000n, 'ETH')        // "0.0001 ETH"
```

**建议**: 统一保留固定小数位或使用智能格式化。

---

### P7: 缺少 JSDoc 文档
部分公共 API 缺少完整的 JSDoc 注释，影响 IDE 提示和生成文档。

**建议**: 为所有导出的函数和类添加 JSDoc：
```typescript
/**
 * Create a wallet from a BIP-39 seed.
 * @param seed - 32-byte seed from mnemonic
 * @param options - Optional Lightning configuration
 * @returns AgentWallet instance
 * @example
 * const seed = mnemonicToSeed('word word ...');
 * const wallet = AgentWallet.fromSeed(seed);
 */
static fromSeed(seed: Uint8Array, options?: AgentWalletOptions): AgentWallet
```

---

### P8: 环境变量/配置注入
**问题**: RPC URL 硬编码在配置文件中，无法在运行时覆盖。

**建议**: 支持通过环境变量或构造函数参数覆盖 RPC：
```typescript
const wallet = AgentWallet.fromSeed(seed, {
  rpcOverrides: {
    base: process.env.BASE_RPC_URL,
  }
});
```

---

## 🐛 必须修复的问题

**无严重 bug**。代码质量良好，测试全部通过。

以下是**强烈建议**在发布 npm 前修复的问题：

### 1. 添加地址验证 (P1)
发送资金到无效地址会导致资金丢失。虽然链上会拒绝，但应该在客户端提前验证。

### 2. 补充 Lightning payInvoice 错误信息 (P2)
当前实现会静默吞掉错误，调试困难。

---

## 总结

| 评估维度 | 评分 | 说明 |
|---------|------|------|
| 类型安全 | ⭐⭐⭐⭐⭐ | 零 any，类型严谨 |
| 测试覆盖 | ⭐⭐⭐⭐ | 65 tests，缺少边缘情况 |
| 错误处理 | ⭐⭐⭐⭐ | 有处理，但信息可以更丰富 |
| 代码风格 | ⭐⭐⭐⭐⭐ | 一致、清晰 |
| 安全考量 | ⭐⭐⭐⭐ | 需要地址验证 |
| RFC 符合度 | ⭐⭐⭐⭐⭐ | 100% 实现 + Lightning 额外功能 |

**整体评价**: 🟢 **可以发布**，建议先修复 P1 和 P2。

---

*Reviewed by Refiner Agent*

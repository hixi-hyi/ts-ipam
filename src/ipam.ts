import * as ipNum from 'ip-num';
import { table } from 'table';

const MIN_CIDR_PREFIX = 8; // 10.0.0.0/8
const MAX_CIDR_PREFIX = 24; // 192.168.0.0/24

export function CidrRange(address: string, prefix: number): ipNum.IPv4CidrRange {
  const range = new ipNum.IPv4CidrRange(ipNum.IPv4.fromDecimalDottedString(address), ipNum.IPv4Prefix.fromNumber(BigInt(prefix)));
  return range;
}

export interface ManagerProps {
  start: number;
  end: number;
  blocks: Block[];
}
export class Manager {
  public readonly blocks: Block[];
  public readonly start: number;
  public readonly end: number;
  public readonly networkAddress: NetworkAddress[] = [];
  public readonly reservedAddress: NetworkAddress[] = [];

  constructor(props: ManagerProps) {
    this.blocks = props.blocks;
    this.start = props.start;
    this.end = props.end;
    this.validate();
  }

  private validate() {
    if (this.start > this.end) {
      throw new Error('start must be less than or equal to end');
    }
    if (this.start < MIN_CIDR_PREFIX || this.start > MAX_CIDR_PREFIX) {
      throw new Error(`Start must be between ${MIN_CIDR_PREFIX} and ${MAX_CIDR_PREFIX}, inclusive.`);
    }

    if (this.end < MIN_CIDR_PREFIX || this.end > MAX_CIDR_PREFIX) {
      throw new Error(`End must be between ${MIN_CIDR_PREFIX} and ${MAX_CIDR_PREFIX}, inclusive.`);
    }
  }
}

export class Block {
  public readonly range: ipNum.IPv4CidrRange;
  constructor(ip: string, prefix: number) {
    this.range = CidrRange(ip, prefix);
  }
}

export const BLOCK_10 = new Block('10.0.0.0', 8);
export const BLOCK_172 = new Block('172.31.0.0', 12);
export const BLOCK_192 = new Block('192.168.0.0', 16);

export class NetworkAddress {
  range: ipNum.IPv4CidrRange;
  address: string;
  prefix: number;
  label?: string;
  reserved?: boolean;

  public constructor(range: ipNum.IPv4CidrRange, label?: string) {
    this.range = range;
    this.address = range.getFirst().toString();
    this.prefix = Number(range.cidrPrefix.getValue());
    this.label = label;
  }
  public static reserve(address: string, prefix: number, label?: string): NetworkAddress {
    const na = new NetworkAddress(CidrRange(address, prefix), label);
    na.reserved = true;
    return na;
  }
}

export function CollectNetworkAddresses(networkAddress: string, minCidrPrefix: number, maxCidrPrefix: number): NetworkAddress[] {
  const start = CidrRange(networkAddress, minCidrPrefix);
  const result = [];
  for (let i = maxCidrPrefix; i >= minCidrPrefix; i--) {
    result.push(...start.splitInto(new ipNum.IPv4Prefix(BigInt(i))).map((range) => new NetworkAddress(range)));
  }
  return result;
}

export function findLongestNetworkAddress(addresses: NetworkAddress[]): NetworkAddress[] {
  if (addresses.length === 0) {
    return [];
  }

  let longestPrefix = addresses[0].prefix;
  for (const ip of addresses) {
    if (ip.prefix > longestPrefix) {
      longestPrefix = ip.prefix;
    }
  }

  return addresses.filter((ip) => ip.prefix === longestPrefix);
}

export function PrintTable(networkAddresses: NetworkAddress[]) {
  // 利用されているすべてのプレフィックスを抽出
  const prefixes = Array.from(new Set(networkAddresses.map((entry) => entry.prefix)))
    .sort((a, b) => a - b) // プレフィックスを昇順に並べ替え
    .map((prefix) => `/${prefix}`);
  prefixes.push('reserved');

  // IPアドレスごとに行を作成
  const ipRows: Record<string, string[]> = {};
  networkAddresses.forEach((entry) => {
    const rowKey = entry.address;
    if (!ipRows[rowKey]) {
      ipRows[rowKey] = new Array(prefixes.length).fill('');
    }
    if (entry.reserved) {
      ipRows[rowKey][prefixes.length - 1] = entry.label || '';
    } else {
      const prefixIndex = prefixes.indexOf(`/${entry.prefix}`);
      ipRows[rowKey][prefixIndex] = entry.address;
    }
  });

  // 行データを配列に変換
  const rows = Object.values(ipRows);

  // 表を出力
  const output = table([prefixes, ...rows]);
  console.log(output);
}

import * as ipNum from 'ip-num';
import { table } from 'table';

const MIN_CIDR_PREFIX = 8;
const MAX_CIDR_PREFIX = 24;

export interface ManagerProps {
  start: number;
  end: number;
  blocks: Block[];
}
export class Manager {
  public readonly blocks: Block[];
  public readonly start: number;
  public readonly end: number;

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

  private cidrRange(address: string, subnetMask: number): ipNum.IPv4CidrRange {
    const range = new ipNum.IPv4CidrRange(ipNum.IPv4.fromDecimalDottedString(address), ipNum.IPv4Prefix.fromNumber(BigInt(subnetMask)));
    return range;
  }

  public getNetworkAddresses(range: ipNum.IPv4CidrRange): string[] {
    function iter(range: ipNum.IPv4CidrRange, maxCidrPrefix: number): string[] {
      if (range.cidrPrefix.getValue() === BigInt(maxCidrPrefix)) {
        return [];
      }
      const result = [range.getFirst().toString()];
      const [first, second] = range.split();
      return result.concat(iter(first, maxCidrPrefix), iter(second, maxCidrPrefix));
    }
    return Array.from(new Set(iter(range, this.end + 1)));
  }

  public test() {
    const ipRange = new Set<string>();
    this.blocks.forEach((block) => {
      block.process((ip) => {
        const range = this.cidrRange(ip, this.end);
        ipRange.add(range.getFirst().toString());
      });
    });
    const header = [];
    for (let i = this.start; i <= this.end; i++) {
      header.push(`/${i}`);
    }
    const t: string[][] = [header];
    for (const key of ipRange) {
      const ips = [];
      for (let i = this.start; i <= this.end; i++) {
        const range = this.cidrRange(key, i);
        ips.push(range.getFirst().toString());
      }
      t.push(ips);
    }
    console.log(table(t));
    //    console.log(table);
    console.log(this.cidrRange('10.0.0.0', 8).toRangeString());
    console.log(this.cidrRange('10.0.0.0', 9).toRangeString());
  }
}

export class Block {
  protected readonly octets = Array.from({ length: 256 }, (_, i) => i);
  public readonly ip: ipNum.IPv4;
  public readonly ipRange: ipNum.IPv4CidrRange;
  constructor(ip: string, prefix: number) {
    this.ip = new ipNum.IPv4(ip);
    this.ipRange = new ipNum.IPv4CidrRange(this.ip, ipNum.IPv4Prefix.fromNumber(BigInt(prefix)));
  }

  public process(callback: (ip: string) => void) {
    callback('');
  }
}

export class Block10 extends Block {
  constructor() {
    super('10.0.0.0', 8);
  }
  public process(callback: (ip: string) => void) {
    this.octets.forEach((i) => {
      this.octets.forEach((j) => {
        callback(`10.${i}.${j}.0`);
      });
    });
  }
}

export class Block172 extends Block {
  public readonly scope = Array.from({ length: 16 }, (_, i) => i);
  constructor() {
    super('172.16.0.0', 12);
  }
  public process(callback: (ip: string) => void) {
    this.scope.forEach((i) => {
      this.octets.forEach((j) => {
        callback(`172.${i}.${j}.0`);
      });
    });
  }
}

export class Block192 extends Block {
  constructor() {
    super('192.168.0.0', 16);
  }
  public process(callback: (ip: string) => void) {
    this.octets.forEach((i) => {
      callback(`192.168.${i}.0`);
    });
  }
}

export function CidrRange(address: string, prefix: number): ipNum.IPv4CidrRange {
  const range = new ipNum.IPv4CidrRange(ipNum.IPv4.fromDecimalDottedString(address), ipNum.IPv4Prefix.fromNumber(BigInt(prefix)));
  return range;
}

export interface NetworkAddress {
  address: string;
  prefix: number;
  label?: string;
}

export function CollectNetworkAddresses(networkAddress: string, minCidrPrefix: number, maxCidrPrefix: number): NetworkAddress[] {
  function iter(range: ipNum.IPv4CidrRange, maxCidrPrefix: number): NetworkAddress[] {
    if (range.cidrPrefix.getValue() === BigInt(maxCidrPrefix)) {
      return [];
    }
    const result = [{ address: range.getFirst().toString(), prefix: Number(range.cidrPrefix.getValue()) }];
    const [first, second] = range.split();
    return result.concat(iter(first, maxCidrPrefix), iter(second, maxCidrPrefix));
  }

  const range = CidrRange(networkAddress, minCidrPrefix);
  return Array.from(new Set(iter(range, maxCidrPrefix + 1)));
}

export function findLongestNetworkAddress(addresses: NetworkAddress[]): string[] {
  if (addresses.length === 0) {
    return [];
  }

  let longestPrefix = addresses[0].prefix;
  for (const ip of addresses) {
    if (ip.prefix > longestPrefix) {
      longestPrefix = ip.prefix;
    }
  }

  return addresses.filter((ip) => ip.prefix === longestPrefix).map((ip) => ip.address);
}

export function PrintTable(networkAddresses: NetworkAddress[]) {
  // 利用されているすべてのプレフィックスを抽出
  const prefixes = Array.from(new Set(networkAddresses.map((entry) => entry.prefix)))
    .sort((a, b) => a - b) // プレフィックスを昇順に並べ替え
    .map((prefix) => `/${prefix}`);

  // IPアドレスごとに行を作成
  const ipRows: Record<string, string[]> = {};
  networkAddresses.forEach((entry) => {
    const rowKey = entry.address;
    if (!ipRows[rowKey]) {
      ipRows[rowKey] = new Array(prefixes.length).fill('');
    }
    const prefixIndex = prefixes.indexOf(`/${entry.prefix}`);
    ipRows[rowKey][prefixIndex] = entry.label || entry.address;
  });

  // 行データを配列に変換
  const rows = Object.values(ipRows);

  // 表を出力
  const output = table([prefixes, ...rows]);
  console.log(output);
}

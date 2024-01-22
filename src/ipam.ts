import * as ipNum from 'ip-num';
import { table } from 'table';

const MIN_CIDR_PREFIX = 8; // 10.0.0.0/8
const MAX_CIDR_PREFIX = 24; // 192.168.0.0/24

export class NetworkBlock {
  public readonly range: ipNum.IPv4CidrRange;
  constructor(ip: string, prefix: number) {
    this.range = CidrRange(ip, prefix);
  }
}

export const NETWORK_BLOCK_10 = new NetworkBlock('10.0.0.0', 8);
export const NETWORK_BLOCK_172 = new NetworkBlock('172.16.0.0', 12);
export const NETWORK_BLOCK_192 = new NetworkBlock('192.168.0.0', 16);

export class NetworkAddress {
  range: ipNum.IPv4CidrRange;
  address: string;
  prefix: number;
  label: string;
  code: string;

  public constructor(range: ipNum.IPv4CidrRange, label: string, code?: string) {
    this.range = range;
    this.address = range.getFirst().toString();
    this.prefix = Number(range.cidrPrefix.getValue());
    this.label = label;
    this.code = code || '';
  }
  public get cidr(): string {
    return this.range.toCidrString();
  }
}

export function CidrRange(address: string, prefix: number): ipNum.IPv4CidrRange {
  const range = new ipNum.IPv4CidrRange(ipNum.IPv4.fromDecimalDottedString(address), ipNum.IPv4Prefix.fromNumber(BigInt(prefix)));
  return range;
}
export function CidrRangeFromCidr(cidr: string): ipNum.IPv4CidrRange {
  return ipNum.IPv4CidrRange.fromCidr(cidr);
}
export function CidrStringToIpAndPrefix(cidr: string): [string, number] {
  const [address, prefix] = cidr.split('/');
  return [address, Number(prefix)];
}

type AddressFormat = 'CIDR' | 'RANGE';
export const ADDRESS_FORMAT_CIDR: AddressFormat = 'CIDR';
export const ADDRESS_FORMAT_RANGE: AddressFormat = 'RANGE';

export interface ManagerConfigProps {
  addressFormat?: AddressFormat;
}
abstract class AbstractManager {
  public readonly block: NetworkBlock;
  public readonly start: number;
  public readonly end: number;
  public readonly reserved: NetworkAddress[] = [];
  public readonly addressFormat: AddressFormat = ADDRESS_FORMAT_CIDR;

  constructor(block: NetworkBlock, start: number, end: number, config: ManagerConfigProps = {}) {
    this.block = block;
    this.start = start;
    this.end = end;
    this.addressFormat = config.addressFormat ?? ADDRESS_FORMAT_CIDR;
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
  protected formatAddress(range: ipNum.IPv4CidrRange): string {
    if (this.addressFormat === ADDRESS_FORMAT_CIDR) {
      return range.toCidrString();
    } else {
      return range.toRangeString();
    }
  }
  public reserve(cidr: string, label: string, code?: string): boolean {
    const [address, prefix] = CidrStringToIpAndPrefix(cidr);
    const range = CidrRange(address, prefix);
    const networkAddress = range.getFirst().toString();
    if (networkAddress !== address) {
      throw new Error(`The address ${address}/${prefix} is not a valid network address. Maybe you meant ${networkAddress}/${prefix}?`);
    }
    if (prefix < this.start || prefix > this.end) {
      throw new Error(`The prefix ${prefix} is not between ${this.start} and ${this.end}, inclusive.`);
    }
    if (code && this.hasReserved(code)) {
      throw new Error(`The code ${code} is already reserved.`);
    }
    this.reserved.push(new NetworkAddress(range, label, code));
    return true;
  }
  public getReserved(code: string): NetworkAddress | undefined {
    if (code === '') {
      return undefined;
    }
    return this.reserved.find((entry) => entry.code === code);
  }
  public hasReserved(code: string): boolean {
    if (code === '') {
      return false;
    }
    return this.getReserved(code) !== undefined;
  }
  public printCsv(): void {
    const csv = this.getContents()
      .map((row) => row.join(','))
      .join('\n');
    console.log(csv);
  }
  abstract printTable(): void;
  protected abstract getContents(): string[][];
}

export class ReservedManager extends AbstractManager {
  public readonly pool: ipNum.Pool<ipNum.RangedSet<ipNum.IPv4>>;
  constructor(block: NetworkBlock, start: number, end: number, config: ManagerConfigProps = {}) {
    super(block, start, end, config);
    this.pool = ipNum.Pool.fromCidrRanges([this.block.range]);
  }
  public reserve(cidr: string, label: string, code?: string): boolean {
    super.reserve(cidr, label, code);
    const isReserved = this.pool.removeOverlapping(ipNum.RangedSet.fromCidrRange(CidrRangeFromCidr(cidr)));
    if (!isReserved) {
      throw new Error(`Failed to allocate the address range ${cidr}.`);
    }
    return isReserved;
  }
  public printTable(): void {
    const config = {
      header: {
        content: `Reserved IP Address ${this.block.range.toCidrString()}`,
      },
    };
    console.log(table(this.getContents(), config));
  }
  protected getContents(): string[][] {
    const header = ['address', 'label', 'code'];
    const rows = this.reserved
      .sort((a, b) => a.address.localeCompare(b.address))
      .map((entry) => [this.formatAddress(entry.range), entry.label, entry.code]);
    return [header, ...rows];
  }
}
//export class SummaryPoolManager extends AbstractManager {
//  public readonly pool: ipNum.Pool<ipNum.RangedSet<ipNum.IPv4>>;
//  constructor(props: ManagerProps) {
//    super(props);
//    this.pool = ipNum.Pool.fromCidrRanges([this.block.range]);
//  }
//  public reserve(cidr: string, label: string, code?: string): boolean {
//    super.reserve(cidr, label, code);
//    const isReserved = this.pool.removeOverlapping(ipNum.RangedSet.fromCidrRange(CidrRangeFromCidr(cidr)));
//    if (this.throwException && !isReserved) {
//      throw new Error(`Failed to allocate the address range ${cidr}.`);
//    }
//    return isReserved;
//  }
//  public printTable(): void {
//    const config = {
//      header: {
//        content: `Reserved IP Address ${this.block.range.toCidrString()}`,
//      },
//    };
//    console.log(table(this.getContents(), config));
//  }
//  protected getContents(): string[][] {
//    const header = ['address', 'label', 'code'];
//    const rows = [];
//
//    for (const rs of this.pool.getRanges()) {
//      const rangeSet = rs as ipNum.RangedSet<ipNum.IPv4>;
//      console.log(rangeSet.getSize());
//      const available = rangeSet.toCidrRange() as ipNum.IPv4CidrRange;
//      //console.log(available);
//      console.log(available.toRangeString());
//      console.log(this.formatAddress(available));
//      rows.push([this.formatAddress(available), 'available', '']);
//    }
//    rows.push(
//      ...this.reserved.sort((a, b) => a.address.localeCompare(b.address)).map((entry) => [this.formatAddress(entry.range), entry.label, entry.code])
//    );
//    return [header, ...rows];
//  }
//}
//
//// export class CompletePoolManager extends AbstractManager {
//
//
//export function CollectNetworkAddresses(networkAddress: string, minCidrPrefix: number, maxCidrPrefix: number): NetworkAddress[] {
//  const start = CidrRange(networkAddress, minCidrPrefix);
//  const result = [];
//  for (let i = maxCidrPrefix; i >= minCidrPrefix; i--) {
//    result.push(...start.splitInto(new ipNum.IPv4Prefix(BigInt(i))).map((range) => new NetworkAddress(range)));
//  }
//  return result;
//}
//
//export function findLongestNetworkAddress(addresses: NetworkAddress[]): NetworkAddress[] {
//  if (addresses.length === 0) {
//    return [];
//  }
//
//  let longestPrefix = addresses[0].prefix;
//  for (const ip of addresses) {
//    if (ip.prefix > longestPrefix) {
//      longestPrefix = ip.prefix;
//    }
//  }
//
//  return addresses.filter((ip) => ip.prefix === longestPrefix);
//}
//
//export function PrintTable(networkAddresses: NetworkAddress[]) {
//  const prefixes = Array.from(new Set(networkAddresses.map((entry) => entry.prefix)))
//    .sort((a, b) => a - b) // プレフィックスを昇順に並べ替え
//    .map((prefix) => `/${prefix}`);
//  prefixes.push('reserved');
//
//  const ipRows: Record<string, string[]> = {};
//  networkAddresses.forEach((entry) => {
//    const rowKey = entry.address;
//    if (!ipRows[rowKey]) {
//      ipRows[rowKey] = new Array(prefixes.length).fill('');
//    }
//    if (entry.reserved) {
//      ipRows[rowKey][prefixes.length - 1] = entry.label || '';
//    } else {
//      const prefixIndex = prefixes.indexOf(`/${entry.prefix}`);
//      ipRows[rowKey][prefixIndex] = entry.address;
//    }
//  });
//
//  const rows = Object.values(ipRows);
//
//  const output = table([prefixes, ...rows]);
//  console.log(output);
//}
//

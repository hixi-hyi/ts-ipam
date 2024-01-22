"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservedManager = exports.ADDRESS_FORMAT_RANGE = exports.ADDRESS_FORMAT_CIDR = exports.CidrStringToIpAndPrefix = exports.CidrRangeFromCidr = exports.CidrRange = exports.NetworkAddress = exports.NETWORK_BLOCK_192 = exports.NETWORK_BLOCK_172 = exports.NETWORK_BLOCK_10 = exports.NetworkBlock = void 0;
const ipNum = __importStar(require("ip-num"));
const table_1 = require("table");
const MIN_CIDR_PREFIX = 8; // 10.0.0.0/8
const MAX_CIDR_PREFIX = 24; // 192.168.0.0/24
class NetworkBlock {
    constructor(ip, prefix) {
        this.range = CidrRange(ip, prefix);
    }
}
exports.NetworkBlock = NetworkBlock;
exports.NETWORK_BLOCK_10 = new NetworkBlock('10.0.0.0', 8);
exports.NETWORK_BLOCK_172 = new NetworkBlock('172.16.0.0', 12);
exports.NETWORK_BLOCK_192 = new NetworkBlock('192.168.0.0', 16);
class NetworkAddress {
    constructor(range, label, code) {
        this.range = range;
        this.address = range.getFirst().toString();
        this.prefix = Number(range.cidrPrefix.getValue());
        this.label = label;
        this.code = code || '';
    }
    get cidr() {
        return this.range.toCidrString();
    }
}
exports.NetworkAddress = NetworkAddress;
function CidrRange(address, prefix) {
    const range = new ipNum.IPv4CidrRange(ipNum.IPv4.fromDecimalDottedString(address), ipNum.IPv4Prefix.fromNumber(BigInt(prefix)));
    return range;
}
exports.CidrRange = CidrRange;
function CidrRangeFromCidr(cidr) {
    return ipNum.IPv4CidrRange.fromCidr(cidr);
}
exports.CidrRangeFromCidr = CidrRangeFromCidr;
function CidrStringToIpAndPrefix(cidr) {
    const [address, prefix] = cidr.split('/');
    return [address, Number(prefix)];
}
exports.CidrStringToIpAndPrefix = CidrStringToIpAndPrefix;
exports.ADDRESS_FORMAT_CIDR = 'CIDR';
exports.ADDRESS_FORMAT_RANGE = 'RANGE';
class AbstractManager {
    constructor(block, start, end, config = {}) {
        this.reserved = [];
        this.addressFormat = exports.ADDRESS_FORMAT_CIDR;
        this.block = block;
        this.start = start;
        this.end = end;
        this.addressFormat = config.addressFormat ?? exports.ADDRESS_FORMAT_CIDR;
        this.validate();
    }
    validate() {
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
    formatAddress(range) {
        if (this.addressFormat === exports.ADDRESS_FORMAT_CIDR) {
            return range.toCidrString();
        }
        else {
            return range.toRangeString();
        }
    }
    reserve(cidr, label, code) {
        const [address, prefix] = CidrStringToIpAndPrefix(cidr);
        const range = CidrRange(address, prefix);
        const networkAddress = range.getFirst().toString();
        if (networkAddress !== address) {
            throw new Error(`The address ${address}/${prefix} is not a valid network address. Maybe you meant ${networkAddress}/${prefix}?`);
        }
        if (prefix < this.start || prefix > this.end) {
            throw new Error(`The prefix ${prefix} is not between ${this.start} and ${this.end}, inclusive.`);
        }
        if (code && this.hasReserve(code)) {
            throw new Error(`The code ${code} is already reserved.`);
        }
        this.reserved.push(new NetworkAddress(range, label, code));
        return true;
    }
    getReserve(code) {
        if (code === '') {
            return undefined;
        }
        return this.reserved.find((entry) => entry.code === code);
    }
    hasReserve(code) {
        if (code === '') {
            return false;
        }
        return this.getReserve(code) !== undefined;
    }
    printCsv() {
        const csv = this.getContents()
            .map((row) => row.join(','))
            .join('\n');
        console.log(csv);
    }
}
class ReservedManager extends AbstractManager {
    constructor(block, start, end, config = {}) {
        super(block, start, end, config);
        this.pool = ipNum.Pool.fromCidrRanges([this.block.range]);
    }
    reserve(cidr, label, code) {
        super.reserve(cidr, label, code);
        const isReserved = this.pool.removeOverlapping(ipNum.RangedSet.fromCidrRange(CidrRangeFromCidr(cidr)));
        if (!isReserved) {
            throw new Error(`Failed to allocate the address range ${cidr}.`);
        }
        return isReserved;
    }
    printTable() {
        const config = {
            header: {
                content: `Reserved IP Address ${this.block.range.toCidrString()}`,
            },
        };
        console.log((0, table_1.table)(this.getContents(), config));
    }
    getContents() {
        const header = ['address', 'label', 'code'];
        const rows = this.reserved
            .sort((a, b) => a.address.localeCompare(b.address))
            .map((entry) => [this.formatAddress(entry.range), entry.label, entry.code]);
        return [header, ...rows];
    }
}
exports.ReservedManager = ReservedManager;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXBhbS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pcGFtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsOENBQWdDO0FBQ2hDLGlDQUE4QjtBQUU5QixNQUFNLGVBQWUsR0FBRyxDQUFDLENBQUMsQ0FBQyxhQUFhO0FBQ3hDLE1BQU0sZUFBZSxHQUFHLEVBQUUsQ0FBQyxDQUFDLGlCQUFpQjtBQUU3QyxNQUFhLFlBQVk7SUFFdkIsWUFBWSxFQUFVLEVBQUUsTUFBYztRQUNwQyxJQUFJLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDckMsQ0FBQztDQUNGO0FBTEQsb0NBS0M7QUFFWSxRQUFBLGdCQUFnQixHQUFHLElBQUksWUFBWSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNuRCxRQUFBLGlCQUFpQixHQUFHLElBQUksWUFBWSxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQztBQUN2RCxRQUFBLGlCQUFpQixHQUFHLElBQUksWUFBWSxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUVyRSxNQUFhLGNBQWM7SUFPekIsWUFBbUIsS0FBMEIsRUFBRSxLQUFhLEVBQUUsSUFBYTtRQUN6RSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUMzQyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDbEQsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO0lBQ3pCLENBQUM7SUFDRCxJQUFXLElBQUk7UUFDYixP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bGUgfSBmcm9tICd0YWJsZSc7XG5cbmNvbnN0IE1JTl9DSURSX1BSRUZJWCA9IDg7IC8vIDEwLjAuMC4wLzhcbmNvbnN0IE1BWF9DSURSX1BSRUZJWCA9IDI0OyAvLyAxOTIuMTY4LjAuMC8yNFxuXG5leHBvcnQgY2xhc3MgTmV0d29ya0Jsb2NrIHtcbiAgcHVibGljIHJlYWRvbmx5IHJhbmdlOiBpcE51bS5JUHY0Q2lkclJhbmdlO1xuICBjb25zdHJ1Y3RvcihpcDogc3RyaW5nLCBwcmVmaXg6IG51bWJlcikge1xuICAgIHRoaXMucmFuZ2UgPSBDaWRyUmFuZ2UoaXAsIHByZWZpeCk7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IE5FVFdPUktfQkxPQ0tfMTAgPSBuZXcgTmV0d29ya0Jsb2NrKCcxMC4wLjAuMCcsIDgpO1xuZXhwb3J0IGNvbnN0IE5FVFdPUktfQkxPQ0tfMTcyID0gbmV3IE5ldHdvcmtCbG9jaygnMTcyLjE2LjAuMCcsIDEyKTtcbmV4cG9ydCBjb25zdCBORVRXT1JLX0JMT0NLXzE5MiA9IG5ldyBOZXR3b3JrQmxvY2soJzE5Mi4xNjguMC4wJywgMTYpO1xuXG5leHBvcnQgY2xhc3MgTmV0d29ya0FkZHJlc3Mge1xuICByYW5nZTogaXBOdW0uSVB2NENpZHJSYW5nZTtcbiAgYWRkcmVzczogc3RyaW5nO1xuICBwcmVmaXg6IG51bWJlcjtcbiAgbGFiZWw6IHN0cmluZztcbiAgY29kZTogc3RyaW5nO1xuXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihyYW5nZTogaXBOdW0uSVB2NENpZHJSYW5nZSwgbGFiZWw6IHN0cmluZywgY29kZT86IHN0cmluZykge1xuICAgIHRoaXMucmFuZ2UgPSByYW5nZTtcbiAgICB0aGlzLmFkZHJlc3MgPSByYW5nZS5nZXRGaXJzdCgpLnRvU3RyaW5nKCk7XG4gICAgdGhpcy5wcmVmaXggPSBOdW1iZXIocmFuZ2UuY2lkclByZWZpeC5nZXRWYWx1ZSgpKTtcbiAgICB0aGlzLmxhYmVsID0gbGFiZWw7XG4gICAgdGhpcy5jb2RlID0gY29kZSB8fCAnJztcbiAgfVxuICBwdWJsaWMgZ2V0IGNpZHIoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5yYW5nZS50b0NpZHJTdHJpbmcoKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gQ2lkclJhbmdlKGFkZHJlc3M6IHN0cmluZywgcHJlZml4OiBudW1iZXIpOiBpcE51bS5JUHY0Q2lkclJhbmdlIHtcbiAgY29uc3QgcmFuZ2UgPSBuZXcgaXBOdW0uSVB2NENpZHJSYW5nZShpcE51bS5JUHY0LmZyb21EZWNpbWFsRG90dGVkU3RyaW5nKGFkZHJlc3MpLCBpcE51bS5JUHY0UHJlZml4LmZyb21OdW1iZXIoQmlnSW50KHByZWZpeCkpKTtcbiAgcmV0dXJuIHJhbmdlO1xufVxuZXhwb3J0IGZ1bmN0aW9uIENpZHJSYW5nZUZyb21DaWRyKGNpZHI6IHN0cmluZyk6IGlwTnVtLklQdjRDaWRyUmFuZ2Uge1xuICByZXR1cm4gaXBOdW0uSVB2NENpZHJSYW5nZS5mcm9tQ2lkcihjaWRyKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBDaWRyU3RyaW5nVG9JcEFuZFByZWZpeChjaWRyOiBzdHJpbmcpOiBbc3RyaW5nLCBudW1iZXJdIHtcbiAgY29uc3QgW2FkZHJlc3MsIHByZWZpeF0gPSBjaWRyLnNwbGl0KCcvJyk7XG4gIHJldHVybiBbYWRkcmVzcywgTnVtYmVyKHByZWZpeCldO1xufVxuXG50eXBlIEFkZHJlc3NGb3JtYXQgPSAnQ0lEUicgfCAnUkFOR0UnO1xuZXhwb3J0IGNvbnN0IEFERFJFU1NfRk9STUFUX0NJRFI6IEFkZHJlc3NGb3JtYXQgPSAnQ0lEUic7XG5leHBvcnQgY29uc3QgQUREUkVTU19GT1JNQVRfUkFOR0U6IEFkZHJlc3NGb3JtYXQgPSAnUkFOR0UnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1hbmFnZXJDb25maWdQcm9wcyB7XG4gIGFkZHJlc3NGb3JtYXQ/OiBBZGRyZXNzRm9ybWF0O1xufVxuYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RNYW5hZ2VyIHtcbiAgcHVibGljIHJlYWRvbmx5IGJsb2NrOiBOZXR3b3JrQmxvY2s7XG4gIHB1YmxpYyByZWFkb25seSBzdGFydDogbnVtYmVyO1xuICBwdWJsaWMgcmVhZG9ubHkgZW5kOiBudW1iZXI7XG4gIHB1YmxpYyByZWFkb25seSByZXNlcnZlZDogTmV0d29ya0FkZHJlc3NbXSA9IFtdO1xuICBwdWJsaWMgcmVhZG9ubHkgYWRkcmVzc0Zvcm1hdDogQWRkcmVzc0Zvcm1hdCA9IEFERFJFU1NfRk9STUFUX0NJRFI7XG5cbiAgY29uc3RydWN0b3IoYmxvY2s6IE5ldHdvcmtCbG9jaywgc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIsIGNvbmZpZzogTWFuYWdlckNvbmZpZ1Byb3BzID0ge30pIHtcbiAgICB0aGlzLmJsb2NrID0gYmxvY2s7XG4gICAgdGhpcy5zdGFydCA9IHN0YXJ0O1xuICAgIHRoaXMuZW5kID0gZW5kO1xuICAgIHRoaXMuYWRkcmVzc0Zvcm1hdCA9IGNvbmZpZy5hZGRyZXNzRm9ybWF0ID8/IEFERFJFU1NfRk9STUFUX0NJRFI7XG4gICAgdGhpcy52YWxpZGF0ZSgpO1xuICB9XG4gIHByaXZhdGUgdmFsaWRhdGUoKSB7XG4gICAgaWYgKHRoaXMuc3RhcnQgPiB0aGlzLmVuZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdzdGFydCBtdXN0IGJlIGxlc3MgdGhhbiBvciBlcXVhbCB0byBlbmQnKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuc3RhcnQgPCBNSU5fQ0lEUl9QUkVGSVggfHwgdGhpcy5zdGFydCA+IE1BWF9DSURSX1BSRUZJWCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBTdGFydCBtdXN0IGJlIGJldHdlZW4gJHtNSU5fQ0lEUl9QUkVGSVh9IGFuZCAke01BWF9DSURSX1BSRUZJWH0sIGluY2x1c2l2ZS5gKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5lbmQgPCBNSU5fQ0lEUl9QUkVGSVggfHwgdGhpcy5lbmQgPiBNQVhfQ0lEUl9QUkVGSVgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRW5kIG11c3QgYmUgYmV0d2VlbiAke01JTl9DSURSX1BSRUZJWH0gYW5kICR7TUFYX0NJRFJfUFJFRklYfSwgaW5jbHVzaXZlLmApO1xuICAgIH1cbiAgfVxuICBwcm90ZWN0ZWQgZm9ybWF0QWRkcmVzcyhyYW5nZTogaXBOdW0uSVB2NENpZHJSYW5nZSk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuYWRkcmVzc0Zvcm1hdCA9PT0gQUREUkVTU19GT1JNQVRfQ0lEUikge1xuICAgICAgcmV0dXJuIHJhbmdlLnRvQ2lkclN0cmluZygpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmFuZ2UudG9SYW5nZVN0cmluZygpO1xuICAgIH1cbiAgfVxuICBwdWJsaWMgcmVzZXJ2ZShjaWRyOiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcsIGNvZGU/OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCBbYWRkcmVzcywgcHJlZml4XSA9IENpZHJTdHJpbmdUb0lwQW5kUHJlZml4KGNpZHIpO1xuICAgIGNvbnN0IHJhbmdlID0gQ2lkclJhbmdlKGFkZHJlc3MsIHByZWZpeCk7XG4gICAgY29uc3QgbmV0d29ya0FkZHJlc3MgPSByYW5nZS5nZXRGaXJzdCgpLnRvU3RyaW5nKCk7XG4gICAgaWYgKG5ldHdvcmtBZGRyZXNzICE9PSBhZGRyZXNzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSBhZGRyZXNzICR7YWRkcmVzc30vJHtwcmVmaXh9IGlzIG5vdCBhIHZhbGlkIG5ldHdvcmsgYWRkcmVzcy4gTWF5YmUgeW91IG1lYW50ICR7bmV0d29ya0FkZHJlc3N9LyR7cHJlZml4fT9gKTtcbiAgICB9XG4gICAgaWYgKHByZWZpeCA8IHRoaXMuc3RhcnQgfHwgcHJlZml4ID4gdGhpcy5lbmQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlIHByZWZpeCAke3ByZWZpeH0gaXMgbm90IGJldHdlZW4gJHt0aGlzLnN0YXJ0fSBhbmQgJHt0aGlzLmVuZH0sIGluY2x1c2l2ZS5gKTtcbiAgICB9XG4gICAgaWYgKGNvZGUgJiYgdGhpcy5oYXNSZXNlcnZlKGNvZGUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSBjb2RlICR7Y29kZX0gaXMgYWxyZWFkeSByZXNlcnZlZC5gKTtcbiAgICB9XG4gICAgdGhpcy5yZXNlcnZlZC5wdXNoKG5ldyBOZXR3b3JrQWRkcmVzcyhyYW5nZSwgbGFiZWwsIGNvZGUpKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBwdWJsaWMgZ2V0UmVzZXJ2ZShjb2RlOiBzdHJpbmcpOiBOZXR3b3JrQWRkcmVzcyB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKGNvZGUgPT09ICcnKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5yZXNlcnZlZC5maW5kKChlbnRyeSkgPT4gZW50cnkuY29kZSA9PT0gY29kZSk7XG4gIH1cbiAgcHVibGljIGhhc1Jlc2VydmUoY29kZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgaWYgKGNvZGUgPT09ICcnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmdldFJlc2VydmUoY29kZSkgIT09IHVuZGVmaW5lZDtcbiAgfVxuICBwdWJsaWMgcHJpbnRDc3YoKTogdm9pZCB7XG4gICAgY29uc3QgY3N2ID0gdGhpcy5nZXRDb250ZW50cygpXG4gICAgICAubWFwKChyb3cpID0+IHJvdy5qb2luKCcsJykpXG4gICAgICAuam9pbignXFxuJyk7XG4gICAgY29uc29sZS5sb2coY3N2KTtcbiAgfVxuICBhYnN0cmFjdCBwcmludFRhYmxlKCk6IHZvaWQ7XG4gIHByb3RlY3RlZCBhYnN0cmFjdCBnZXRDb250ZW50cygpOiBzdHJpbmdbXVtdO1xufVxuXG5leHBvcnQgY2xhc3MgUmVzZXJ2ZWRNYW5hZ2VyIGV4dGVuZHMgQWJzdHJhY3RNYW5hZ2VyIHtcbiAgcHVibGljIHJlYWRvbmx5IHBvb2w6IGlwTnVtLlBvb2w8aXBOdW0uUmFuZ2VkU2V0PGlwTnVtLklQdjQ+PjtcbiAgY29uc3RydWN0b3IoYmxvY2s6IE5ldHdvcmtCbG9jaywgc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIsIGNvbmZpZzogTWFuYWdlckNvbmZpZ1Byb3BzID0ge30pIHtcbiAgICBzdXBlcihibG9jaywgc3RhcnQsIGVuZCwgY29uZmlnKTtcbiAgICB0aGlzLnBvb2wgPSBpcE51bS5Qb29sLmZyb21DaWRyUmFuZ2VzKFt0aGlzLmJsb2NrLnJhbmdlXSk7XG4gIH1cbiAgcHVibGljIHJlc2VydmUoY2lkcjogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCBjb2RlPzogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgc3VwZXIucmVzZXJ2ZShjaWRyLCBsYWJlbCwgY29kZSk7XG4gICAgY29uc3QgaXNSZXNlcnZlZCA9IHRoaXMucG9vbC5yZW1vdmVPdmVybGFwcGluZyhpcE51bS5SYW5nZWRTZXQuZnJvbUNpZHJSYW5nZShDaWRyUmFuZ2VGcm9tQ2lkcihjaWRyKSkpO1xuICAgIGlmICghaXNSZXNlcnZlZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gYWxsb2NhdGUgdGhlIGFkZHJlc3MgcmFuZ2UgJHtjaWRyfS5gKTtcbiAgICB9XG4gICAgcmV0dXJuIGlzUmVzZXJ2ZWQ7XG4gIH1cbiAgcHVibGljIHByaW50VGFibGUoKTogdm9pZCB7XG4gICAgY29uc3QgY29uZmlnID0ge1xuICAgICAgaGVhZGVyOiB7XG4gICAgICAgIGNvbnRlbnQ6IGBSZXNlcnZlZCBJUCBBZGRyZXNzICR7dGhpcy5ibG9jay5yYW5nZS50b0NpZHJTdHJpbmcoKX1gLFxuICAgICAgfSxcbiAgICB9O1xuICAgIGNvbnNvbGUubG9nKHRhYmxlKHRoaXMuZ2V0Q29udGVudHMoKSwgY29uZmlnKSk7XG4gIH1cbiAgcHJvdGVjdGVkIGdldENvbnRlbnRzKCk6IHN0cmluZ1tdW10ge1xuICAgIGNvbnN0IGhlYWRlciA9IFsnYWRkcmVzcycsICdsYWJlbCcsICdjb2RlJ107XG4gICAgY29uc3Qgcm93cyA9IHRoaXMucmVzZXJ2ZWRcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBhLmFkZHJlc3MubG9jYWxlQ29tcGFyZShiLmFkZHJlc3MpKVxuICAgICAgLm1hcCgoZW50cnkpID0+IFt0aGlzLmZvcm1hdEFkZHJlc3MoZW50cnkucmFuZ2UpLCBlbnRyeS5sYWJlbCwgZW50cnkuY29kZV0pO1xuICAgIHJldHVybiBbaGVhZGVyLCAuLi5yb3dzXTtcbiAgfVxufVxuLy9leHBvcnQgY2xhc3MgU3VtbWFyeVBvb2xNYW5hZ2VyIGV4dGVuZHMgQWJzdHJhY3RNYW5hZ2VyIHtcbi8vICBwdWJsaWMgcmVhZG9ubHkgcG9vbDogaXBOdW0uUG9vbDxpcE51bS5SYW5nZWRTZXQ8aXBOdW0uSVB2ND4+O1xuLy8gIGNvbnN0cnVjdG9yKHByb3BzOiBNYW5hZ2VyUHJvcHMpIHtcbi8vICAgIHN1cGVyKHByb3BzKTtcbi8vICAgIHRoaXMucG9vbCA9IGlwTnVtLlBvb2wuZnJvbUNpZHJSYW5nZXMoW3RoaXMuYmxvY2sucmFuZ2VdKTtcbi8vICB9XG4vLyAgcHVibGljIHJlc2VydmUoY2lkcjogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCBjb2RlPzogc3RyaW5nKTogYm9vbGVhbiB7XG4vLyAgICBzdXBlci5yZXNlcnZlKGNpZHIsIGxhYmVsLCBjb2RlKTtcbi8vICAgIGNvbnN0IGlzUmVzZXJ2ZWQgPSB0aGlzLnBvb2wucmVtb3ZlT3ZlcmxhcHBpbmcoaXBOdW0uUmFuZ2VkU2V0LmZyb21DaWRyUmFuZ2UoQ2lkclJhbmdlRnJvbUNpZHIoY2lkcikpKTtcbi8vICAgIGlmICh0aGlzLnRocm93RXhjZXB0aW9uICYmICFpc1Jlc2VydmVkKSB7XG4vLyAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGFsbG9jYXRlIHRoZSBhZGRyZXNzIHJhbmdlICR7Y2lkcn0uYCk7XG4vLyAgICB9XG4vLyAgICByZXR1cm4gaXNSZXNlcnZlZDtcbi8vICB9XG4vLyAgcHVibGljIHByaW50VGFibGUoKTogdm9pZCB7XG4vLyAgICBjb25zdCBjb25maWcgPSB7XG4vLyAgICAgIGhlYWRlcjoge1xuLy8gICAgICAgIGNvbnRlbnQ6IGBSZXNlcnZlZCBJUCBBZGRyZXNzICR7dGhpcy5ibG9jay5yYW5nZS50b0NpZHJTdHJpbmcoKX1gLFxuLy8gICAgICB9LFxuLy8gICAgfTtcbi8vICAgIGNvbnNvbGUubG9nKHRhYmxlKHRoaXMuZ2V0Q29udGVudHMoKSwgY29uZmlnKSk7XG4vLyAgfVxuLy8gIHByb3RlY3RlZCBnZXRDb250ZW50cygpOiBzdHJpbmdbXVtdIHtcbi8vICAgIGNvbnN0IGhlYWRlciA9IFsnYWRkcmVzcycsICdsYWJlbCcsICdjb2RlJ107XG4vLyAgICBjb25zdCByb3dzID0gW107XG4vL1xuLy8gICAgZm9yIChjb25zdCBycyBvZiB0aGlzLnBvb2wuZ2V0UmFuZ2VzKCkpIHtcbi8vICAgICAgY29uc3QgcmFuZ2VTZXQgPSBycyBhcyBpcE51bS5SYW5nZWRTZXQ8aXBOdW0uSVB2ND47XG4vLyAgICAgIGNvbnNvbGUubG9nKHJhbmdlU2V0LmdldFNpemUoKSk7XG4vLyAgICAgIGNvbnN0IGF2YWlsYWJsZSA9IHJhbmdlU2V0LnRvQ2lkclJhbmdlKCkgYXMgaXBOdW0uSVB2NENpZHJSYW5nZTtcbi8vICAgICAgLy9jb25zb2xlLmxvZyhhdmFpbGFibGUpO1xuLy8gICAgICBjb25zb2xlLmxvZyhhdmFpbGFibGUudG9SYW5nZVN0cmluZygpKTtcbi8vICAgICAgY29uc29sZS5sb2codGhpcy5mb3JtYXRBZGRyZXNzKGF2YWlsYWJsZSkpO1xuLy8gICAgICByb3dzLnB1c2goW3RoaXMuZm9ybWF0QWRkcmVzcyhhdmFpbGFibGUpLCAnYXZhaWxhYmxlJywgJyddKTtcbi8vICAgIH1cbi8vICAgIHJvd3MucHVzaChcbi8vICAgICAgLi4udGhpcy5yZXNlcnZlZC5zb3J0KChhLCBiKSA9PiBhLmFkZHJlc3MubG9jYWxlQ29tcGFyZShiLmFkZHJlc3MpKS5tYXAoKGVudHJ5KSA9PiBbdGhpcy5mb3JtYXRBZGRyZXNzKGVudHJ5LnJhbmdlKSwgZW50cnkubGFiZWwsIGVudHJ5LmNvZGVdKVxuLy8gICAgKTtcbi8vICAgIHJldHVybiBbaGVhZGVyLCAuLi5yb3dzXTtcbi8vICB9XG4vL31cbi8vXG4vLy8vIGV4cG9ydCBjbGFzcyBDb21wbGV0ZVBvb2xNYW5hZ2VyIGV4dGVuZHMgQWJzdHJhY3RNYW5hZ2VyIHtcbi8vXG4vL1xuLy9leHBvcnQgZnVuY3Rpb24gQ29sbGVjdE5ldHdvcmtBZGRyZXNzZXMobmV0d29ya0FkZHJlc3M6IHN0cmluZywgbWluQ2lkclByZWZpeDogbnVtYmVyLCBtYXhDaWRyUHJlZml4OiBudW1iZXIpOiBOZXR3b3JrQWRkcmVzc1tdIHtcbi8vICBjb25zdCBzdGFydCA9IENpZHJSYW5nZShuZXR3b3JrQWRkcmVzcywgbWluQ2lkclByZWZpeCk7XG4vLyAgY29uc3QgcmVzdWx0ID0gW107XG4vLyAgZm9yIChsZXQgaSA9IG1heENpZHJQcmVmaXg7IGkgPj0gbWluQ2lkclByZWZpeDsgaS0tKSB7XG4vLyAgICByZXN1bHQucHVzaCguLi5zdGFydC5zcGxpdEludG8obmV3IGlwTnVtLklQdjRQcmVmaXgoQmlnSW50KGkpKSkubWFwKChyYW5nZSkgPT4gbmV3IE5ldHdvcmtBZGRyZXNzKHJhbmdlKSkpO1xuLy8gIH1cbi8vICByZXR1cm4gcmVzdWx0O1xuLy99XG4vL1xuLy9leHBvcnQgZnVuY3Rpb24gZmluZExvbmdlc3ROZXR3b3JrQWRkcmVzcyhhZGRyZXNzZXM6IE5ldHdvcmtBZGRyZXNzW10pOiBOZXR3b3JrQWRkcmVzc1tdIHtcbi8vICBpZiAoYWRkcmVzc2VzLmxlbmd0aCA9PT0gMCkge1xuLy8gICAgcmV0dXJuIFtdO1xuLy8gIH1cbi8vXG4vLyAgbGV0IGxvbmdlc3RQcmVmaXggPSBhZGRyZXNzZXNbMF0ucHJlZml4O1xuLy8gIGZvciAoY29uc3QgaXAgb2YgYWRkcmVzc2VzKSB7XG4vLyAgICBpZiAoaXAucHJlZml4ID4gbG9uZ2VzdFByZWZpeCkge1xuLy8gICAgICBsb25nZXN0UHJlZml4ID0gaXAucHJlZml4O1xuLy8gICAgfVxuLy8gIH1cbi8vXG4vLyAgcmV0dXJuIGFkZHJlc3Nlcy5maWx0ZXIoKGlwKSA9PiBpcC5wcmVmaXggPT09IGxvbmdlc3RQcmVmaXgpO1xuLy99XG4vL1xuLy9leHBvcnQgZnVuY3Rpb24gUHJpbnRUYWJsZShuZXR3b3JrQWRkcmVzc2VzOiBOZXR3b3JrQWRkcmVzc1tdKSB7XG4vLyAgY29uc3QgcHJlZml4ZXMgPSBBcnJheS5mcm9tKG5ldyBTZXQobmV0d29ya0FkZHJlc3Nlcy5tYXAoKGVudHJ5KSA9PiBlbnRyeS5wcmVmaXgpKSlcbi8vICAgIC5zb3J0KChhLCBiKSA9PiBhIC0gYikgLy8g44OX44Os44OV44Kj44OD44Kv44K544KS5piH6aCG44Gr5Lim44G55pu/44GIXG4vLyAgICAubWFwKChwcmVmaXgpID0+IGAvJHtwcmVmaXh9YCk7XG4vLyAgcHJlZml4ZXMucHVzaCgncmVzZXJ2ZWQnKTtcbi8vXG4vLyAgY29uc3QgaXBSb3dzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7fTtcbi8vICBuZXR3b3JrQWRkcmVzc2VzLmZvckVhY2goKGVudHJ5KSA9PiB7XG4vLyAgICBjb25zdCByb3dLZXkgPSBlbnRyeS5hZGRyZXNzO1xuLy8gICAgaWYgKCFpcFJvd3Nbcm93S2V5XSkge1xuLy8gICAgICBpcFJvd3Nbcm93S2V5XSA9IG5ldyBBcnJheShwcmVmaXhlcy5sZW5ndGgpLmZpbGwoJycpO1xuLy8gICAgfVxuLy8gICAgaWYgKGVudHJ5LnJlc2VydmVkKSB7XG4vLyAgICAgIGlwUm93c1tyb3dLZXldW3ByZWZpeGVzLmxlbmd0aCAtIDFdID0gZW50cnkubGFiZWwgfHwgJyc7XG4vLyAgICB9IGVsc2Uge1xuLy8gICAgICBjb25zdCBwcmVmaXhJbmRleCA9IHByZWZpeGVzLmluZGV4T2YoYC8ke2VudHJ5LnByZWZpeH1gKTtcbi8vICAgICAgaXBSb3dzW3Jvd0tleV1bcHJlZml4SW5kZXhdID0gZW50cnkuYWRkcmVzcztcbi8vICAgIH1cbi8vICB9KTtcbi8vXG4vLyAgY29uc3Qgcm93cyA9IE9iamVjdC52YWx1ZXMoaXBSb3dzKTtcbi8vXG4vLyAgY29uc3Qgb3V0cHV0ID0gdGFibGUoW3ByZWZpeGVzLCAuLi5yb3dzXSk7XG4vLyAgY29uc29sZS5sb2cob3V0cHV0KTtcbi8vfVxuLy9cbiJdfQ==
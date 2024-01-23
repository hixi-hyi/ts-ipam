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
exports.CompletePoolManager = exports.SummaryPoolManager = exports.ReservedManager = exports.ADDRESS_FORMAT_RANGE = exports.ADDRESS_FORMAT_CIDR = exports.CidrStringToIpAndPrefix = exports.CidrRangeFromCidr = exports.CidrRange = exports.NetworkAddress = exports.NETWORK_BLOCK_192 = exports.NETWORK_BLOCK_172 = exports.NETWORK_BLOCK_10 = exports.NetworkBlock = void 0;
const ipNum = __importStar(require("ip-num"));
const table_1 = require("table");
const MIN_CIDR_PREFIX = 8; // 10.0.0.0/8
const MAX_CIDR_PREFIX = 24; // 192.168.0.0/24
class NetworkBlock {
    constructor(address, prefix) {
        this.address = address;
        this.prefix = prefix;
        this.range = CidrRange(address, prefix);
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
        this.code = code;
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
        this.pool = ipNum.Pool.fromCidrRanges([this.block.range]);
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
    formatAddress(address) {
        const range = address.range;
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
        if (code && this.isReserved(code)) {
            throw new Error(`The code ${code} is already reserved.`);
        }
        this.reserved.push(new NetworkAddress(range, label, code));
        const isReserved = this.pool.removeOverlapping(ipNum.RangedSet.fromCidrRange(CidrRangeFromCidr(cidr)));
        if (!isReserved) {
            throw new Error(`Failed to allocate the address range ${cidr}.`);
        }
        return true;
    }
    getReservation(code) {
        if (code === '') {
            return undefined;
        }
        return this.reserved.find((entry) => entry.code === code);
    }
    isReserved(code) {
        if (code === '') {
            return false;
        }
        return this.getReservation(code) !== undefined;
    }
    printCsv() {
        const csv = this.getContents()
            .map((row) => row.join(','))
            .join('\n');
        console.log(csv);
    }
    printTable() {
        console.log((0, table_1.table)(this.getContents(), this.getTableConfig()));
    }
    collectAllNetworkAddresses() {
        const start = CidrRange(this.block.range.getFirst().toString(), this.start);
        const result = [];
        for (let i = this.end; i >= this.start; i--) {
            result.push(...start.splitInto(new ipNum.IPv4Prefix(BigInt(i))).map((range) => new NetworkAddress(range)));
        }
        return result;
    }
}
class ReservedManager extends AbstractManager {
    getTableConfig() {
        return {
            header: {
                content: `Reserved IP Address ${this.block.address}/${this.start}-${this.end}`,
            },
        };
    }
    getContents() {
        const header = ['address', 'label', 'code'];
        const rows = this.reserved
            .sort((a, b) => a.address.localeCompare(b.address))
            .map((entry) => [this.formatAddress(entry), entry.label || '', entry.code || '']);
        return [header, ...rows];
    }
}
exports.ReservedManager = ReservedManager;
class SummaryPoolManager extends AbstractManager {
    getTableConfig() {
        return {
            header: {
                content: `Summary Pool Address ${this.block.address}/${this.start}-${this.end}`,
            },
        };
    }
    getContents() {
        const header = ['address', 'label', 'code'];
        const start = CidrRange(this.block.range.getFirst().toString(), this.start);
        const networkAddresses = [];
        networkAddresses.push(...start.splitInto(new ipNum.IPv4Prefix(BigInt(this.end))).map((range) => new NetworkAddress(range)));
        const pool = ipNum.Pool.fromCidrRanges(networkAddresses.map((entry) => entry.range));
        this.reserved.forEach((entry) => {
            entry.range.splitInto(new ipNum.IPv4Prefix(BigInt(this.end))).forEach((range) => {
                pool.removeOverlapping(ipNum.RangedSet.fromCidrRange(range));
            });
        });
        const rs = pool.aggregate().getRanges();
        const free = [];
        rs.forEach((r) => {
            free.push(new NetworkAddress(r.toCidrRange()));
        });
        const aggregated = [...free, ...this.reserved];
        const rows = aggregated
            .sort((a, b) => Number(a.range.getFirst().getValue() - b.range.getFirst().getValue()))
            .map((entry) => [this.formatAddress(entry), entry.label || '', entry.code || '']);
        return [header, ...rows];
    }
}
exports.SummaryPoolManager = SummaryPoolManager;
class CompletePoolManager extends AbstractManager {
    constructor(block, start, end, config = {}) {
        super(block, start, end, config);
        this.networkAddresses = [];
        this.networkAddresses = this.collectAllNetworkAddresses();
    }
    getTableConfig() {
        return {
            header: {
                content: `Complete Pool Address ${this.block.address}/${this.start}-${this.end}`,
            },
        };
    }
    getContents() {
        const prefixes = Array.from(new Set(this.networkAddresses.map((entry) => entry.prefix)))
            .sort((a, b) => a - b)
            .map((prefix) => `/${prefix}`);
        prefixes.push('label', 'code');
        const ipRows = {};
        this.networkAddresses.forEach((entry) => {
            const rowKey = entry.address;
            if (!ipRows[rowKey]) {
                ipRows[rowKey] = new Array(prefixes.length).fill('');
            }
            const prefixIndex = prefixes.indexOf(`/${entry.prefix}`);
            ipRows[rowKey][prefixIndex] = this.formatAddress(entry);
        });
        this.reserved.forEach((entry) => {
            entry.range.splitInto(new ipNum.IPv4Prefix(BigInt(this.end))).forEach((range) => {
                const rowKey = range.getFirst().toString();
                ipRows[rowKey][prefixes.length - 2] = entry.label || '';
                ipRows[rowKey][prefixes.length - 1] = entry.code || '';
            });
        });
        const rows = Object.values(ipRows);
        return [prefixes, ...rows];
    }
}
exports.CompletePoolManager = CompletePoolManager;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXBhbS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pcGFtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsOENBQWdDO0FBQ2hDLGlDQUErQztBQUUvQyxNQUFNLGVBQWUsR0FBRyxDQUFDLENBQUMsQ0FBQyxhQUFhO0FBQ3hDLE1BQU0sZUFBZSxHQUFHLEVBQUUsQ0FBQyxDQUFDLGlCQUFpQjtBQUU3QyxNQUFhLFlBQVk7SUFJdkIsWUFBWSxPQUFlLEVBQUUsTUFBYztRQUN6QyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDMUMsQ0FBQztDQUNGO0FBVEQsb0NBU0M7QUFFWSxRQUFBLGdCQUFnQixHQUFHLElBQUksWUFBWSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNuRCxRQUFBLGlCQUFpQixHQUFHLElBQUksWUFBWSxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQztBQUN2RCxRQUFBLGlCQUFpQixHQUFHLElBQUksWUFBWSxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUVyRSxNQUFhLGNBQWM7SUFPekIsWUFBbUIsS0FBMEIsRUFBRSxLQUFjLEVBQUUsSUFBYTtRQUMxRSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUMzQyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDbEQsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIs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QUMsUUFBUSxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7SUFDN0IsQ0FBQztDQUNGO0FBdkNELGtEQXVDQztBQUNELEVBQUU7QUFDRixFQUFFO0FBQ0YsbUlBQW1JO0FBQ25JLDJEQUEyRDtBQUMzRCxzQkFBc0I7QUFDdEIsMERBQTBEO0FBQzFELGlIQUFpSDtBQUNqSCxLQUFLO0FBQ0wsa0JBQWtCO0FBQ2xCLEdBQUc7QUFDSCxFQUFFO0FBQ0YsNEZBQTRGO0FBQzVGLGlDQUFpQztBQUNqQyxnQkFBZ0I7QUFDaEIsS0FBSztBQUNMLEVBQUU7QUFDRiw0Q0FBNEM7QUFDNUMsaUNBQWlDO0FBQ2pDLHNDQUFzQztBQUN0QyxrQ0FBa0M7QUFDbEMsT0FBTztBQUNQLEtBQUs7QUFDTCxFQUFFO0FBQ0YsaUVBQWlFO0FBQ2pFLEdBQUc7QUFDSCxFQUFFO0FBQ0Ysa0VBQWtFO0FBQ2xFLHVGQUF1RjtBQUN2RiwrQ0FBK0M7QUFDL0MscUNBQXFDO0FBQ3JDLDhCQUE4QjtBQUM5QixFQUFFO0FBQ0YsZ0RBQWdEO0FBQ2hELHlDQUF5QztBQUN6QyxtQ0FBbUM7QUFDbkMsNEJBQTRCO0FBQzVCLDZEQUE2RDtBQUM3RCxPQUFPO0FBQ1AsMkJBQTJCO0FBQzNCLGdFQUFnRTtBQUNoRSxjQUFjO0FBQ2QsaUVBQWlFO0FBQ2pFLG9EQUFvRDtBQUNwRCxPQUFPO0FBQ1AsT0FBTztBQUNQLEVBQUU7QUFDRix1Q0FBdUM7QUFDdkMsRUFBRTtBQUNGLDhDQUE4QztBQUM5Qyx3QkFBd0I7QUFDeEIsR0FBRztBQUNILEVBQUUiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBpcE51bSBmcm9tICdpcC1udW0nO1xuaW1wb3J0IHsgdGFibGUsIFRhYmxlVXNlckNvbmZpZyB9IGZyb20gJ3RhYmxlJztcblxuY29uc3QgTUlOX0NJRFJfUFJFRklYID0gODsgLy8gMTAuMC4wLjAvOFxuY29uc3QgTUFYX0NJRFJfUFJFRklYID0gMjQ7IC8vIDE5Mi4xNjguMC4wLzI0XG5cbmV4cG9ydCBjbGFzcyBOZXR3b3JrQmxvY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgcmFuZ2U6IGlwTnVtLklQdjRDaWRyUmFuZ2U7XG4gIHB1YmxpYyByZWFkb25seSBhZGRyZXNzOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSBwcmVmaXg6IG51bWJlcjtcbiAgY29uc3RydWN0b3IoYWRkcmVzczogc3RyaW5nLCBwcmVmaXg6IG51bWJlcikge1xuICAgIHRoaXMuYWRkcmVzcyA9IGFkZHJlc3M7XG4gICAgdGhpcy5wcmVmaXggPSBwcmVmaXg7XG4gICAgdGhpcy5yYW5nZSA9IENpZHJSYW5nZShhZGRyZXNzLCBwcmVmaXgpO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBORVRXT1JLX0JMT0NLXzEwID0gbmV3IE5ldHdvcmtCbG9jaygnMTAuMC4wLjAnLCA4KTtcbmV4cG9ydCBjb25zdCBORVRXT1JLX0JMT0NLXzE3MiA9IG5ldyBOZXR3b3JrQmxvY2soJzE3Mi4xNi4wLjAnLCAxMik7XG5leHBvcnQgY29uc3QgTkVUV09SS19CTE9DS18xOTIgPSBuZXcgTmV0d29ya0Jsb2NrKCcxOTIuMTY4LjAuMCcsIDE2KTtcblxuZXhwb3J0IGNsYXNzIE5ldHdvcmtBZGRyZXNzIHtcbiAgcmFuZ2U6IGlwTnVtLklQdjRDaWRyUmFuZ2U7XG4gIGFkZHJlc3M6IHN0cmluZztcbiAgcHJlZml4OiBudW1iZXI7XG4gIGxhYmVsPzogc3RyaW5nO1xuICBjb2RlPzogc3RyaW5nO1xuXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihyYW5nZTogaXBOdW0uSVB2NENpZHJSYW5nZSwgbGFiZWw/OiBzdHJpbmcsIGNvZGU/OiBzdHJpbmcpIHtcbiAgICB0aGlzLnJhbmdlID0gcmFuZ2U7XG4gICAgdGhpcy5hZGRyZXNzID0gcmFuZ2UuZ2V0Rmlyc3QoKS50b1N0cmluZygpO1xuICAgIHRoaXMucHJlZml4ID0gTnVtYmVyKHJhbmdlLmNpZHJQcmVmaXguZ2V0VmFsdWUoKSk7XG4gICAgdGhpcy5sYWJlbCA9IGxhYmVsO1xuICAgIHRoaXMuY29kZSA9IGNvZGU7XG4gIH1cbiAgcHVibGljIGdldCBjaWRyKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMucmFuZ2UudG9DaWRyU3RyaW5nKCk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIENpZHJSYW5nZShhZGRyZXNzOiBzdHJpbmcsIHByZWZpeDogbnVtYmVyKTogaXBOdW0uSVB2NENpZHJSYW5nZSB7XG4gIGNvbnN0IHJhbmdlID0gbmV3IGlwTnVtLklQdjRDaWRyUmFuZ2UoaXBOdW0uSVB2NC5mcm9tRGVjaW1hbERvdHRlZFN0cmluZyhhZGRyZXNzKSwgaXBOdW0uSVB2NFByZWZpeC5mcm9tTnVtYmVyKEJpZ0ludChwcmVmaXgpKSk7XG4gIHJldHVybiByYW5nZTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBDaWRyUmFuZ2VGcm9tQ2lkcihjaWRyOiBzdHJpbmcpOiBpcE51bS5JUHY0Q2lkclJhbmdlIHtcbiAgcmV0dXJuIGlwTnVtLklQdjRDaWRyUmFuZ2UuZnJvbUNpZHIoY2lkcik7XG59XG5leHBvcnQgZnVuY3Rpb24gQ2lkclN0cmluZ1RvSXBBbmRQcmVmaXgoY2lkcjogc3RyaW5nKTogW3N0cmluZywgbnVtYmVyXSB7XG4gIGNvbnN0IFthZGRyZXNzLCBwcmVmaXhdID0gY2lkci5zcGxpdCgnLycpO1xuICByZXR1cm4gW2FkZHJlc3MsIE51bWJlcihwcmVmaXgpXTtcbn1cblxudHlwZSBBZGRyZXNzRm9ybWF0ID0gJ0NJRFInIHwgJ1JBTkdFJztcbmV4cG9ydCBjb25zdCBBRERSRVNTX0ZPUk1BVF9DSURSOiBBZGRyZXNzRm9ybWF0ID0gJ0NJRFInO1xuZXhwb3J0IGNvbnN0IEFERFJFU1NfRk9STUFUX1JBTkdFOiBBZGRyZXNzRm9ybWF0ID0gJ1JBTkdFJztcblxuZXhwb3J0IGludGVyZmFjZSBNYW5hZ2VyQ29uZmlnUHJvcHMge1xuICBhZGRyZXNzRm9ybWF0PzogQWRkcmVzc0Zvcm1hdDtcbn1cbmFic3RyYWN0IGNsYXNzIEFic3RyYWN0TWFuYWdlciB7XG4gIHB1YmxpYyByZWFkb25seSBibG9jazogTmV0d29ya0Jsb2NrO1xuICBwdWJsaWMgcmVhZG9ubHkgc3RhcnQ6IG51bWJlcjtcbiAgcHVibGljIHJlYWRvbmx5IGVuZDogbnVtYmVyO1xuICBwdWJsaWMgcmVhZG9ubHkgcmVzZXJ2ZWQ6IE5ldHdvcmtBZGRyZXNzW10gPSBbXTtcbiAgcHVibGljIHJlYWRvbmx5IGFkZHJlc3NGb3JtYXQ6IEFkZHJlc3NGb3JtYXQgPSBBRERSRVNTX0ZPUk1BVF9DSURSO1xuICBwdWJsaWMgcmVhZG9ubHkgcG9vbDogaXBOdW0uUG9vbDxpcE51bS5SYW5nZWRTZXQ8aXBOdW0uSVB2ND4+O1xuXG4gIGNvbnN0cnVjdG9yKGJsb2NrOiBOZXR3b3JrQmxvY2ssIHN0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyLCBjb25maWc6IE1hbmFnZXJDb25maWdQcm9wcyA9IHt9KSB7XG4gICAgdGhpcy5ibG9jayA9IGJsb2NrO1xuICAgIHRoaXMuc3RhcnQgPSBzdGFydDtcbiAgICB0aGlzLmVuZCA9IGVuZDtcbiAgICB0aGlzLmFkZHJlc3NGb3JtYXQgPSBjb25maWcuYWRkcmVzc0Zvcm1hdCA/PyBBRERSRVNTX0ZPUk1BVF9DSURSO1xuICAgIHRoaXMucG9vbCA9IGlwTnVtLlBvb2wuZnJvbUNpZHJSYW5nZXMoW3RoaXMuYmxvY2sucmFuZ2VdKTtcbiAgICB0aGlzLnZhbGlkYXRlKCk7XG4gIH1cbiAgcHJpdmF0ZSB2YWxpZGF0ZSgpIHtcbiAgICBpZiAodGhpcy5zdGFydCA+IHRoaXMuZW5kKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3N0YXJ0IG11c3QgYmUgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIGVuZCcpO1xuICAgIH1cbiAgICBpZiAodGhpcy5zdGFydCA8IE1JTl9DSURSX1BSRUZJWCB8fCB0aGlzLnN0YXJ0ID4gTUFYX0NJRFJfUFJFRklYKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFN0YXJ0IG11c3QgYmUgYmV0d2VlbiAke01JTl9DSURSX1BSRUZJWH0gYW5kICR7TUFYX0NJRFJfUFJFRklYfSwgaW5jbHVzaXZlLmApO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmVuZCA8IE1JTl9DSURSX1BSRUZJWCB8fCB0aGlzLmVuZCA+IE1BWF9DSURSX1BSRUZJWCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFbmQgbXVzdCBiZSBiZXR3ZWVuICR7TUlOX0NJRFJfUFJFRklYfSBhbmQgJHtNQVhfQ0lEUl9QUkVGSVh9LCBpbmNsdXNpdmUuYCk7XG4gICAgfVxuICB9XG4gIHByb3RlY3RlZCBmb3JtYXRBZGRyZXNzKGFkZHJlc3M6IE5ldHdvcmtBZGRyZXNzKTogc3RyaW5nIHtcbiAgICBjb25zdCByYW5nZSA9IGFkZHJlc3MucmFuZ2U7XG4gICAgaWYgKHRoaXMuYWRkcmVzc0Zvcm1hdCA9PT0gQUREUkVTU19GT1JNQVRfQ0lEUikge1xuICAgICAgcmV0dXJuIHJhbmdlLnRvQ2lkclN0cmluZygpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmFuZ2UudG9SYW5nZVN0cmluZygpO1xuICAgIH1cbiAgfVxuICBwdWJsaWMgcmVzZXJ2ZShjaWRyOiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcsIGNvZGU/OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCBbYWRkcmVzcywgcHJlZml4XSA9IENpZHJTdHJpbmdUb0lwQW5kUHJlZml4KGNpZHIpO1xuICAgIGNvbnN0IHJhbmdlID0gQ2lkclJhbmdlKGFkZHJlc3MsIHByZWZpeCk7XG4gICAgY29uc3QgbmV0d29ya0FkZHJlc3MgPSByYW5nZS5nZXRGaXJzdCgpLnRvU3RyaW5nKCk7XG4gICAgaWYgKG5ldHdvcmtBZGRyZXNzICE9PSBhZGRyZXNzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSBhZGRyZXNzICR7YWRkcmVzc30vJHtwcmVmaXh9IGlzIG5vdCBhIHZhbGlkIG5ldHdvcmsgYWRkcmVzcy4gTWF5YmUgeW91IG1lYW50ICR7bmV0d29ya0FkZHJlc3N9LyR7cHJlZml4fT9gKTtcbiAgICB9XG4gICAgaWYgKHByZWZpeCA8IHRoaXMuc3RhcnQgfHwgcHJlZml4ID4gdGhpcy5lbmQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlIHByZWZpeCAke3ByZWZpeH0gaXMgbm90IGJldHdlZW4gJHt0aGlzLnN0YXJ0fSBhbmQgJHt0aGlzLmVuZH0sIGluY2x1c2l2ZS5gKTtcbiAgICB9XG4gICAgaWYgKGNvZGUgJiYgdGhpcy5pc1Jlc2VydmVkKGNvZGUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSBjb2RlICR7Y29kZX0gaXMgYWxyZWFkeSByZXNlcnZlZC5gKTtcbiAgICB9XG4gICAgdGhpcy5yZXNlcnZlZC5wdXNoKG5ldyBOZXR3b3JrQWRkcmVzcyhyYW5nZSwgbGFiZWwsIGNvZGUpKTtcblxuICAgIGNvbnN0IGlzUmVzZXJ2ZWQgPSB0aGlzLnBvb2wucmVtb3ZlT3ZlcmxhcHBpbmcoaXBOdW0uUmFuZ2VkU2V0LmZyb21DaWRyUmFuZ2UoQ2lkclJhbmdlRnJvbUNpZHIoY2lkcikpKTtcbiAgICBpZiAoIWlzUmVzZXJ2ZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGFsbG9jYXRlIHRoZSBhZGRyZXNzIHJhbmdlICR7Y2lkcn0uYCk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHB1YmxpYyBnZXRSZXNlcnZhdGlvbihjb2RlOiBzdHJpbmcpOiBOZXR3b3JrQWRkcmVzcyB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKGNvZGUgPT09ICcnKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5yZXNlcnZlZC5maW5kKChlbnRyeSkgPT4gZW50cnkuY29kZSA9PT0gY29kZSk7XG4gIH1cbiAgcHVibGljIGlzUmVzZXJ2ZWQoY29kZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgaWYgKGNvZGUgPT09ICcnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmdldFJlc2VydmF0aW9uKGNvZGUpICE9PSB1bmRlZmluZWQ7XG4gIH1cbiAgcHVibGljIHByaW50Q3N2KCk6IHZvaWQge1xuICAgIGNvbnN0IGNzdiA9IHRoaXMuZ2V0Q29udGVudHMoKVxuICAgICAgLm1hcCgocm93KSA9PiByb3cuam9pbignLCcpKVxuICAgICAgLmpvaW4oJ1xcbicpO1xuICAgIGNvbnNvbGUubG9nKGNzdik7XG4gIH1cbiAgcHVibGljIHByaW50VGFibGUoKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2codGFibGUodGhpcy5nZXRDb250ZW50cygpLCB0aGlzLmdldFRhYmxlQ29uZmlnKCkpKTtcbiAgfVxuICBwcm90ZWN0ZWQgYWJzdHJhY3QgZ2V0VGFibGVDb25maWcoKTogVGFibGVVc2VyQ29uZmlnO1xuICBwcm90ZWN0ZWQgYWJzdHJhY3QgZ2V0Q29udGVudHMoKTogc3RyaW5nW11bXTtcbiAgcHJvdGVjdGVkIGNvbGxlY3RBbGxOZXR3b3JrQWRkcmVzc2VzKCk6IE5ldHdvcmtBZGRyZXNzW10ge1xuICAgIGNvbnN0IHN0YXJ0ID0gQ2lkclJhbmdlKHRoaXMuYmxvY2sucmFuZ2UuZ2V0Rmlyc3QoKS50b1N0cmluZygpLCB0aGlzLnN0YXJ0KTtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gdGhpcy5lbmQ7IGkgPj0gdGhpcy5zdGFydDsgaS0tKSB7XG4gICAgICByZXN1bHQucHVzaCguLi5zdGFydC5zcGxpdEludG8obmV3IGlwTnVtLklQdjRQcmVmaXgoQmlnSW50KGkpKSkubWFwKChyYW5nZSkgPT4gbmV3IE5ldHdvcmtBZGRyZXNzKHJhbmdlKSkpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBSZXNlcnZlZE1hbmFnZXIgZXh0ZW5kcyBBYnN0cmFjdE1hbmFnZXIge1xuICBwcm90ZWN0ZWQgZ2V0VGFibGVDb25maWcoKTogVGFibGVVc2VyQ29uZmlnIHtcbiAgICByZXR1cm4ge1xuICAgICAgaGVhZGVyOiB7XG4gICAgICAgIGNvbnRlbnQ6IGBSZXNlcnZlZCBJUCBBZGRyZXNzICR7dGhpcy5ibG9jay5hZGRyZXNzfS8ke3RoaXMuc3RhcnR9LSR7dGhpcy5lbmR9YCxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuICBwcm90ZWN0ZWQgZ2V0Q29udGVudHMoKTogc3RyaW5nW11bXSB7XG4gICAgY29uc3QgaGVhZGVyID0gWydhZGRyZXNzJywgJ2xhYmVsJywgJ2NvZGUnXTtcbiAgICBjb25zdCByb3dzID0gdGhpcy5yZXNlcnZlZFxuICAgICAgLnNvcnQoKGEsIGIpID0+IGEuYWRkcmVzcy5sb2NhbGVDb21wYXJlKGIuYWRkcmVzcykpXG4gICAgICAubWFwKChlbnRyeSkgPT4gW3RoaXMuZm9ybWF0QWRkcmVzcyhlbnRyeSksIGVudHJ5LmxhYmVsIHx8ICcnLCBlbnRyeS5jb2RlIHx8ICcnXSk7XG4gICAgcmV0dXJuIFtoZWFkZXIsIC4uLnJvd3NdO1xuICB9XG59XG5leHBvcnQgY2xhc3MgU3VtbWFyeVBvb2xNYW5hZ2VyIGV4dGVuZHMgQWJzdHJhY3RNYW5hZ2VyIHtcbiAgcHJvdGVjdGVkIGdldFRhYmxlQ29uZmlnKCk6IFRhYmxlVXNlckNvbmZpZyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGhlYWRlcjoge1xuICAgICAgICBjb250ZW50OiBgU3VtbWFyeSBQb29sIEFkZHJlc3MgJHt0aGlzLmJsb2NrLmFkZHJlc3N9LyR7dGhpcy5zdGFydH0tJHt0aGlzLmVuZH1gLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG4gIHByb3RlY3RlZCBnZXRDb250ZW50cygpOiBzdHJpbmdbXVtdIHtcbiAgICBjb25zdCBoZWFkZXIgPSBbJ2FkZHJlc3MnLCAnbGFiZWwnLCAnY29kZSddO1xuICAgIGNvbnN0IHN0YXJ0ID0gQ2lkclJhbmdlKHRoaXMuYmxvY2sucmFuZ2UuZ2V0Rmlyc3QoKS50b1N0cmluZygpLCB0aGlzLnN0YXJ0KTtcbiAgICBjb25zdCBuZXR3b3JrQWRkcmVzc2VzID0gW107XG4gICAgbmV0d29ya0FkZHJlc3Nlcy5wdXNoKC4uLnN0YXJ0LnNwbGl0SW50byhuZXcgaXBOdW0uSVB2NFByZWZpeChCaWdJbnQodGhpcy5lbmQpKSkubWFwKChyYW5nZSkgPT4gbmV3IE5ldHdvcmtBZGRyZXNzKHJhbmdlKSkpO1xuICAgIGNvbnN0IHBvb2wgPSBpcE51bS5Qb29sLmZyb21DaWRyUmFuZ2VzKG5ldHdvcmtBZGRyZXNzZXMubWFwKChlbnRyeSkgPT4gZW50cnkucmFuZ2UpKTtcbiAgICB0aGlzLnJlc2VydmVkLmZvckVhY2goKGVudHJ5KSA9PiB7XG4gICAgICBlbnRyeS5yYW5nZS5zcGxpdEludG8obmV3IGlwTnVtLklQdjRQcmVmaXgoQmlnSW50KHRoaXMuZW5kKSkpLmZvckVhY2goKHJhbmdlKSA9PiB7XG4gICAgICAgIHBvb2wucmVtb3ZlT3ZlcmxhcHBpbmcoaXBOdW0uUmFuZ2VkU2V0LmZyb21DaWRyUmFuZ2UocmFuZ2UpKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIGNvbnN0IHJzID0gcG9vbC5hZ2dyZWdhdGUoKS5nZXRSYW5nZXMoKTtcbiAgICBjb25zdCBmcmVlOiBOZXR3b3JrQWRkcmVzc1tdID0gW107XG4gICAgcnMuZm9yRWFjaCgocikgPT4ge1xuICAgICAgZnJlZS5wdXNoKG5ldyBOZXR3b3JrQWRkcmVzcyhyLnRvQ2lkclJhbmdlKCkgYXMgaXBOdW0uSVB2NENpZHJSYW5nZSkpO1xuICAgIH0pO1xuICAgIGNvbnN0IGFnZ3JlZ2F0ZWQgPSBbLi4uZnJlZSwgLi4udGhpcy5yZXNlcnZlZF07XG4gICAgY29uc3Qgcm93cyA9IGFnZ3JlZ2F0ZWRcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBOdW1iZXIoYS5yYW5nZS5nZXRGaXJzdCgpLmdldFZhbHVlKCkgLSBiLnJhbmdlLmdldEZpcnN0KCkuZ2V0VmFsdWUoKSkpXG4gICAgICAubWFwKChlbnRyeSkgPT4gW3RoaXMuZm9ybWF0QWRkcmVzcyhlbnRyeSksIGVudHJ5LmxhYmVsIHx8ICcnLCBlbnRyeS5jb2RlIHx8ICcnXSk7XG4gICAgcmV0dXJuIFtoZWFkZXIsIC4uLnJvd3NdO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDb21wbGV0ZVBvb2xNYW5hZ2VyIGV4dGVuZHMgQWJzdHJhY3RNYW5hZ2VyIHtcbiAgcHVibGljIHJlYWRvbmx5IG5ldHdvcmtBZGRyZXNzZXM6IE5ldHdvcmtBZGRyZXNzW10gPSBbXTtcbiAgY29uc3RydWN0b3IoYmxvY2s6IE5ldHdvcmtCbG9jaywgc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIsIGNvbmZpZzogTWFuYWdlckNvbmZpZ1Byb3BzID0ge30pIHtcbiAgICBzdXBlcihibG9jaywgc3RhcnQsIGVuZCwgY29uZmlnKTtcbiAgICB0aGlzLm5ldHdvcmtBZGRyZXNzZXMgPSB0aGlzLmNvbGxlY3RBbGxOZXR3b3JrQWRkcmVzc2VzKCk7XG4gIH1cbiAgcHJvdGVjdGVkIGdldFRhYmxlQ29uZmlnKCk6IFRhYmxlVXNlckNvbmZpZyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGhlYWRlcjoge1xuICAgICAgICBjb250ZW50OiBgQ29tcGxldGUgUG9vbCBBZGRyZXNzICR7dGhpcy5ibG9jay5hZGRyZXNzfS8ke3RoaXMuc3RhcnR9LSR7dGhpcy5lbmR9YCxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuICBwcm90ZWN0ZWQgZ2V0Q29udGVudHMoKTogc3RyaW5nW11bXSB7XG4gICAgY29uc3QgcHJlZml4ZXMgPSBBcnJheS5mcm9tKG5ldyBTZXQodGhpcy5uZXR3b3JrQWRkcmVzc2VzLm1hcCgoZW50cnkpID0+IGVudHJ5LnByZWZpeCkpKVxuICAgICAgLnNvcnQoKGEsIGIpID0+IGEgLSBiKVxuICAgICAgLm1hcCgocHJlZml4KSA9PiBgLyR7cHJlZml4fWApO1xuICAgIHByZWZpeGVzLnB1c2goJ2xhYmVsJywgJ2NvZGUnKTtcblxuICAgIGNvbnN0IGlwUm93czogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge307XG4gICAgdGhpcy5uZXR3b3JrQWRkcmVzc2VzLmZvckVhY2goKGVudHJ5KSA9PiB7XG4gICAgICBjb25zdCByb3dLZXkgPSBlbnRyeS5hZGRyZXNzO1xuICAgICAgaWYgKCFpcFJvd3Nbcm93S2V5XSkge1xuICAgICAgICBpcFJvd3Nbcm93S2V5XSA9IG5ldyBBcnJheShwcmVmaXhlcy5sZW5ndGgpLmZpbGwoJycpO1xuICAgICAgfVxuICAgICAgY29uc3QgcHJlZml4SW5kZXggPSBwcmVmaXhlcy5pbmRleE9mKGAvJHtlbnRyeS5wcmVmaXh9YCk7XG4gICAgICBpcFJvd3Nbcm93S2V5XVtwcmVmaXhJbmRleF0gPSB0aGlzLmZvcm1hdEFkZHJlc3MoZW50cnkpO1xuICAgIH0pO1xuICAgIHRoaXMucmVzZXJ2ZWQuZm9yRWFjaCgoZW50cnkpID0+IHtcbiAgICAgIGVudHJ5LnJhbmdlLnNwbGl0SW50byhuZXcgaXBOdW0uSVB2NFByZWZpeChCaWdJbnQodGhpcy5lbmQpKSkuZm9yRWFjaCgocmFuZ2UpID0+IHtcbiAgICAgICAgY29uc3Qgcm93S2V5ID0gcmFuZ2UuZ2V0Rmlyc3QoKS50b1N0cmluZygpO1xuICAgICAgICBpcFJvd3Nbcm93S2V5XVtwcmVmaXhlcy5sZW5ndGggLSAyXSA9IGVudHJ5LmxhYmVsIHx8ICcnO1xuICAgICAgICBpcFJvd3Nbcm93S2V5XVtwcmVmaXhlcy5sZW5ndGggLSAxXSA9IGVudHJ5LmNvZGUgfHwgJyc7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHJvd3MgPSBPYmplY3QudmFsdWVzKGlwUm93cyk7XG4gICAgcmV0dXJuIFtwcmVmaXhlcywgLi4ucm93c107XG4gIH1cbn1cbi8vXG4vL1xuLy9leHBvcnQgZnVuY3Rpb24gQ29sbGVjdE5ldHdvcmtBZGRyZXNzZXMobmV0d29ya0FkZHJlc3M6IHN0cmluZywgbWluQ2lkclByZWZpeDogbnVtYmVyLCBtYXhDaWRyUHJlZml4OiBudW1iZXIpOiBOZXR3b3JrQWRkcmVzc1tdIHtcbi8vICBjb25zdCBzdGFydCA9IENpZHJSYW5nZShuZXR3b3JrQWRkcmVzcywgbWluQ2lkclByZWZpeCk7XG4vLyAgY29uc3QgcmVzdWx0ID0gW107XG4vLyAgZm9yIChsZXQgaSA9IG1heENpZHJQcmVmaXg7IGkgPj0gbWluQ2lkclByZWZpeDsgaS0tKSB7XG4vLyAgICByZXN1bHQucHVzaCguLi5zdGFydC5zcGxpdEludG8obmV3IGlwTnVtLklQdjRQcmVmaXgoQmlnSW50KGkpKSkubWFwKChyYW5nZSkgPT4gbmV3IE5ldHdvcmtBZGRyZXNzKHJhbmdlKSkpO1xuLy8gIH1cbi8vICByZXR1cm4gcmVzdWx0O1xuLy99XG4vL1xuLy9leHBvcnQgZnVuY3Rpb24gZmluZExvbmdlc3ROZXR3b3JrQWRkcmVzcyhhZGRyZXNzZXM6IE5ldHdvcmtBZGRyZXNzW10pOiBOZXR3b3JrQWRkcmVzc1tdIHtcbi8vICBpZiAoYWRkcmVzc2VzLmxlbmd0aCA9PT0gMCkge1xuLy8gICAgcmV0dXJuIFtdO1xuLy8gIH1cbi8vXG4vLyAgbGV0IGxvbmdlc3RQcmVmaXggPSBhZGRyZXNzZXNbMF0ucHJlZml4O1xuLy8gIGZvciAoY29uc3QgaXAgb2YgYWRkcmVzc2VzKSB7XG4vLyAgICBpZiAoaXAucHJlZml4ID4gbG9uZ2VzdFByZWZpeCkge1xuLy8gICAgICBsb25nZXN0UHJlZml4ID0gaXAucHJlZml4O1xuLy8gICAgfVxuLy8gIH1cbi8vXG4vLyAgcmV0dXJuIGFkZHJlc3Nlcy5maWx0ZXIoKGlwKSA9PiBpcC5wcmVmaXggPT09IGxvbmdlc3RQcmVmaXgpO1xuLy99XG4vL1xuLy9leHBvcnQgZnVuY3Rpb24gUHJpbnRUYWJsZShuZXR3b3JrQWRkcmVzc2VzOiBOZXR3b3JrQWRkcmVzc1tdKSB7XG4vLyAgY29uc3QgcHJlZml4ZXMgPSBBcnJheS5mcm9tKG5ldyBTZXQobmV0d29ya0FkZHJlc3Nlcy5tYXAoKGVudHJ5KSA9PiBlbnRyeS5wcmVmaXgpKSlcbi8vICAgIC5zb3J0KChhLCBiKSA9PiBhIC0gYikgLy8g44OX44Os44OV44Kj44OD44Kv44K544KS5piH6aCG44Gr5Lim44G55pu/44GIXG4vLyAgICAubWFwKChwcmVmaXgpID0+IGAvJHtwcmVmaXh9YCk7XG4vLyAgcHJlZml4ZXMucHVzaCgncmVzZXJ2ZWQnKTtcbi8vXG4vLyAgY29uc3QgaXBSb3dzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7fTtcbi8vICBuZXR3b3JrQWRkcmVzc2VzLmZvckVhY2goKGVudHJ5KSA9PiB7XG4vLyAgICBjb25zdCByb3dLZXkgPSBlbnRyeS5hZGRyZXNzO1xuLy8gICAgaWYgKCFpcFJvd3Nbcm93S2V5XSkge1xuLy8gICAgICBpcFJvd3Nbcm93S2V5XSA9IG5ldyBBcnJheShwcmVmaXhlcy5sZW5ndGgpLmZpbGwoJycpO1xuLy8gICAgfVxuLy8gICAgaWYgKGVudHJ5LnJlc2VydmVkKSB7XG4vLyAgICAgIGlwUm93c1tyb3dLZXldW3ByZWZpeGVzLmxlbmd0aCAtIDFdID0gZW50cnkubGFiZWwgfHwgJyc7XG4vLyAgICB9IGVsc2Uge1xuLy8gICAgICBjb25zdCBwcmVmaXhJbmRleCA9IHByZWZpeGVzLmluZGV4T2YoYC8ke2VudHJ5LnByZWZpeH1gKTtcbi8vICAgICAgaXBSb3dzW3Jvd0tleV1bcHJlZml4SW5kZXhdID0gZW50cnkuYWRkcmVzcztcbi8vICAgIH1cbi8vICB9KTtcbi8vXG4vLyAgY29uc3Qgcm93cyA9IE9iamVjdC52YWx1ZXMoaXBSb3dzKTtcbi8vXG4vLyAgY29uc3Qgb3V0cHV0ID0gdGFibGUoW3ByZWZpeGVzLCAuLi5yb3dzXSk7XG4vLyAgY29uc29sZS5sb2cob3V0cHV0KTtcbi8vfVxuLy9cbiJdfQ==
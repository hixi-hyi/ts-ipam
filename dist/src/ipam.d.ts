import * as ipNum from 'ip-num';
export declare class NetworkBlock {
    readonly range: ipNum.IPv4CidrRange;
    constructor(ip: string, prefix: number);
}
export declare const NETWORK_BLOCK_10: NetworkBlock;
export declare const NETWORK_BLOCK_172: NetworkBlock;
export declare const NETWORK_BLOCK_192: NetworkBlock;
export declare class NetworkAddress {
    range: ipNum.IPv4CidrRange;
    address: string;
    prefix: number;
    label: string;
    code: string;
    constructor(range: ipNum.IPv4CidrRange, label: string, code?: string);
    get cidr(): string;
}
export declare function CidrRange(address: string, prefix: number): ipNum.IPv4CidrRange;
export declare function CidrRangeFromCidr(cidr: string): ipNum.IPv4CidrRange;
export declare function CidrStringToIpAndPrefix(cidr: string): [string, number];
type AddressFormat = 'CIDR' | 'RANGE';
export declare const ADDRESS_FORMAT_CIDR: AddressFormat;
export declare const ADDRESS_FORMAT_RANGE: AddressFormat;
export interface ManagerConfigProps {
    addressFormat?: AddressFormat;
}
declare abstract class AbstractManager {
    readonly block: NetworkBlock;
    readonly start: number;
    readonly end: number;
    readonly reserved: NetworkAddress[];
    readonly addressFormat: AddressFormat;
    constructor(block: NetworkBlock, start: number, end: number, config?: ManagerConfigProps);
    private validate;
    protected formatAddress(range: ipNum.IPv4CidrRange): string;
    reserve(cidr: string, label: string, code?: string): boolean;
    getReserve(code: string): NetworkAddress | undefined;
    hasReserve(code: string): boolean;
    printCsv(): void;
    abstract printTable(): void;
    protected abstract getContents(): string[][];
}
export declare class ReservedManager extends AbstractManager {
    readonly pool: ipNum.Pool<ipNum.RangedSet<ipNum.IPv4>>;
    constructor(block: NetworkBlock, start: number, end: number, config?: ManagerConfigProps);
    reserve(cidr: string, label: string, code?: string): boolean;
    printTable(): void;
    protected getContents(): string[][];
}
export {};

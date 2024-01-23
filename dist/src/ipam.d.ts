import * as ipNum from 'ip-num';
import { TableUserConfig } from 'table';
export declare class NetworkBlock {
    readonly range: ipNum.IPv4CidrRange;
    readonly address: string;
    readonly prefix: number;
    constructor(address: string, prefix: number);
}
export declare const NETWORK_BLOCK_10: NetworkBlock;
export declare const NETWORK_BLOCK_172: NetworkBlock;
export declare const NETWORK_BLOCK_192: NetworkBlock;
export declare class NetworkAddress {
    range: ipNum.IPv4CidrRange;
    address: string;
    prefix: number;
    label?: string;
    code?: string;
    constructor(range: ipNum.IPv4CidrRange, label?: string, code?: string);
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
    readonly pool: ipNum.Pool<ipNum.RangedSet<ipNum.IPv4>>;
    constructor(block: NetworkBlock, start: number, end: number, config?: ManagerConfigProps);
    private validate;
    protected formatAddress(address: NetworkAddress): string;
    reserve(cidr: string, label: string, code?: string): boolean;
    getReservation(code: string): NetworkAddress | undefined;
    isReserved(code: string): boolean;
    printCsv(): void;
    printTable(): void;
    protected abstract getTableConfig(): TableUserConfig;
    protected abstract getContents(): string[][];
    protected collectAllNetworkAddresses(): NetworkAddress[];
}
export declare class ReservedManager extends AbstractManager {
    protected getTableConfig(): TableUserConfig;
    protected getContents(): string[][];
}
export declare class SummaryPoolManager extends AbstractManager {
    protected getTableConfig(): TableUserConfig;
    protected getContents(): string[][];
}
export declare class CompletePoolManager extends AbstractManager {
    readonly networkAddresses: NetworkAddress[];
    constructor(block: NetworkBlock, start: number, end: number, config?: ManagerConfigProps);
    protected getTableConfig(): TableUserConfig;
    protected getContents(): string[][];
}
export {};

import * as ipNum from 'ip-num';

export function CidrRange(address: string, prefix: number): ipNum.IPv4CidrRange {
  const range = new ipNum.IPv4CidrRange(ipNum.IPv4.fromDecimalDottedString(address), ipNum.IPv4Prefix.fromNumber(BigInt(prefix)));
  return range;
}

export function CollectNetworkAddresses(networkAddress: string, minCidrPrefix: number, maxCidrPrefix: number): string[] {
  function iter(range: ipNum.IPv4CidrRange, maxCidrPrefix: number): string[] {
    if (range.cidrPrefix.getValue() === BigInt(maxCidrPrefix)) {
      return [];
    }
    const result = [range.getFirst().toString()];
    const [first, second] = range.split();
    return result.concat(iter(first, maxCidrPrefix), iter(second, maxCidrPrefix));
  }

  const range = CidrRange(networkAddress, minCidrPrefix);
  return Array.from(new Set(iter(range, maxCidrPrefix + 1)));
}

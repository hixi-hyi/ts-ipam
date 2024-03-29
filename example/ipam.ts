import * as ipam from '../src/ipam';
import * as ipNum from 'ip-num';

const managerProps: [ipam.NetworkBlock, number, number, ipam.ManagerConfigProps] = [
  ipam.NETWORK_BLOCK_10,
  16,
  24,
  { addressFormat: ipam.ADDRESS_FORMAT_CIDR },
];
const managers = [
  new ipam.ReservedManager(...managerProps),
  new ipam.SummaryPoolManager(...managerProps),
  new ipam.CompletePoolManager(...managerProps),
];
for (const manager of managers) {
  manager.reserve('10.0.0.0/24', 'production for hixi', 'prod-hixi');
  manager.reserve('10.0.2.0/23', 'development for hixi', 'dev-hixi');
  manager.printTable();
}

//
//manager = new ipam.SummaryPoolManager({ block: ipam.BLOCK_10, start: 8, end: 24, addressFormat: ipam.ADDRESS_FORMAT_RANGE });
//manager.reserve('10.0.0.0/10', 'development for hixi', 'dev-hixi');
//manager.reserve('10.128.0.0/10', 'development for hixi', 'prod-hixi2');
//manager.printTable();

//const block = new ipam.Block10();
//const manager = new ipam.Manager({ blocks: [block, new ipam.Block172()], start: 8, end: 10 });
//const networkAddress = ipam.CollectNetworkAddresses('10.0.0.0', 10, 13);
//const smallestNetworkAddress = ipam.findLongestNetworkAddress(networkAddress);
//const reserves = [ipam.NetworkAddress.reserve('10.0.0.0', 11, 'dev')];
//for (const reserve of reserves) {
//  for (const na of smallestNetworkAddress) {
//    if (reserve.range.contains(na.range)) {
//      networkAddress.push(ipam.NetworkAddress.reserve(na.address, na.prefix, 'dev'));
//    }
//  }
//}
////ipam.PrintTable(networkAddress);
////
//function print(msg: string, pool) {
//  console.log(msg);
//  for (const range of pool.getRanges()) {
//    console.log(range.toCidrRange().toRangeString());
//  }
//  console.log('---');
//}
//
//const block = ipam.CidrRange('10.0.0.0', 10);
//let pool = ipNum.Pool.fromCidrRanges([block]);
//print('original', pool);
//let removed;
//removed = pool.removeOverlapping(ipNum.RangedSet.fromCidrRange(ipNum.IPv4CidrRange.fromCidr('10.16.0.0/12')));
//console.log(removed);
//removed = pool.removeOverlapping(ipNum.RangedSet.fromCidrRange(ipNum.IPv4CidrRange.fromCidr('10.32.0.0/12')));
//console.log(removed);
//removed = pool.removeOverlapping(ipNum.RangedSet.fromCidrRange(ipNum.IPv4CidrRange.fromCidr('10.40.0.0/13')));
//console.log(removed);
//let aggregated = pool.aggregate();
////pool.removeExact(ipNum.RangedSet.fromCidrRange(ipNum.IPv4CidrRange.fromCidr('10.48.0.0/13')));
//print('remove', aggregated);

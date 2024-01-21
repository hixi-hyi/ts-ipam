import { NetworkAddress } from './../src/ipam';
import { table } from 'table';
import * as ipam from '../src/ipam';

//const block = new ipam.Block10();
//const manager = new ipam.Manager({ blocks: [block, new ipam.Block172()], start: 8, end: 10 });
const networkAddress = ipam.CollectNetworkAddresses('10.0.0.0', 10, 13);
const smallestNetworkAddress = ipam.findLongestNetworkAddress(networkAddress);
const reserves = [ipam.NetworkAddress.reserve('10.0.0.0', 11, 'dev')];
for (const reserve of reserves) {
  for (const na of smallestNetworkAddress) {
    if (reserve.range.contains(na.range)) {
      networkAddress.push(ipam.NetworkAddress.reserve(na.address, na.prefix, 'dev'));
    }
  }
}
//console.log(networkAddress);
//console.log(smallestNetworkAddress);
ipam.PrintTable(networkAddress);

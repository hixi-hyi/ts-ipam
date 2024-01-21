import { NetworkAddress } from './../src/ipam';
import { table } from 'table';
import * as ipam from '../src/ipam';

//const block = new ipam.Block10();
//const manager = new ipam.Manager({ blocks: [block, new ipam.Block172()], start: 8, end: 10 });
const networkAddress = ipam.CollectNetworkAddresses('10.0.0.0', 10, 13);
const smallestNetworkAddress = ipam.findLongestNetworkAddress(networkAddress);
const reserves = [
  {
    address: '10.0.0.0',
    prefix: 10,
    label: 'dev',
  },
];
for (const reserve of reserves) {
  const range = ipam.CidrRange(reserve.address, reserve.prefix);
  for (const NetworkAddress of smallestNetworkAddress) {
    const na = ipam.CidrRange(NetworkAddress, 13);
    if (range.contains(na)) {
      console.log('reserve');
      console.log(NetworkAddress);
    }
  }
}
console.log(networkAddress);
console.log(smallestNetworkAddress);
ipam.PrintTable(networkAddress);

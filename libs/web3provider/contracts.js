const _ = require('lodash');
const abiDecoder = require('abi-decoder');

const WTIndexContract = require('../../build/contracts/WTIndex.json');
const HotelContract = require('../../build/contracts/Hotel.json');
const UnitTypeContract = require('../../build/contracts/UnitType.json');
const UnitContract = require('../../build/contracts/Unit.json');
const AsyncCallContract = require('../../build/contracts/AsyncCall.json');
const LifTokenContract = require('../../build/contracts/LifToken.json');

abiDecoder.addABI(AsyncCallContract.abi);
abiDecoder.addABI(LifTokenContract.abi);
abiDecoder.addABI(HotelContract.abi);
abiDecoder.addABI(WTIndexContract.abi);
abiDecoder.addABI(UnitTypeContract.abi);
abiDecoder.addABI(UnitContract.abi);

const abis = {
  WTIndex: WTIndexContract.abi,
  Hotel: HotelContract.abi,
  LifToken: LifTokenContract.abi,
  HotelUnit: UnitContract.abi,
  HotelUnitType: UnitTypeContract.abi
};

const binaries = {
  WTIndex: WTIndexContract.bytecode,
  Hotel: HotelContract.bytecode,
  LifToken: LifTokenContract.bytecode,
  HotelUnit: UnitContract.bytecode,
  HotelUnitType: UnitTypeContract.bytecode
}

const _getContractInstance = function (web3, name, address) {
  const abi = abis[name];
  const contract = new web3.eth.Contract(abi, address);
  contract.setProvider(web3.currentProvider);
  return contract;
};

// Populated during initialization
let getContractInstance;

const getHotelUnitInstance = function (address) {
  return getContractInstance('HotelUnit', address);
}

const getHotelInstance = function (address) {
  return getContractInstance('Hotel', address);
}

const getTokenInstance = function (address) {
  return getContractInstance('LifToken', address);
}

const getIndexInstance = function (address) {
  return getContractInstance('WTIndex', address);
}

const getHotelUnitTypeInstance = function (address) {
  return getContractInstance('HotelUnitType', address);
}

module.exports = function (web3) {
  getContractInstance = _.partial(_getContractInstance, web3);
  return {
    abiDecoder: abiDecoder,
    abis: abis,
    binaries: binaries,
    getContractInstance: getContractInstance,
    getHotelInstance: getHotelInstance,
    getHotelUnitInstance: getHotelUnitInstance,
    getTokenInstance: getTokenInstance,
    getIndexInstance: getIndexInstance,
    getHotelUnitTypeInstance: getHotelUnitTypeInstance,
  }
};
const _ = require('lodash');
const util = require('./util/index');
const HotelManager = require('./HotelManager');

/**
 * BookingData provides methods that let clients query the blockchain about costs
 * of specific reservations, the bookings that have been made at a hotel, and bookings requested
 * for a hotel.
 */
class BookingData {

  constructor(web3){
    this.context = {};
    this.context.web3 = web3;
    this.manager = new HotelManager({web3: web3});
  }

  /**
   * Gets the total real currency cost of booking for a range of days. Check-in is on the first day,
   * check-out on the last.
   * @param  {Address}          hotelAddress Hotel contract that controls the Unit contract to edit
   * @param  {Addres}           unitAddress  Unit contract to edit
   * @param  {String|Number|BN} price        Lif 'ether' (converted to wei by web3.utils.toWei)
   * @param  {Date }            fromDate     check-in date
   * @param  {Number}           amountDays   integer number of days to book.
   * @return {Number}           Floating point cost ex: 100.00
   * @example
      const cost = await lib.getCost('0xab3..cd', new Date('5/31/2020'), 5);
   */
  async getCost(unitAddress, fromDate, daysAmount){
    const fromDay = util.formatDate(fromDate);
    const unit = util.getInstance('HotelUnit', unitAddress, this.context);
    const cost = await unit.methods.getCost(fromDay, daysAmount).call();
    return util.bnToPrice(cost);
  }

  /**
   * Gets the total real currency cost of booking for a range of days. Check-in is on the first day,
   * check-out on the last.
   * @param  {Address}          hotelAddress Hotel contract that controls the Unit contract to edit
   * @param  {Addres}           unitAddress  Unit contract to edit
   * @param  {String|Number|BN} price        Lif 'ether' (converted to wei by web3.utils.toWei)
   * @param  {Date }            fromDate     check-in date
   * @param  {Number}           amountDays   integer number of days to book.
   * @return {Number}           Lif
   * @example
      const cost = await lib.getCost('0xab3..cd', new Date('5/31/2020'), 5);
   */
  async getLifCost(unitAddress, fromDate, daysAmount){
    const fromDay = util.formatDate(fromDate);
    const unit = util.getInstance('HotelUnit', unitAddress, this.context);
    const wei = await unit.methods.getLifCost(fromDay, daysAmount).call();

    return util.lifWei2Lif(wei, this.context);
  }

  /**
   * Async method that verifies that a unit is available for a desired range of days
   * @param  {Address} unitAddress Unit contract address
   * @param  {Date}    fromDate    check-in date
   * @param  {Number}  daysAmount  number of days
   * @return {Boolean}
   */
  async unitIsAvailable(unitAddress, fromDate, daysAmount){
    const unit = util.getInstance('HotelUnit', unitAddress, this.context);
    const fromDay = util.formatDate(fromDate);
    const range = _.range(fromDay, fromDay + daysAmount);

    const isActive = await unit.methods.active().call();
    if (!isActive) return false;

    for (let day of range) {

      const {
        specialPrice,
        specialLifPrice,
        bookedBy
      } = await this.manager.getReservation(unitAddress, day);

      if (!util.isZeroAddress(bookedBy)) return false;
    }
    return true;
  }

  /**
   * Async retrieves the bookings history associated a hotel address or addresses. If
   * `startBlock` is ommitted, method will search from the creation block of each Hotel contract.
   * @param  {Address | Array} _addresses  Hotel contract address(es) to fetch bookings for
   * @param  {Number}          startBlock  Optional: block to begin searching from.
   * @return {Promise}                     Array of bookings objects
   * @example
   * [
   *   {
   *     "transactionHash": "0x0ed3a16220e3b0cab35c25574b618a02130fe6ab8225ed0b6bad6ffc9640694d",
   *     "blockNumber": 25,
   *     "id": "log_f72920af",
   *     "from": "0xc9F805a42837E78D5566f6A04Dba7167F8c6A830",
   *     "unit": "0xcE85f98D04B25deaa27406492B6d6B747B837741",
   *     "fromDate": "2020-10-10T07:00:00.000Z",
   *     "daysAmount": "5"
   *    }
   * ]
   */
  async getBookings(_addresses, fromBlock=0){
    let hotelsToQuery = [];
    let bookings = [];

    (Array.isArray(_addresses))
      ? hotelsToQuery = _addresses
      : hotelsToQuery.push(_addresses);

    if (!hotelsToQuery.length) return [];

    let events;
    for (let address of hotelsToQuery){
      const hotel = util.getInstance('Hotel', address, this.context);

      events = await hotel.getPastEvents('Book', {
        fromBlock: fromBlock
      });

      events.forEach(event => bookings.push({
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        id: event.id,
        from: event.returnValues.from,
        unit: event.returnValues.unit,
        fromDate: util.parseDate(event.returnValues.fromDay),
        daysAmount: event.returnValues.daysAmount
      }));
    }
    return bookings;
  };

  /**
   * Async retrieves the outstanding bookings requests associated a hotel address or addresses.
   * This is the set of all requests (wt-contract event: `CallStarted`) that do not have
   * a matching completion (wt-contract event: `CallFinished`). If `startBlock` is ommitted,
   * method will search from the creation block of each Hotel contract.
   * `startBlock` is ommitted, method will search from the creation block of each Hotel contract.
   * @param  {Address | Array} _addresses  Hotel contract address(es) to fetch bookings for
   * @param  {Number}          startBlock  Optional: block to begin searching from.
   * @return {Promise}         Array of bookings objects
   * @example
   *  [
   *    {
   *     "transactionHash": "0x18c59c3f570d4013e0bc300c2f5c4eebf0f4a12dd470ead6560fdcc738a194d0",
   *     "blockNumber": 26,
   *     "id": "log_9b3eb752",
   *     "from": "0x522701D427e1C2e039fdC32Db41972A46dFD7755",
   *     "dataHash": "0x4077e0fee8018bb3dd785fd6820fcd393eecb6ce58ea91b3d7ced260761c73fa"
   *    }
   *   ]
   */
  async getBookingRequests(_addresses, fromBlock=0){
    let hotelsToQuery = [];
    let requests = [];

    (Array.isArray(_addresses))
      ? hotelsToQuery = _addresses
      : hotelsToQuery.push(_addresses);

    if (!hotelsToQuery.length) return [];

    let startedEvents;
    let finishEvents;
    let unfinished;

    for (let address of hotelsToQuery){
      const hotel = util.getInstance('Hotel', address, this.context);

      startedEvents = await hotel.getPastEvents('CallStarted', {
        fromBlock: fromBlock
      });

      finishEvents = await hotel.getPastEvents('CallFinish', {
        fromBlock: fromBlock
      })

      // Filter out started events without a corresponding finishing event
      unfinished = startedEvents.filter(event => {
        let found = finishEvents
          .findIndex(item => item.returnValues.dataHash === event.returnValues.dataHash);

        return found === -1;
      })

      unfinished.forEach(event => requests.push({
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        id: event.id,
        from: event.returnValues.from,
        dataHash: event.returnValues.dataHash,
      }));
    }

    return requests;
  }
}

module.exports = BookingData;


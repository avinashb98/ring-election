/**
 * Create a distributed ring and partition data.
 * @author Alessandro Pio Ardizio
 * @since 0.1
 */
'use strict'

// --------------------- CONFIG --------------------- 
/* This config is helpful for development and test ,in production 
* will be used environment variables 
*/
let os = require('os');
let hostname = os.hostname();
let config = require('../config/config.js');
let configObject = require('../config/config.json');
config(configObject);
let log = require('./logger');
let peerPort = process.env.PORT || 3000;
// --------------------- CONFIG --------------------- 

const net = require('net');
const util = require('./util');
const hearthbeat = require('./hearthbeat');
const Rx = require('@reactivex/rxjs');
const ring = require('./leader');
// node id in the ring.
var id;
// priority to be elegible to be a seed node.
var priority;


// --------------------- CONSTANTS ---------------------
const {NODE_ADDED,NODE_REMOVED,HEARTH_BEAT,WELCOME,HOSTNAME,MESSAGE_SEPARATOR} = require('./constants'); 
// --------------------- CONSTANTS --------------------- 

// --------------------- DS --------------------- 
/** Used for reconnection when a seed node die. */
/* Addresses will be an array so that is more simple to exchange it as object during socket communication */
let addresses;
// --------------------- DS --------------------- 

// --------------------- CORE --------------------- 


/**
 * Simple node of the ring , it will contact seed node 
 * and will sent heart beath message each 10s.
 */
let createClient = () => {
  var client = net.connect({
    host: process.env.SEED_NODE || 'localhost',
    port: peerPort
  }, () => log.info('connected to server!'));
  client.setNoDelay(true);
  client.on('data', (data) => peerMessageHandler(data, client));
  client.on('end', (e) => seedErrorEvent(client, e));
  client.on('error', (e) => seedEndEvent(client, e));
  client.write(JSON.stringify({ type: HOSTNAME, msg: hostname }));
}



// --------------------- CORE --------------------- 

// --------------------- MESSAGING --------------------- 

let peerMessageHandler = (data, client) => {
  let stringData = data.toString();
  let arrayData = stringData.split(MESSAGE_SEPARATOR);

  arrayData.forEach(e => {
    if (e.length <= 0) return;
    let jsonData = JSON.parse(e);
    let type = jsonData.type;
    let msg = jsonData.msg;
    log.debug(`Receveid a message with type ${type}`);
    if (type === WELCOME) {
      // convert array in a map.
      addresses = jsonData.msg;
      id = jsonData.id;
      priority = jsonData.priority;
      log.info(`Id in the ring ${id} , priority in the ring ${priority}`);
      hearthbeat(client, id);
    } else if (type === NODE_ADDED) {
      log.info('New node added in the cluster');
      addresses = msg;
    } else if (type === NODE_REMOVED) {
      priority--;
      log.info(`A node was removed from the cluster , now my priority is ${priority}`);
      addresses = msg;
    }
    // handle all types of messages.
  })
}


/**
 * Seed node dead , search new seed node and connect to it.
 */
let seedNodeReconnection = () => {
  log.error('Seed node is dead');
   Rx.Observable.from(addresses)
    .find((e) => e.priority === 1)
    .subscribe(e => {
      log.info(`Find vice seed node with address ${e.address} and port ${e.port}`);
      process.env.SEED_NODE = e.address;
      peerPort = e.port;
      setTimeout(createClient, process.env.TIME_TO_RECONNECT || 3000);
    }, error => log.error(error),
      () => log.info('Reconnected to seed node'));
}

/**
 * Handler for seed node disconnection.
 */
let seedErrorEvent = (client, err) => {
  log.info('seed node disconnected')
  client.end();
  client.destroy();
  // keep clients updated
  if (priority === 1) {
    log.info('Becoming seed node , clearing server list and waiting for connections');
    setTimeout(ring.createServer,process.env.TIME_TO_BECOME_SEED || 1000);
  } else {
    seedNodeReconnection();
  }
};

/**
 * Error handling on sockets.
 * @param {*} client , client disconnected
 * @param {*} e  , error
 */
let seedEndEvent = (client, e) => {
  log.error(JSON.stringify(e));
};


// --------------------- MESSAGING --------------------- 

module.exports = {
  createClient: createClient
}
#!/usr/bin/env node
/**
 * Little beanstalkd console tool, it watches a single tube and show you
 * how fast jobs are going in and out of your queue.
 * Copyright (c) Eleme, Inc https://github.com/eleme/beanstats
 */

var fivebeans = require('fivebeans');
var optimist = require('optimist');


var opt = optimist
    .usage('Usage: beanstats [tube] -p [port] -h [host] -t <interval>')
    .default('t', 5000)
    .default('p', 11300)
    .default('h', '0.0.0.0');

var argv = opt.argv;

/**
 * show message on `./index.js -h`
 */
if (argv.h === true) {
  console.log(opt.help());
  process.exit(0);
}

/**
 * parse arguments
 */
var tube = argv._[0] || 'default';
var host = argv.h;
var port = parseInt(argv.p, 10);
var interval = parseInt(argv.t, 10);

if (isNaN(port)) port = 11300;
if (isNaN(interval)) interval = 5000;

/**
 * beanstalk client
 */
var client = new fivebeans.client(host, port);

/**
 * beanstalkd stats cache
 */
var cache;

/**
 * beanstats stats
 */

var stats = {
  'tube': function(data) {
    return data.name;
  },
  'inflow': function(data) {
    return data['total-jobs'] - cache['total-jobs'];
  },
  'delete': function(data) {
    return data['cmd-delete'] - cache['cmd-delete'];
  },
  'current ready': function(data) {
    return data['current-jobs-ready'];
  }
};

var keys = Object.keys(stats);

/**
 * connect beanstalkd
 */
function connect(callback){
  client.on('connect', function(){
    client.watch(tube, function(){
      callback();
    });
  }).connect();
}

/*
 * init stats
 */
function init(callback){
  client.stats_tube(tube, function(err, data){
    cache = data;
    callback();
  });
}

/**
 * report tube stats
 */
function collect(callback) {
  client.stats_tube(tube, function(err, data){
    var vals = [];

    for (var i = 0; i < keys.length; i++) {
      vals.push(stats[keys[i]](data));
    }

    cache = data;

    callback(vals);
  });
}


/**
 * format output string unit
 */
function format(vals, size) {
  var i;
  var base = new Array(size).join(' ');
  var tabs = [];

  for (i = 0; i < vals.length; i++) {
    var tab = (base + vals[i]).slice(-size);
    tabs.push(tab);
  }
  return tabs.join('  | ');
}


/**
 * output stats
 */

connect(function(){
  init(function(){
    var tabSize = 9;  // min tab size

    for (var key in stats) {
      if (tabSize < key.length) {
        tabSize = key.length;
      }
    }

    console.log(format(keys, tabSize));

    setInterval(function(){
      collect(function(vals){
        console.log(format(vals, tabSize));
      });
    }, interval);
  });
});
